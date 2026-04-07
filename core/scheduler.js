export const Status = {
  PLANNING: "planning",
  EXECUTING: "executing",
  CRITIC: "critic",
  RETRY: "retry",
  ERROR: "error",
  DONE: "done"
};

export class ControlScheduler {
  constructor(blackboard, options = {}) {
    this.blackboard = blackboard;
    this.maxCycles = options.maxCycles || 100;
    this.cycleDelay = options.cycleDelay || 100;
    this.agents = new Map();
    this.running = false;
    this.currentAgent = null;
  }

  registerAgent(name, handler) {
    this.agents.set(name, handler);
  }

  async selectAgent() {
    const currentStatus = this.blackboard.getStatus();
    
    const agentPriority = {
      [Status.PLANNING]: ["planner"],
      [Status.EXECUTING]: ["executor"],
      [Status.CRITIC]: ["critic"],
      [Status.RETRY]: ["executor", "planner"],
      [Status.ERROR]: ["recovery"],
      [Status.DONE]: []
    };

    const priorities = agentPriority[currentStatus] || [];
    
    for (const agentName of priorities) {
      if (this.agents.has(agentName)) {
        return agentName;
      }
    }

    return priorities[0] || null;
  }

  async run() {
    this.running = true;
    let cycle = 0;

    while (this.running && cycle < this.maxCycles) {
      const status = this.blackboard.getStatus();
      
      if (status === Status.DONE) {
        break;
      }

      const agentName = await this.selectAgent();
      
      if (!agentName) {
        this.running = false;
        break;
      }

      const agent = this.agents.get(agentName);
      this.currentAgent = agentName;

      try {
        await agent(this.blackboard);
      } catch (err) {
        this.blackboard.setStatus(Status.ERROR, err.message);
      }

      if (this.blackboard.isTimeout()) {
        this.running = false;
        break;
      }

      cycle++;
      
      if (this.cycleDelay > 0) {
        await new Promise(r => setTimeout(r, this.cycleDelay));
      }
    }

    return {
      cycles: cycle,
      status: this.blackboard.getStatus(),
      converged: this.blackboard.getStatus() === Status.DONE
    };
  }

  stop() {
    this.running = false;
  }

  getCurrentAgent() {
    return this.currentAgent;
  }

  isRunning() {
    return this.running;
  }
}

export function createControlScheduler(blackboard, options = {}) {
  return new ControlScheduler(blackboard, options);
}

export const Priority = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
  IDLE: 10
};

export const TaskStatus = {
  PENDING: "pending",
  READY: "ready",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled"
};

export class Task {
  constructor(id, name, priority, payload) {
    this.id = id;
    this.name = name;
    this.priority = priority;
    this.payload = payload;
    this.status = TaskStatus.PENDING;
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.result = null;
    this.error = null;
    this.retries = 0;
    this.maxRetries = 3;
    this.dependencies = [];
    this.dependenciesMet = false;
  }

  canExecute() {
    if (this.status !== TaskStatus.PENDING && this.status !== TaskStatus.READY) {
      return false;
    }

    if (!this.dependenciesMet) {
      return false;
    }

    return true;
  }

  start() {
    this.status = TaskStatus.RUNNING;
    this.startedAt = Date.now();
  }

  complete(result) {
    this.status = TaskStatus.COMPLETED;
    this.completedAt = Date.now();
    this.result = result;
  }

  fail(error, canRetry = true) {
    if (canRetry && this.retries < this.maxRetries) {
      this.retries++;
      this.status = TaskStatus.READY;
    } else {
      this.status = TaskStatus.FAILED;
      this.completedAt = Date.now();
      this.error = error;
    }
  }

  cancel() {
    this.status = TaskStatus.CANCELLED;
    this.completedAt = Date.now();
  }

  addDependency(taskId) {
    if (!this.dependencies.includes(taskId)) {
      this.dependencies.push(taskId);
    }
  }

  checkDependencies(taskRegistry) {
    for (const depId of this.dependencies) {
      const depTask = taskRegistry.get(depId);
      if (!depTask || depTask.status !== TaskStatus.COMPLETED) {
        return false;
      }
    }
    this.dependenciesMet = true;
    this.status = TaskStatus.READY;
    return true;
  }

  getExecutionTime() {
    if (!this.startedAt || !this.completedAt) return null;
    return this.completedAt - this.startedAt;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      priority: this.priority,
      status: this.status,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      result: this.result,
      error: this.error,
      retries: this.retries,
      dependencies: this.dependencies
    };
  }
}

export class PriorityScheduler {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 3;
    this.timeSlice = options.timeSlice || 100;
    this.taskTimeout = options.taskTimeout || 30000;
    
    this.tasks = new Map();
    this.runningTasks = new Map();
    this.completedTasks = new Map();
    this.failedTasks = new Map();
    
    this.taskQueue = [];
    this.executionCallbacks = new Map();
    
    this.running = false;
    this.schedulerInterval = null;
    this.nextTaskId = 1;
  }

  generateTaskId() {
    return `task_${this.nextTaskId++}_${Date.now()}`;
  }

  enqueue(taskOrConfig) {
    let task;

    if (taskOrConfig instanceof Task) {
      task = taskOrConfig;
    } else {
      const { name, priority, payload, dependencies, maxRetries } = taskOrConfig;
      task = new Task(
        this.generateTaskId(),
        name,
        priority || Priority.MEDIUM,
        payload
      );

      if (maxRetries !== undefined) {
        task.maxRetries = maxRetries;
      }

      if (dependencies && Array.isArray(dependencies)) {
        for (const dep of dependencies) {
          task.addDependency(dep);
        }
      }
    }

    this.tasks.set(task.id, task);
    this.insertIntoQueue(task);
    
    return task.id;
  }

  insertIntoQueue(task) {
    const index = this.taskQueue.findIndex(t => t.priority < task.priority);
    if (index === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(index, 0, task);
    }
  }

  registerExecutionCallback(taskName, callback) {
    this.executionCallbacks.set(taskName, callback);
  }

  async executeTask(task) {
    const callback = this.executionCallbacks.get(task.name);
    
    if (!callback) {
      task.fail(new Error(`No handler for task: ${task.name}`), false);
      return;
    }

    task.start();
    this.runningTasks.set(task.id, task);

    try {
      const result = await Promise.race([
        callback(task.payload),
        this.createTimeout(task.id)
      ]);

      task.complete(result);
      this.completedTasks.set(task.id, task);
      this.runningTasks.delete(task.id);

      this.updateDependentTasks(task.id);
      
      return result;
    } catch (error) {
      task.fail(error.message || String(error));
      this.runningTasks.delete(task.id);
      
      if (task.status === TaskStatus.FAILED) {
        this.failedTasks.set(task.id, task);
      }
    }
  }

  createTimeout(taskId) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task ${taskId} timed out`));
      }, this.taskTimeout);
    });
  }

  updateDependentTasks(completedTaskId) {
    for (const [taskId, task] of this.tasks) {
      if (task.dependencies.includes(completedTaskId)) {
        task.checkDependencies(this.tasks);
      }
    }
  }

  async start() {
    if (this.running) return;
    this.running = true;

    this.schedulerInterval = setInterval(async () => {
      await this.tick();
    }, this.timeSlice);
  }

  stop() {
    this.running = false;
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  async tick() {
    this.running = true;

    const canRunMore = this.runningTasks.size < this.maxConcurrent;
    if (!canRunMore) return;

    const availableSlots = this.maxConcurrent - this.runningTasks.size;

    for (let i = 0; i < availableSlots; i++) {
      const readyTask = this.taskQueue.find(t => t.canExecute());
      
      if (!readyTask) break;
      
      const queueIndex = this.taskQueue.indexOf(readyTask);
      this.taskQueue.splice(queueIndex, 1);
      
      await this.executeTask(readyTask);
    }
  }

  getTask(taskId) {
    return this.tasks.get(taskId) || 
           this.runningTasks.get(taskId) || 
           this.completedTasks.get(taskId) ||
           this.failedTasks.get(taskId);
  }

  getPendingTasks() {
    return this.taskQueue.map(t => t.toJSON());
  }

  getRunningTasks() {
    return Array.from(this.runningTasks.values()).map(t => t.toJSON());
  }

  getCompletedTasks() {
    return Array.from(this.completedTasks.values()).map(t => t.toJSON());
  }

  getFailedTasks() {
    return Array.from(this.failedTasks.values()).map(t => t.toJSON());
  }

  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.cancel();
      return true;
    }
    return false;
  }

  updatePriority(taskId, newPriority) {
    const task = this.getTask(taskId);
    if (task && (task.status === TaskStatus.PENDING || task.status === TaskStatus.READY)) {
      task.priority = newPriority;
      
      const queueIndex = this.taskQueue.indexOf(task);
      if (queueIndex > -1) {
        this.taskQueue.splice(queueIndex, 1);
        this.insertIntoQueue(task);
      }
      
      return true;
    }
    return false;
  }

  getStats() {
    return {
      pending: this.taskQueue.length,
      running: this.runningTasks.size,
      completed: this.completedTasks.size,
      failed: this.failedTasks.size,
      total: this.tasks.size
    };
  }

  clearCompleted() {
    this.completedTasks.clear();
  }

  clearFailed() {
    this.failedTasks.clear();
  }
}
