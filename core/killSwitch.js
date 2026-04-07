export const SYSTEM_LIMIT = {
  max_cycles: 10,
  max_cost: 1000,
  max_time_ms: 2000
};

export class KillSwitch {
  constructor(limits = {}) {
    this.maxCycles = limits.max_cycles ?? SYSTEM_LIMIT.max_cycles;
    this.maxCost = limits.max_cost ?? SYSTEM_LIMIT.max_cost;
    this.maxTimeMs = limits.max_time_ms ?? SYSTEM_LIMIT.max_time_ms;
    
    this.cycleCount = 0;
    this.totalCost = 0;
    this.startTime = Date.now();
  }

  get cycles() {
    return this.cycleCount;
  }

  get elapsedMs() {
    return Date.now() - this.startTime;
  }

  get cost() {
    return this.totalCost;
  }

  incrementCycle(cost = 0) {
    this.cycleCount++;
    this.totalCost += cost;
  }

  shouldStop() {
    if (this.cycleCount >= this.maxCycles) {
      return { stop: true, reason: "cycle_limit_exceeded", limit: this.maxCycles };
    }
    if (this.totalCost >= this.maxCost) {
      return { stop: true, reason: "cost_limit_exceeded", limit: this.maxCost };
    }
    if (this.elapsedMs >= this.maxTimeMs) {
      return { stop: true, reason: "time_limit_exceeded", limit: this.maxTimeMs };
    }
    return { stop: false };
  }

  reset() {
    this.cycleCount = 0;
    this.totalCost = 0;
    this.startTime = Date.now();
  }
}

export function createKillSwitch(limits) {
  return new KillSwitch(limits);
}
