export const Status = {
  PLANNING: "planning",
  EXECUTING: "executing",
  CRITIC: "critic",
  RETRY: "retry",
  ERROR: "error",
  DONE: "done"
};

export class Blackboard {
  constructor(options = {}) {
    this.name = options.name || "main";
    this.zones = new Map();
    this.subscribers = new Map();
    this.history = [];
    this.maxHistory = options.maxHistory || 100;
    this.lockTimeout = options.lockTimeout || 5000;
    
    this.initializeDefaultZones();
  }

  initializeDefaultZones() {
    this.zones.set("goal", {
      type: "goal",
      data: null,
      version: 0,
      locked: false,
      lockedBy: null,
      lockedAt: null
    });

    this.zones.set("plan", {
      type: "plan",
      data: null,
      version: 0,
      locked: false,
      lockedBy: null,
      lockedAt: null
    });

    this.zones.set("execution", {
      type: "execution",
      data: null,
      version: 0,
      locked: false,
      lockedBy: null,
      lockedAt: null
    });

    this.zones.set("result", {
      type: "result",
      data: null,
      version: 0,
      locked: false,
      lockedBy: null,
      lockedAt: null
    });

    this.zones.set("context", {
      type: "context",
      data: {},
      version: 0,
      locked: false,
      lockedBy: null,
      lockedAt: null
    });

    this.zones.set("memory", {
      type: "memory",
      data: {},
      version: 0,
      locked: false,
      lockedBy: null,
      lockedAt: null
    });

    this.zones.set("skills", {
      type: "skills",
      data: [],
      version: 0,
      locked: false,
      lockedBy: null,
      lockedAt: null
    });

    this.zones.set("control", {
      type: "control",
      data: {
        iteration: 0,
        last_improvement: 0,
        stagnation_count: 0,
        best_score: 0,
        status: Status.PLANNING,
        error: null,
        retry_count: 0,
        timeout_at: null
      },
      version: 0,
      locked: false,
      lockedBy: null,
      lockedAt: null
    });
  }

  setStatus(newStatus, error = null) {
    const control = this.zones.get("control");
    if (!control) return null;
    
    const validStatuses = Object.values(Status);
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }
    
    control.data.status = newStatus;
    control.data.error = error;
    control.data.retry_count = newStatus === Status.RETRY ? control.data.retry_count + 1 : 0;
    control.version++;
    
    return control.data;
  }

  getStatus() {
    const control = this.zones.get("control");
    return control ? control.data.status : null;
  }

  hasError() {
    return this.getStatus() === Status.ERROR;
  }

  shouldRetry() {
    const control = this.zones.get("control");
    if (!control) return false;
    return control.data.status === Status.RETRY && control.data.retry_count < 3;
  }

  isTimeout() {
    const control = this.zones.get("control");
    if (!control) return false;
    if (control.data.timeout_at && Date.now() > control.data.timeout_at) {
      this.setStatus(Status.ERROR, "timeout");
      return true;
    }
    return false;
  }

  setTimeout(ms) {
    const control = this.zones.get("control");
    if (!control) return;
    control.data.timeout_at = Date.now() + ms;
    control.version++;
  }

  clearTimeout() {
    const control = this.zones.get("control");
    if (!control) return;
    control.data.timeout_at = null;
    control.version++;
  }

  updateControlState(newScore, cycleLimit = 5) {
    const control = this.zones.get("control");
    if (!control) return null;
    
    control.data.iteration++;
    
    if (newScore > control.data.best_score) {
      control.data.best_score = newScore;
      control.data.last_improvement = control.data.iteration;
      control.data.stagnation_count = 0;
    } else {
      control.data.stagnation_count++;
    }
    
    if (control.data.iteration > cycleLimit) {
      control.data.status = Status.ERROR;
      control.data.error = "cycle_limit_exceeded";
    } else if (control.data.stagnation_count > 3) {
      control.data.status = Status.DONE;
    }
    
    control.version++;
    
    return control.data;
  }

  getControlState() {
    const control = this.zones.get("control");
    return control ? { ...control.data } : null;
  }

  resetControlState() {
    const control = this.zones.get("control");
    if (control) {
      control.data = {
        iteration: 0,
        last_improvement: 0,
        stagnation_count: 0,
        best_score: 0,
        status: "running"
      };
      control.version++;
    }
  }

  async acquireLock(zoneName, owner, timeout) {
    const zone = this.zones.get(zoneName);
    if (!zone) return false;

    if (zone.locked) {
      if (zone.lockedBy === owner) return true;
      
      const elapsed = Date.now() - zone.lockedAt;
      if (elapsed < (timeout || this.lockTimeout)) return false;
    }

    zone.locked = true;
    zone.lockedBy = owner;
    zone.lockedAt = Date.now();
    return true;
  }

  releaseLock(zoneName, owner) {
    const zone = this.zones.get(zoneName);
    if (!zone) return false;

    if (zone.lockedBy === owner) {
      zone.locked = false;
      zone.lockedBy = null;
      zone.lockedAt = null;
      return true;
    }
    return false;
  }

  async write(zoneName, data, writer) {
    const acquired = await this.acquireLock(zoneName, writer);
    if (!acquired) {
      throw new Error(`Failed to acquire lock on zone: ${zoneName}`);
    }

    try {
      const zone = this.zones.get(zoneName);
      const oldData = zone.data;
      
      zone.data = data;
      zone.version++;

      this.history.push({
        zone: zoneName,
        action: "write",
        writer,
        oldData,
        newData: data,
        version: zone.version,
        timestamp: Date.now()
      });

      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }

      this.notifySubscribers(zoneName, { type: "write", data, version: zone.version });
      
      return zone.version;
    } finally {
      this.releaseLock(zoneName, writer);
    }
  }

  read(zoneName, reader) {
    const zone = this.zones.get(zoneName);
    if (!zone) return null;

    this.notifySubscribers(zoneName, { type: "read", reader, version: zone.version });
    
    return {
      data: zone.data,
      version: zone.version,
      locked: zone.locked,
      lockedBy: zone.lockedBy
    };
  }

  subscribe(zoneName, callback) {
    if (!this.subscribers.has(zoneName)) {
      this.subscribers.set(zoneName, []);
    }
    this.subscribers.get(zoneName).push(callback);
  }

  unsubscribe(zoneName, callback) {
    if (!this.subscribers.has(zoneName)) return;
    const callbacks = this.subscribers.get(zoneName);
    const index = callbacks.indexOf(callback);
    if (index > -1) callbacks.splice(index, 1);
  }

  notifySubscribers(zoneName, event) {
    if (!this.subscribers.has(zoneName)) return;
    for (const callback of this.subscribers.get(zoneName)) {
      try {
        callback(event);
      } catch (e) {
        console.error(`Subscriber error for ${zoneName}:`, e);
      }
    }
  }

  getZoneVersion(zoneName) {
    const zone = this.zones.get(zoneName);
    return zone ? zone.version : -1;
  }

  safeSet(zoneName, patch, expectedVersion, writer) {
    const zone = this.zones.get(zoneName);
    if (!zone) {
      throw new Error(`Zone not found: ${zoneName}`);
    }

    if (zone.version !== expectedVersion) {
      throw new Error(`State conflict: expected version ${expectedVersion}, got ${zone.version}`);
    }

    return this.write(zoneName, patch, writer);
  }

  hasChanged(zoneName, lastKnownVersion) {
    return this.getZoneVersion(zoneName) > lastKnownVersion;
  }

  getZoneData(zoneName) {
    const zone = this.zones.get(zoneName);
    return zone ? zone.data : null;
  }

  getHistory(zoneName, limit = 10) {
    const filtered = this.history.filter(h => h.zone === zoneName);
    return filtered.slice(-limit);
  }

  getAllHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  clear(zoneName) {
    const zone = this.zones.get(zoneName);
    if (zone) {
      zone.data = zone.type === "object" || zone.type === "context" || zone.type === "memory" ? {} : null;
      zone.version++;
    }
  }

  reset() {
    for (const [name, zone] of this.zones) {
      zone.data = zone.type === "object" || zone.type === "context" || zone.type === "memory" ? {} : null;
      zone.version = 0;
      zone.locked = false;
      zone.lockedBy = null;
      zone.lockedAt = null;
    }
    this.history = [];
  }

  getState() {
    const state = {};
    for (const [name, zone] of this.zones) {
      state[name] = {
        data: zone.data,
        version: zone.version,
        locked: zone.locked
      };
    }
    return state;
  }
}

export class BlackboardAgent {
  constructor(blackboard, agentName) {
    this.blackboard = blackboard;
    this.name = agentName;
    this.readVersions = {};
    this.attentionMask = null;
  }

  setAttentionMask(zones) {
    this.attentionMask = new Set(zones);
  }

  canRead(zoneName) {
    if (!this.attentionMask) return true;
    return this.attentionMask.has(zoneName);
  }

  async write(zoneName, data) {
    if (!this.canRead(zoneName) && !this.isWriterZone(zoneName)) {
      throw new Error(`${this.name} is not permitted to write to ${zoneName}`);
    }
    return this.blackboard.write(zoneName, data, this.name);
  }

  read(zoneName) {
    if (!this.canRead(zoneName)) {
      throw new Error(`${this.name} is not permitted to read ${zoneName}`);
    }
    const result = this.blackboard.read(zoneName, this.name);
    this.readVersions[zoneName] = result.version;
    return result;
  }

  isWriterZone(zoneName) {
    const writerZones = {
      planner: ["goal", "plan"],
      executor: ["execution", "result"],
      reasoner: ["context"]
    };
    return writerZones[this.name]?.includes(zoneName) || false;
  }

  waitForChange(zoneName, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const lastVersion = this.readVersions[zoneName] || 0;

      const check = () => {
        if (this.blackboard.hasChanged(zoneName, lastVersion)) {
          resolve(this.read(zoneName));
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for change in ${zoneName}`));
          return;
        }

        setTimeout(check, 100);
      };

      check();
    });
  }

  subscribe(zoneName, callback) {
    this.blackboard.subscribe(zoneName, callback);
  }
}

export function createBlackboard(options) {
  return new Blackboard(options);
}
