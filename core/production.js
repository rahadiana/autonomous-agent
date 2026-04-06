export class RealCostTracker {
  constructor(options = {}) {
    this.trackLatency = options.trackLatency !== false;
    this.trackApiCalls = options.trackApiCalls !== false;
    this.trackCompute = options.trackCompute !== false;
    
    this.metrics = {
      totalLatency: 0,
      apiCalls: 0,
      computeTime: 0,
      operations: [],
      goals: new Map()
    };
    
    this.goalMetrics = new Map();
  }

  startOperation(operationId, type) {
    this.metrics.operations.push({
      id: operationId,
      type,
      startTime: Date.now(),
      status: "running"
    });
  }

  endOperation(operationId, metadata = {}) {
    const op = this.metrics.operations.find(o => o.id === operationId);
    if (!op) return null;

    op.endTime = Date.now();
    op.duration = op.endTime - op.startTime;
    op.status = "completed";
    op.metadata = metadata;

    if (this.trackLatency) {
      this.metrics.totalLatency += op.duration;
    }

    if (metadata.isApiCall && this.trackApiCalls) {
      this.metrics.apiCalls++;
    }

    if (metadata.computeTime && this.trackCompute) {
      this.metrics.computeTime += metadata.computeTime;
    }

    return op;
  }

  recordGoal(goal, cost) {
    const existing = this.goalMetrics.get(goal) || {
      count: 0,
      totalCost: 0,
      avgLatency: 0,
      failures: 0
    };

    existing.count++;
    existing.totalCost += cost;
    existing.avgLatency = existing.totalCost / existing.count;

    this.goalMetrics.set(goal, existing);
  }

  recordFailure(goal) {
    const existing = this.goalMetrics.get(goal) || {
      count: 0,
      totalCost: 0,
      avgLatency: 0,
      failures: 0
    };
    existing.failures++;
    this.goalMetrics.set(goal, existing);
  }

  getMetrics() {
    return {
      totalLatency: this.metrics.totalLatency,
      apiCalls: this.metrics.apiCalls,
      computeTime: this.metrics.computeTime,
      operationsCount: this.metrics.operations.length,
      avgLatency: this.metrics.operations.length > 0 
        ? this.metrics.totalLatency / this.metrics.operations.length 
        : 0,
      goalMetrics: Object.fromEntries(this.goalMetrics)
    };
  }

  getGoalMetrics(goal) {
    return this.goalMetrics.get(goal) || null;
  }

  getRecentOperations(limit = 20) {
    return this.metrics.operations
      .filter(op => op.status === "completed")
      .slice(-limit)
      .map(op => ({
        id: op.id,
        type: op.type,
        duration: op.duration,
        metadata: op.metadata
      }));
  }

  reset() {
    this.metrics = {
      totalLatency: 0,
      apiCalls: 0,
      computeTime: 0,
      operations: [],
      goals: new Map()
    };
    this.goalMetrics.clear();
  }
}

export class ExecutionBudgetController {
  constructor(options = {}) {
    this.maxLatency = options.maxLatency || 30000;
    this.maxApiCalls = options.maxApiCalls || 100;
    this.maxComputeTime = options.maxComputeTime || 60000;
    this.maxCost = options.maxCost || 10;
    
    this.sessionStart = Date.now();
    this.used = {
      latency: 0,
      apiCalls: 0,
      computeTime: 0,
      cost: 0
    };
    
    this.budgetHistory = [];
  }

  canExecute(estimatedCost = 1) {
    const willExceedLatency = (this.used.latency + estimatedCost * 100) > this.maxLatency;
    const willExceedApi = (this.used.apiCalls + 1) > this.maxApiCalls;
    const willExceedCompute = (this.used.computeTime + estimatedCost * 1000) > this.maxComputeTime;
    const willExceedCost = (this.used.cost + estimatedCost) > this.maxCost;

    return !willExceedLatency && !willExceedApi && !willExceedCompute && !willExceedCost;
  }

  reserveBudget(estimatedCost = 1) {
    if (!this.canExecute(estimatedCost)) {
      return false;
    }

    this.used.cost += estimatedCost;
    this.budgetHistory.push({
      action: "reserve",
      cost: estimatedCost,
      remaining: this.maxCost - this.used.cost,
      timestamp: Date.now()
    });

    return true;
  }

  recordLatency(duration) {
    this.used.latency += duration;
  }

  recordApiCall() {
    this.used.apiCalls++;
  }

  recordComputeTime(duration) {
    this.used.computeTime += duration;
  }

  commitCost(actualCost) {
    const diff = actualCost - (this.used.cost > 0 ? 1 : 0);
    if (diff > 0) {
      this.used.cost += diff;
    }
  }

  rollbackCost(estimatedCost) {
    this.used.cost = Math.max(0, this.used.cost - estimatedCost);
  }

  getRemaining() {
    return {
      latency: Math.max(0, this.maxLatency - this.used.latency),
      apiCalls: Math.max(0, this.maxApiCalls - this.used.apiCalls),
      computeTime: Math.max(0, this.maxComputeTime - this.used.computeTime),
      cost: Math.max(0, this.maxCost - this.used.cost)
    };
  }

  getUsage() {
    return {
      latency: this.used.latency,
      apiCalls: this.used.apiCalls,
      computeTime: this.used.computeTime,
      cost: this.used.cost,
      utilization: {
        latency: this.used.latency / this.maxLatency,
        apiCalls: this.used.apiCalls / this.maxApiCalls,
        computeTime: this.used.computeTime / this.maxComputeTime,
        cost: this.used.cost / this.maxCost
      }
    };
  }

  isExhausted() {
    return this.used.latency >= this.maxLatency ||
           this.used.apiCalls >= this.maxApiCalls ||
           this.used.computeTime >= this.maxComputeTime ||
           this.used.cost >= this.maxCost;
  }

  reset() {
    this.sessionStart = Date.now();
    this.used = {
      latency: 0,
      apiCalls: 0,
      computeTime: 0,
      cost: 0
    };
    this.budgetHistory = [];
  }
}

export class WorkerPool {
  constructor(options = {}) {
    this.maxWorkers = options.maxWorkers || 5;
    this.workerTimeout = options.workerTimeout || 30000;
    
    this.workers = new Map();
    this.taskQueue = [];
    this.runningTasks = new Map();
    
    this.workerIdCounter = 0;
    this.taskIdCounter = 0;
  }

  async executeTask(name, taskFn, payload) {
    const taskId = `task_${this.taskIdCounter++}`;
    
    const task = {
      id: taskId,
      name,
      payload,
      fn: taskFn,
      status: "pending",
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null
    };

    const availableWorker = this.findAvailableWorker();
    
    if (availableWorker) {
      return this.runTaskOnWorker(availableWorker, task);
    } else if (this.runningTasks.size < this.maxWorkers) {
      return this.runTaskOnNewWorker(task);
    } else {
      return this.queueTask(task);
    }
  }

  findAvailableWorker() {
    for (const [id, worker] of this.workers) {
      if (!worker.busy) return id;
    }
    return null;
  }

  runTaskOnNewWorker(task) {
    const workerId = `worker_${this.workerIdCounter++}`;
    const worker = {
      id: workerId,
      busy: false,
      currentTask: null
    };
    
    this.workers.set(workerId, worker);
    return this.runTaskOnWorker(workerId, task);
  }

  async runTaskOnWorker(workerId, task) {
    const worker = this.workers.get(workerId);
    worker.busy = true;
    worker.currentTask = task.id;
    
    task.status = "running";
    task.startedAt = Date.now();
    this.runningTasks.set(task.id, task);

    try {
      const result = await Promise.race([
        task.fn(task.payload),
        this.createTimeout(task.id)
      ]);

      task.status = "completed";
      task.completedAt = Date.now();
      task.result = result;

      return result;
    } catch (error) {
      task.status = "failed";
      task.completedAt = Date.now();
      task.error = error.message;
      
      throw error;
    } finally {
      worker.busy = false;
      worker.currentTask = null;
      this.runningTasks.delete(task.id);
      
      this.processQueue();
    }
  }

  queueTask(task) {
    return new Promise((resolve, reject) => {
      task.status = "queued";
      this.taskQueue.push({ task, resolve, reject });
    });
  }

  async processQueue() {
    while (this.taskQueue.length > 0) {
      const availableWorker = this.findAvailableWorker();
      if (!availableWorker) break;

      const { task, resolve, reject } = this.taskQueue.shift();
      
      try {
        const result = await this.runTaskOnWorker(availableWorker, task);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
  }

  createTimeout(taskId) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task ${taskId} timed out`));
      }, this.workerTimeout);
    });
  }

  getStats() {
    return {
      workers: this.workers.size,
      busyWorkers: Array.from(this.workers.values()).filter(w => w.busy).length,
      queuedTasks: this.taskQueue.length,
      runningTasks: this.runningTasks.size
    };
  }

  getWorkerStatus() {
    return Array.from(this.workers.values()).map(w => ({
      id: w.id,
      busy: w.busy,
      currentTask: w.currentTask
    }));
  }
}

export class ObservabilityLayer {
  constructor(options = {}) {
    this.enableTracing = options.enableTracing !== false;
    this.enableAudit = options.enableAudit !== false;
    this.maxTraceEntries = options.maxTraceEntries || 1000;
    
    this.traces = [];
    this.auditLog = [];
    this.spans = new Map();
    this.spanIdCounter = 0;
  }

  createSpan(name, parentId = null) {
    const spanId = `span_${this.spanIdCounter++}`;
    const span = {
      id: spanId,
      name,
      parentId,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      metadata: {},
      events: []
    };
    
    this.spans.set(spanId, span);
    
    if (this.enableTracing) {
      this.traces.push(span);
      if (this.traces.length > this.maxTraceEntries) {
        this.traces.shift();
      }
    }
    
    return spanId;
  }

  endSpan(spanId, metadata = {}) {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.metadata = { ...span.metadata, ...metadata };
  }

  addSpanEvent(spanId, event) {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.events.push({
      name: event,
      timestamp: Date.now()
    });
  }

  recordAudit(action, details) {
    if (!this.enableAudit) return;

    this.auditLog.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      action,
      details,
      timestamp: Date.now()
    });

    if (this.auditLog.length > this.maxTraceEntries) {
      this.auditLog.shift();
    }
  }

  getTrace(traceId) {
    return this.traces.filter(t => t.id === traceId);
  }

  getRecentTraces(limit = 20) {
    return this.traces.slice(-limit).map(span => ({
      id: span.id,
      name: span.name,
      duration: span.duration,
      metadata: span.metadata
    }));
  }

  getRecentAudit(limit = 50) {
    return this.auditLog.slice(-limit);
  }

  getSpanTree() {
    const roots = [];
    const map = new Map();

    for (const span of this.spans.values()) {
      map.set(span.id, { ...span, children: [] });
    }

    for (const span of map.values()) {
      if (span.parentId && map.has(span.parentId)) {
        map.get(span.parentId).children.push(span);
      } else {
        roots.push(span);
      }
    }

    return roots;
  }

  getStats() {
    return {
      totalTraces: this.traces.length,
      activeSpans: this.spans.size,
      auditEntries: this.auditLog.length
    };
  }

  reset() {
    this.traces = [];
    this.auditLog = [];
    this.spans.clear();
  }
}
