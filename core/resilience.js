import { EventEmitter } from "events";

export class ExecutionIsolation extends EventEmitter {
  constructor(options = {}) {
    super();
    this.timeout = options.timeout || 30000;
    this.maxMemoryMB = options.maxMemoryMB || 512;
    this.isolateLevel = options.isolateLevel || "vm";
    this.taskTimeout = options.taskTimeout || 10000;
    
    this.runningTasks = new Map();
    this.taskIdCounter = 0;
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.timeouts = 0;
  }

  async executeInIsolation(taskFn, payload, options = {}) {
    const taskId = `isolate_${this.taskIdCounter++}`;
    const timeout = options.timeout || this.taskTimeout;
    
    const task = {
      id: taskId,
      startTime: Date.now(),
      status: "started",
      payload
    };

    this.runningTasks.set(taskId, task);
    this.emit("task_start", task);

    try {
      const result = await Promise.race([
        this.executeTask(taskFn, payload),
        this.createTimeout(taskId, timeout)
      ]);

      task.status = "completed";
      task.endTime = Date.now();
      task.duration = task.endTime - task.startTime;
      task.result = result;
      this.completedTasks++;

      this.emit("task_complete", task);
      return result;
    } catch (error) {
      task.status = "failed";
      task.endTime = Date.now();
      task.duration = task.endTime - task.startTime;
      task.error = error.message;
      this.failedTasks++;

      this.emit("task_failed", task);
      throw error;
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  async executeTask(taskFn, payload) {
    return taskFn(payload);
  }

  createTimeout(taskId, timeout) {
    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        this.timeouts++;
        const task = this.runningTasks.get(taskId);
        if (task) {
          task.status = "timeout";
          task.error = `Task ${taskId} timed out after ${timeout}ms`;
        }
        reject(new Error(`Task ${taskId} timed out after ${timeout}ms`));
      }, timeout);

      const originalThen = Promise.prototype.then;
      Promise.prototype.then = function(onFulfilled) {
        clearTimeout(timeoutId);
        return originalThen.call(this, onFulfilled);
      };
    });
  }

  getActiveTasks() {
    return Array.from(this.runningTasks.values());
  }

  getStats() {
    return {
      active: this.runningTasks.size,
      completed: this.completedTasks,
      failed: this.failedTasks,
      timeouts: this.timeouts,
      successRate: this.completedTasks > 0 
        ? (this.completedTasks - this.failedTasks) / this.completedTasks 
        : 0
    };
  }

  killTask(taskId) {
    const task = this.runningTasks.get(taskId);
    if (task) {
      task.status = "killed";
      task.endTime = Date.now();
      this.runningTasks.delete(taskId);
      this.failedTasks++;
      this.emit("task_killed", task);
      return true;
    }
    return false;
  }

  reset() {
    this.runningTasks.clear();
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.timeouts = 0;
  }
}

export class DecisionLogger {
  constructor(options = {}) {
    this.enableExplainability = options.enableExplainability !== false;
    this.maxHistory = options.maxHistory || 500;
    this.decisions = [];
    this.decisionIdCounter = 0;
  }

  logDecision(decisionType, details) {
    if (!this.enableExplainability) return;

    const decision = {
      id: `dec_${this.decisionIdCounter++}`,
      type: decisionType,
      timestamp: Date.now(),
      reasons: details.reasons || {},
      context: details.context || {},
      result: details.result || null,
      confidence: details.confidence || 0.5
    };

    this.decisions.push(decision);
    if (this.decisions.length > this.maxHistory) {
      this.decisions.shift();
    }

    return decision.id;
  }

  explainDecision(decisionId) {
    return this.decisions.find(d => d.id === decisionId);
  }

  getDecisionHistory(type = null, limit = 20) {
    let filtered = this.decisions;
    if (type) {
      filtered = filtered.filter(d => d.type === type);
    }
    return filtered.slice(-limit);
  }

  why(goal) {
    const relevantDecisions = this.decisions
      .filter(d => d.context.goal === goal || d.context.goal?.includes(goal.split(" ")[0]))
      .slice(-5);

    if (relevantDecisions.length === 0) {
      return { explanation: "No decision history for this goal type" };
    }

    const last = relevantDecisions[relevantDecisions.length - 1];
    return {
      lastDecision: last.type,
      reasons: last.reasons,
      confidence: last.confidence,
      history: relevantDecisions.map(d => ({ type: d.type, confidence: d.confidence }))
    };
  }

  getStats() {
    const byType = {};
    for (const d of this.decisions) {
      byType[d.type] = (byType[d.type] || 0) + 1;
    }

    return {
      total: this.decisions.length,
      byType,
      recent: this.decisions.slice(-10).map(d => ({ type: d.type, confidence: d.confidence }))
    };
  }

  reset() {
    this.decisions = [];
  }
}

export class EconomicScoring {
  constructor(options = {}) {
    this.qualityWeight = options.qualityWeight || 0.6;
    this.costWeight = options.costWeight || 0.3;
    this.speedWeight = options.speedWeight || 0.1;
    this.minScore = options.minScore || 0.3;
  }

  calculate(options) {
    const { quality, cost, speed } = options;

    const qualityScore = Math.max(0, Math.min(1, quality || 0));
    const costScore = Math.max(0, Math.min(1, 1 - (cost || 0)));
    const speedScore = Math.max(0, Math.min(1, speed || 1));

    const finalScore = (
      qualityScore * this.qualityWeight +
      costScore * this.costWeight +
      speedScore * this.speedWeight
    );

    return {
      raw: finalScore,
      quality: qualityScore,
      cost: costScore,
      speed: speedScore,
      isViable: finalScore >= this.minScore,
      breakdown: {
        quality: (qualityScore * this.qualityWeight).toFixed(3),
        cost: (costScore * this.costWeight).toFixed(3),
        speed: (speedScore * this.speedWeight).toFixed(3)
      }
    };
  }

  compareOptions(options) {
    return options
      .map(opt => ({
        ...opt,
        ...this.calculate(opt)
      }))
      .sort((a, b) => b.raw - a.raw);
  }

  getROI(quality, cost) {
    if (cost === 0) return Infinity;
    return quality / cost;
  }
}

export class MetaStability {
  constructor(options = {}) {
    this.smoothingFactor = options.smoothingFactor || 0.8;
    this.maxChange = options.maxChange || 0.1;
    this.stableWindow = options.stableWindow || 5;
    
    this.paramHistory = new Map();
    this.oscillationCount = new Map();
  }

  adjustParameter(paramName, proposedValue, currentValue) {
    const paramHistory = this.paramHistory.get(paramName) || [];
    paramHistory.push({ value: currentValue, timestamp: Date.now() });
    
    if (paramHistory.length > this.stableWindow) {
      paramHistory.shift();
    }
    
    const maxChange = this.maxChange;
    const rawNewValue = currentValue + proposedValue;
    const diff = rawNewValue - currentValue;
    
    if (Math.abs(diff) > maxChange) {
      const sign = diff > 0 ? 1 : -1;
      var newValue = currentValue + (sign * maxChange);
    } else {
      var newValue = rawNewValue;
    }

    const smoothedValue = (currentValue * this.smoothingFactor) + 
                          (newValue * (1 - this.smoothingFactor));

    paramHistory[paramHistory.length - 1].value = smoothedValue;
    this.paramHistory.set(paramName, paramHistory);

    if (this.detectOscillation(paramName)) {
      const count = (this.oscillationCount.get(paramName) || 0) + 1;
      this.oscillationCount.set(paramName, count);
      
      if (count > 3) {
        return this.stabilize(paramName, smoothedValue);
      }
    }

    return smoothedValue;
  }

  detectOscillation(paramName) {
    const history = this.paramHistory.get(paramName);
    if (!history || history.length < 3) return false;

    const recent = history.slice(-3);
    const values = recent.map(h => h.value);
    
    return (
      (values[0] > values[1] && values[1] < values[2]) ||
      (values[0] < values[1] && values[1] > values[2])
    );
  }

  stabilize(paramName, currentValue) {
    const history = this.paramHistory.get(paramName);
    if (history && history.length > 0) {
      const avg = history.reduce((s, h) => s + h.value, 0) / history.length;
      this.oscillationCount.set(paramName, 0);
      return avg;
    }
    return currentValue;
  }

  getParamHistory(paramName) {
    return this.paramHistory.get(paramName) || [];
  }

  isStable(paramName) {
    return (this.oscillationCount.get(paramName) || 0) <= 1;
  }

  getStabilityReport() {
    const report = {};
    for (const [param, history] of this.paramHistory) {
      report[param] = {
        current: history[history.length - 1]?.value,
        oscillations: this.oscillationCount.get(param),
        stable: this.isStable(param)
      };
    }
    return report;
  }

  reset() {
    this.paramHistory.clear();
    this.oscillationCount.clear();
  }
}

export class SafeMode extends EventEmitter {
  constructor(options = {}) {
    super();
    this.fallbackSkills = options.fallbackSkills || [];
    this.maxConsecutiveFailures = options.maxConsecutiveFailures || 3;
    this.autoRecovery = options.autoRecovery !== false;
    
    this.failures = 0;
    this.isActive = false;
    this.activationReason = null;
    this.activationTime = null;
    this.fallbackMode = false;
  }

  checkHealth(metrics = {}) {
    const { failureRate, errorRate, memoryUsage } = metrics;

    if (failureRate > 0.5) {
      this.trigger("failure_rate", "Failure rate exceeds 50%");
      return false;
    }

    if (errorRate > 0.3) {
      this.trigger("error_rate", "Error rate exceeds 30%");
      return false;
    }

    if (memoryUsage && memoryUsage > 0.9) {
      this.trigger("memory", "Memory usage critical");
      return false;
    }

    this.reset();
    return true;
  }

  trigger(reason, details) {
    this.failures++;
    this.isActive = true;
    this.activationReason = reason;
    this.activationTime = Date.now();
    this.fallbackMode = true;

    this.emit("safe_mode_activated", { reason, details, failures: this.failures });

    if (this.autoRecovery && this.failures >= this.maxConsecutiveFailures) {
      this.emit("auto_recovery_triggered", { reason });
    }
  }

  reset() {
    if (this.isActive && this.failures < this.maxConsecutiveFailures) {
      this.failures = 0;
    }
  }

  exitSafeMode() {
    this.isActive = false;
    this.fallbackMode = false;
    this.failures = 0;
    this.activationReason = null;
    this.emit("safe_mode_deactivated");
  }

  executeFallback(goal, context) {
    if (!this.fallbackMode || this.fallbackSkills.length === 0) {
      return { success: false, error: "No fallback available" };
    }

    for (const skill of this.fallbackSkills) {
      try {
        return { success: true, fallback: skill.name, result: "executed" };
      } catch (e) {
        continue;
      }
    }

    return { success: false, error: "All fallbacks failed" };
  }

  getStatus() {
    return {
      isActive: this.isActive,
      fallbackMode: this.fallbackMode,
      failures: this.failures,
      maxFailures: this.maxConsecutiveFailures,
      reason: this.activationReason,
      activeSince: this.activationTime,
      fallbackCount: this.fallbackSkills.length
    };
  }

  registerFallback(skill) {
    this.fallbackSkills.push(skill);
  }
}

export class ResilienceLayer {
  constructor(options = {}) {
    this.isolation = new ExecutionIsolation({
      timeout: options.isolationTimeout || 30000,
      taskTimeout: options.taskTimeout || 10000
    });

    this.decisionLogger = new DecisionLogger({
      enableExplainability: options.enableExplainability !== false
    });

    this.economicScoring = new EconomicScoring({
      qualityWeight: options.qualityWeight || 0.6,
      costWeight: options.costWeight || 0.3,
      speedWeight: options.speedWeight || 0.1
    });

    this.metaStability = new MetaStability({
      smoothingFactor: options.smoothingFactor || 0.8,
      maxChange: options.maxChange || 0.1
    });

    this.safeMode = new SafeMode({
      maxConsecutiveFailures: options.maxConsecutiveFailures || 3,
      fallbackSkills: options.fallbackSkills || []
    });

    this.healthChecks = [];
    this.healthCheckInterval = null;
  }

  startHealthChecks(intervalMs = 5000) {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
  }

  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  performHealthCheck() {
    const metrics = {
      failureRate: this.isolation.failedTasks / 
        (this.isolation.completedTasks + this.isolation.failedTasks || 1),
      errorRate: this.isolation.failedTasks / 
        (this.isolation.completedTasks || 1),
      activeTasks: this.isolation.runningTasks.size
    };

    const healthy = this.safeMode.checkHealth(metrics);

    if (!healthy) {
      this.safeMode.trigger("health_check_failed", metrics);
    }

    return healthy;
  }

  logDecision(type, reasons, context) {
    return this.decisionLogger.logDecision(type, { reasons, context });
  }

  explainWhy(goal) {
    return this.decisionLogger.why(goal);
  }

  calculateEconomicScore(options) {
    return this.economicScoring.calculate(options);
  }

  adjustParameter(paramName, proposedValue, currentValue) {
    return this.metaStability.adjustParameter(paramName, proposedValue, currentValue);
  }

  getStatus() {
    return {
      isolation: this.isolation.getStats(),
      decisions: this.decisionLogger.getStats(),
      metaStability: this.metaStability.getStabilityReport(),
      safeMode: this.safeMode.getStatus()
    };
  }

  reset() {
    this.isolation.reset();
    this.decisionLogger.reset();
    this.metaStability.reset();
    this.stopHealthChecks();
  }
}
