export class RetryPolicy {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 100;
    this.maxDelay = options.maxDelay || 5000;
    this.exponential = options.exponential !== false;
    this.jitter = options.jitter !== false;
    this.retryableErrors = options.retryableErrors || ["timeout", "network", "ECONNREFUSED", "503"];
  }

  getDelay(attempt) {
    let delay = this.baseDelay;
    
    if (this.exponential) {
      delay = this.baseDelay * Math.pow(2, attempt);
    }
    
    delay = Math.min(delay, this.maxDelay);
    
    if (this.jitter) {
      delay = delay * (0.5 + Math.random());
    }
    
    return Math.floor(delay);
  }

  isRetryable(error) {
    const errorStr = String(error).toLowerCase();
    return this.retryableErrors.some(e => errorStr.includes(e.toLowerCase()));
  }
}

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 30000;
    this.halfOpenCalls = 0;
    
    this.state = "CLOSED";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.openedAt = null;
  }

  canExecute() {
    if (this.state === "CLOSED") return true;
    
    if (this.state === "OPEN") {
      if (Date.now() - this.openedAt > this.timeout) {
        this.state = "HALF_OPEN";
        this.halfOpenCalls = 0;
        return true;
      }
      return false;
    }
    
    if (this.state === "HALF_OPEN") {
      return this.halfOpenCalls < 3;
    }
    
    return false;
  }

  recordSuccess() {
    if (this.state === "HALF_OPEN") {
      this.successes++;
      this.halfOpenCalls++;
      
      if (this.successes >= this.successThreshold) {
        this.state = "CLOSED";
        this.failures = 0;
        this.successes = 0;
      }
    } else if (this.state === "CLOSED") {
      this.failures = 0;
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.openedAt = Date.now();
      this.halfOpenCalls = 0;
    } else if (this.state === "CLOSED" && this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = Date.now();
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      openedAt: this.openedAt
    };
  }

  reset() {
    this.state = "CLOSED";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.openedAt = null;
  }
}

export class ReliabilityLayer {
  constructor(options = {}) {
    this.retryPolicy = new RetryPolicy(options.retry || {});
    this.circuitBreaker = new CircuitBreaker(options.circuit || {});
  }

  async executeWithRetry(fn, context = {}) {
    const maxRetries = this.retryPolicy.maxRetries;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (!this.circuitBreaker.canExecute()) {
          throw new Error("Circuit breaker open");
        }

        const result = await fn();
        this.circuitBreaker.recordSuccess();
        return result;
      } catch (error) {
        lastError = error;
        this.circuitBreaker.recordFailure();

        if (attempt < maxRetries && this.retryPolicy.isRetryable(error)) {
          const delay = this.retryPolicy.getDelay(attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  getStatus() {
    return {
      retry: {
        maxRetries: this.retryPolicy.maxRetries,
        baseDelay: this.retryPolicy.baseDelay,
        exponential: this.retryPolicy.exponential
      },
      circuit: this.circuitBreaker.getState()
    };
  }

  reset() {
    this.circuitBreaker.reset();
  }
}

export class LoadControl {
  constructor(options = {}) {
    this.maxQueueSize = options.maxQueueSize || 100;
    this.maxConcurrent = options.maxConcurrent || 10;
    this.backpressureThreshold = options.backpressureThreshold || 0.8;
    this.degradationThreshold = options.degradationThreshold || 0.9;
    
    this.currentLoad = 0;
    this.queue = [];
    this.rejected = 0;
    this.degraded = false;
  }

  canAccept() {
    if (this.queue.length >= this.maxQueueSize) {
      this.rejected++;
      return { accepted: false, reason: "queue_full" };
    }
    
    if (this.currentLoad >= this.maxConcurrent) {
      return { accepted: false, reason: "worker_busy" };
    }
    
    return { accepted: true };
  }

  getBackpressureLevel() {
    const queueRatio = this.queue.length / this.maxQueueSize;
    const loadRatio = this.currentLoad / this.maxConcurrent;
    
    if (queueRatio > this.degradationThreshold || loadRatio > this.degradationThreshold) {
      return "HIGH";
    }
    if (queueRatio > this.backpressureThreshold || loadRatio > this.backpressureThreshold) {
      return "MEDIUM";
    }
    return "LOW";
  }

  shouldDegrade() {
    return this.getBackpressureLevel() === "HIGH";
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      currentLoad: this.currentLoad,
      maxConcurrent: this.maxConcurrent,
      rejected: this.rejected,
      backpressure: this.getBackpressureLevel(),
      degraded: this.degraded
    };
  }

  reset() {
    this.queue = [];
    this.rejected = 0;
    this.degraded = false;
    this.currentLoad = 0;
  }
}

export class Alert {
  constructor(type, message, details = {}) {
    this.id = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.type = type;
    this.message = message;
    this.details = details;
    this.timestamp = Date.now();
    this.severity = details.severity || "warning";
    this.resolved = false;
  }
}

export class AlertingSystem {
  constructor(options = {}) {
    this.thresholds = {
      failureRate: options.failureRateThreshold || 0.2,
      latency: options.latencyThreshold || 2000,
      errorRate: options.errorRateThreshold || 0.1,
      queueSize: options.queueSizeThreshold || 80,
      budgetUsage: options.budgetUsageThreshold || 0.9
    };
    
    this.alerts = [];
    this.maxAlerts = options.maxAlerts || 100;
    this.alertCallbacks = [];
    
    this.checkInterval = null;
  }

  registerCallback(callback) {
    this.alertCallbacks.push(callback);
  }

  check(metrics) {
    const { failureRate, latency, errorRate, queueSize, budgetUsage, activeTasks } = metrics;

    if (failureRate > this.thresholds.failureRate) {
      this.trigger("failure_rate", `High failure rate: ${(failureRate * 100).toFixed(1)}%`, { severity: "critical" });
    }

    if (latency > this.thresholds.latency) {
      this.trigger("latency", `High latency: ${latency}ms`, { severity: "warning" });
    }

    if (errorRate > this.thresholds.errorRate) {
      this.trigger("error_rate", `High error rate: ${(errorRate * 100).toFixed(1)}%`, { severity: "critical" });
    }

    if (queueSize > this.thresholds.queueSize) {
      this.trigger("queue_size", `Queue growing: ${queueSize}`, { severity: "warning" });
    }

    if (budgetUsage > this.thresholds.budgetUsage) {
      this.trigger("budget_usage", `Budget running low: ${(budgetUsage * 100).toFixed(0)}%`, { severity: "warning" });
    }
  }

  trigger(type, message, details = {}) {
    const alert = new Alert(type, message, details);
    this.alerts.push(alert);
    
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }

    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (e) {
        console.error("Alert callback error:", e);
      }
    }

    return alert;
  }

  getActiveAlerts() {
    return this.alerts.filter(a => !a.resolve());
  }

  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  getAlerts(limit = 20) {
    return this.alerts.slice(-limit);
  }

  clearResolved() {
    this.alerts = this.alerts.filter(a => !a.resolved);
  }

  getStats() {
    return {
      active: this.alerts.filter(a => !a.resolved).length,
      total: this.alerts.length,
      thresholds: this.thresholds
    };
  }

  reset() {
    this.alerts = [];
  }
}

export class DegradationLevel {
  static NORMAL = "NORMAL";
  static DEGRADED = "DEGRADED";
  static SAFE_MODE = "SAFE_MODE";
}

export class ProgressiveDegradation {
  constructor(options = {}) {
    this.currentLevel = DegradationLevel.NORMAL;
    this.transitions = new Map();
    
    this.latencyThreshold = options.latencyThreshold || 1000;
    this.failureThreshold = options.failureThreshold || 0.3;
    this.successiveFailures = 0;
    this.maxSuccessiveFailures = options.maxSuccessiveFailures || 5;
    
    this.degradationActions = {
      [DegradationLevel.NORMAL]: [],
      [DegradationLevel.DEGRADED]: [
        { action: "disable_autonomy", reason: "high_latency" },
        { action: "increase_retry_delay", reason: "instability" }
      ],
      [DegradationLevel.SAFE_MODE]: [
        { action: "disable_all_mutation", reason: "system_unstable" },
        { action: "fallback_deterministic", reason: "critical_failure" },
        { action: "max_fallback", reason: "safety_mode" }
      ]
    };
  }

  assess(metrics) {
    const { latency, failureRate, successiveFailures, circuitState } = metrics;

    let newLevel = this.currentLevel;

    if (this.currentLevel === DegradationLevel.NORMAL) {
      if (latency > this.latencyThreshold || circuitState === "OPEN") {
        newLevel = DegradationLevel.DEGRADED;
      }
    }

    if (this.currentLevel === DegradationLevel.DEGRADED) {
      if (failureRate > this.failureThreshold || successiveFailures > this.maxSuccessiveFailures) {
        newLevel = DegradationLevel.SAFE_MODE;
      } else if (latency < this.latencyThreshold * 0.5 && circuitState === "CLOSED") {
        newLevel = DegradationLevel.NORMAL;
      }
    }

    if (this.currentLevel !== newLevel) {
      this.transition(newLevel);
    }

    return this.currentLevel;
  }

  transition(newLevel) {
    const oldLevel = this.currentLevel;
    this.currentLevel = newLevel;

    const actions = this.degradationActions[newLevel] || [];
    
    console.log(`[Degradation] ${oldLevel} → ${newLevel}`);
    console.log(`  Actions:`, actions.map(a => a.action).join(", "));

    return { from: oldLevel, to: newLevel, actions };
  }

  getActions() {
    return this.degradationActions[this.currentLevel];
  }

  shouldAllowAutonomy() {
    return this.currentLevel === DegradationLevel.NORMAL;
  }

  shouldAllowMutation() {
    return this.currentLevel !== DegradationLevel.SAFE_MODE;
  }

  shouldUseCache() {
    return this.currentLevel !== DegradationLevel.NORMAL;
  }

  getStatus() {
    return {
      currentLevel: this.currentLevel,
      successiveFailures: this.successiveFailures,
      availableActions: this.getActions()
    };
  }

  reset() {
    this.currentLevel = DegradationLevel.NORMAL;
    this.successiveFailures = 0;
    this.transitions.clear();
  }
}

export class StateValidator {
  constructor(options = {}) {
    this.schema = new Map();
    this.checksums = new Map();
    this.version = new Map();
  }

  registerZone(name, schema) {
    this.schema.set(name, schema);
  }

  validateZone(name, data) {
    const schema = this.schema.get(name);
    if (!schema) return { valid: true };

    if (schema.required) {
      for (const field of schema.required) {
        if (data[field] === undefined) {
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }
    }

    if (schema.types) {
      for (const [field, expectedType] of Object.entries(schema.types)) {
        if (data[field] !== undefined) {
          const actualType = typeof data[field];
          if (actualType !== expectedType) {
            return { valid: false, error: `Invalid type for ${field}: expected ${expectedType}, got ${actualType}` };
          }
        }
      }
    }

    return { valid: true };
  }

  validateAll(zones) {
    const results = [];
    
    for (const [name, data] of Object.entries(zones)) {
      const result = this.validateZone(name, data);
      if (!result.valid) {
        results.push({ zone: name, ...result });
      }
    }

    return {
      valid: results.length === 0,
      errors: results
    };
  }

  computeChecksum(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  saveSnapshot(name, data) {
    const checksum = this.computeChecksum(data);
    const currentVersion = this.version.get(name) || 0;
    
    this.checksums.set(name, { checksum, data: JSON.parse(JSON.stringify(data)) });
    this.version.set(name, currentVersion + 1);

    return { version: currentVersion + 1, checksum };
  }

  getSnapshot(name) {
    return this.checksums.get(name);
  }

  hasChanged(name, data) {
    const snapshot = this.checksums.get(name);
    if (!snapshot) return true;
    
    return snapshot.checksum !== this.computeChecksum(data);
  }

  rollback(name) {
    const snapshot = this.checksums.get(name);
    if (!snapshot) return null;
    
    return snapshot.data;
  }

  getStats() {
    return {
      zones: this.schema.size,
      snapshots: this.checksums.size,
      versions: Object.fromEntries(this.version)
    };
  }
}

export class OperationalLayer {
  constructor(options = {}) {
    this.reliability = new ReliabilityLayer(options.reliability || {});
    this.loadControl = new LoadControl(options.loadControl || {});
    this.alerting = new AlertingSystem(options.alerting || {});
    this.degradation = new ProgressiveDegradation(options.degradation || {});
    this.stateValidator = new StateValidator();
    
    this.startedAt = Date.now();
    this.healthStatus = "healthy";
  }

  async executeTask(taskFn, taskId = "default") {
    const canAccept = this.loadControl.canAccept();
    if (!canAccept.accepted) {
      throw new Error(`Task rejected: ${canAccept.reason}`);
    }

    this.loadControl.currentLoad++;
    
    try {
      const result = await this.reliability.executeWithRetry(taskFn);
      return result;
    } finally {
      this.loadControl.currentLoad--;
      this.runHealthCheck();
    }
  }

  runHealthCheck() {
    const metrics = {
      failureRate: this.reliability.circuitBreaker.failures / Math.max(1, this.reliability.circuitBreaker.failures + this.reliability.circuitBreaker.successes),
      latency: 0,
      errorRate: this.reliability.circuitBreaker.failures > 0 ? 1 : 0,
      queueSize: this.loadControl.queue.length,
      budgetUsage: 0,
      activeTasks: this.loadControl.currentLoad,
      circuitState: this.reliability.circuitBreaker.state
    };

    this.alerting.check(metrics);
    
    const degradationLevel = this.degradation.assess({
      latency: metrics.latency,
      failureRate: metrics.failureRate,
      successiveFailures: this.degradation.successiveFailures,
      circuitState: metrics.circuitState
    });

    this.healthStatus = degradationLevel === DegradationLevel.SAFE_MODE ? "critical" :
                       degradationLevel === DegradationLevel.DEGRADED ? "degraded" : "healthy";
  }

  getStatus() {
    return {
      uptime: Date.now() - this.startedAt,
      health: this.healthStatus,
      reliability: this.reliability.getStatus(),
      load: this.loadControl.getStats(),
      alerts: this.alerting.getStats(),
      degradation: this.degradation.getStatus(),
      stateValidator: this.stateValidator.getStats()
    };
  }

  reset() {
    this.reliability.reset();
    this.loadControl.reset();
    this.alerting.reset();
    this.degradation.reset();
    this.startedAt = Date.now();
  }
}
