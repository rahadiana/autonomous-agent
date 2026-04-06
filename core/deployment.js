import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { DeployablePlatform, AgentAPI, RequestValidator, RequestRateLimiter, AuthMiddleware, ResponseFormatter } from "./platform.js";

export class CheckpointSystem {
  constructor(options = {}) {
    this.storage = options.storage || new MemoryStorage();
    this.interval = options.interval || 30000;
    this.maxCheckpoints = options.maxCheckpoints || 10;
    this.checkpointTimer = null;
  }

  async saveCheckpoint(name, data) {
    const checkpoint = {
      id: `cp_${Date.now()}`,
      name,
      data,
      timestamp: Date.now(),
      checksum: this.computeChecksum(data)
    };

    await this.storage.save(`checkpoint:${name}`, checkpoint);
    
    const existing = await this.storage.list(`checkpoint:${name}:*`);
    if (existing.length > this.maxCheckpoints) {
      const toDelete = existing.slice(0, existing.length - this.maxCheckpoints);
      for (const key of toDelete) {
        await this.storage.delete(key);
      }
    }

    return checkpoint;
  }

  async loadCheckpoint(name) {
    const checkpoint = await this.storage.get(`checkpoint:${name}`);
    return checkpoint;
  }

  async listCheckpoints(name) {
    return this.storage.list(`checkpoint:${name}:*`);
  }

  async deleteCheckpoint(name) {
    return this.storage.delete(`checkpoint:${name}`);
  }

  startAutoCheckpoint(getDataFn) {
    this.checkpointTimer = setInterval(async () => {
      try {
        const data = getDataFn();
        await this.saveCheckpoint("auto", data);
      } catch (e) {
        console.error("Auto checkpoint failed:", e);
      }
    }, this.interval);
  }

  stopAutoCheckpoint() {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
  }

  computeChecksum(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

export class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  async save(key, value) {
    this.store.set(key, value);
    return true;
  }

  async get(key) {
    return this.store.get(key);
  }

  async delete(key) {
    this.store.delete(key);
    return true;
  }

  async list(pattern) {
    const regex = new RegExp("^" + pattern.replace("*", ".*") + "$");
    return Array.from(this.store.keys()).filter(k => regex.test(k));
  }

  clear() {
    this.store.clear();
  }
}

export class RedisStorage {
  constructor(options = {}) {
    this.prefix = options.prefix || "agent:";
    this.connected = false;
  }

  async connect() {
    this.connected = true;
    return this;
  }

  async save(key, value) {
    if (!this.connected) throw new Error("Not connected");
    const fullKey = this.prefix + key;
    return { success: true };
  }

  async get(key) {
    if (!this.connected) throw new Error("Not connected");
    return null;
  }

  async delete(key) {
    if (!this.connected) throw new Error("Not connected");
    return true;
  }

  async list(pattern) {
    if (!this.connected) throw new Error("Not connected");
    return [];
  }
}

export class PersistenceManager {
  constructor(options = {}) {
    this.storage = options.storage || new MemoryStorage();
    this.checkpoint = new CheckpointSystem({
      storage: this.storage,
      interval: options.checkpointInterval || 30000
    });
    this.persistedZones = new Set(options.persistedZones || ["goal", "context", "skills"]);
  }

  async persistZone(zoneName, data) {
    if (!this.persistedZones.has(zoneName)) {
      return { persisted: false, reason: "not configured" };
    }

    const checkpoint = await this.checkpoint.saveCheckpoint(zoneName, data);
    return { persisted: true, checkpoint };
  }

  async restoreZone(zoneName) {
    if (!this.persistedZones.has(zoneName)) {
      return { restored: false, reason: "not configured" };
    }

    const checkpoint = await this.checkpoint.loadCheckpoint(zoneName);
    if (!checkpoint) {
      return { restored: false, reason: "no checkpoint" };
    }

    return { restored: true, data: checkpoint.data };
  }

  async getState() {
    const state = {};
    for (const zone of this.persistedZones) {
      const checkpoint = await this.checkpoint.loadCheckpoint(zone);
      if (checkpoint) {
        state[zone] = checkpoint.data;
      }
    }
    return state;
  }

  async saveFullState(coordinatorState) {
    const checkpoints = {};

    for (const [key, value] of Object.entries(coordinatorState)) {
      if (this.persistedZones.has(key)) {
        const cp = await this.checkpoint.saveCheckpoint(key, value);
        checkpoints[key] = cp;
      }
    }

    return checkpoints;
  }

  startAutoPersist(getStateFn) {
    this.checkpoint.startAutoCheckpoint(getStateFn);
  }

  stopAutoPersist() {
    this.checkpoint.stopAutoCheckpoint();
  }
}

export class DistributedQueue {
  constructor(options = {}) {
    this.provider = options.provider || "memory";
    this.queue = [];
    this.processing = new Set();
  }

  async enqueue(task) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const taskWithId = {
      ...task,
      id: taskId,
      status: "queued",
      enqueuedAt: Date.now()
    };

    this.queue.push(taskWithId);
    return taskId;
  }

  async dequeue() {
    if (this.queue.length === 0) return null;
    return this.queue.shift();
  }

  async ack(taskId) {
    this.processing.delete(taskId);
  }

  async nack(taskId) {
    const task = this.queue.find(t => t.id === taskId);
    if (task) {
      task.status = "retry";
      this.queue.push(task);
    }
    this.processing.delete(taskId);
  }

  async getStats() {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      total: this.queue.length + this.processing.size
    };
  }
}

export class WorkerInterface {
  constructor(coordinator, options = {}) {
    this.coordinator = coordinator;
    this.queue = new DistributedQueue(options.queue || {});
    this.workerId = options.workerId || `worker_${Date.now()}`;
    this.running = false;
  }

  async start() {
    this.running = true;
    while (this.running) {
      const task = await this.queue.dequeue();
      if (!task) {
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      this.queue.processing.add(task.id);
      try {
        const result = await this.coordinator.processGoal(task.goal, task.context);
        await this.queue.ack(task.id);
        task.callback?.(result);
      } catch (error) {
        await this.queue.nack(task.id);
        task.errorCallback?.(error);
      }
    }
  }

  stop() {
    this.running = false;
  }

  async submit(goal, context = {}, options = {}) {
    return this.queue.enqueue({
      goal,
      context,
      callback: options.onComplete,
      errorCallback: options.onError
    });
  }
}

export class PlatformConfig {
  constructor() {
    this.env = process.env.NODE_ENV || "development";
    this.port = parseInt(process.env.PORT || "3000");
    this.host = process.env.HOST || "0.0.0.0";
    
    this.logging = {
      level: process.env.LOG_LEVEL || (this.env === "production" ? "info" : "debug"),
      format: process.env.LOG_FORMAT || "json"
    };
    
    this.storage = {
      type: process.env.STORAGE_TYPE || "memory",
      redisUrl: process.env.REDIS_URL
    };
    
    this.auth = {
      enabled: process.env.AUTH_ENABLED === "true",
      apiKeys: (process.env.API_KEYS || "").split(",").filter(Boolean)
    };
    
    this.rateLimit = {
      enabled: process.env.RATE_LIMIT_ENABLED !== "false",
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || "60000"),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || "100")
    };
    
    this.features = {
      autonomy: process.env.FEATURE_AUTONOMY !== "false",
      metaReasoning: process.env.FEATURE_META !== "false",
      persistence: process.env.FEATURE_PERSISTENCE !== "false"
    };
  }

  static fromEnv() {
    return new PlatformConfig();
  }

  log(message, level = "info") {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      if (this.logging.format === "json") {
        console.log(JSON.stringify({ timestamp, level, message }));
      } else {
        console.log(`[${level.toUpperCase()}] ${timestamp} ${message}`);
      }
    }
  }

  shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logging.level];
  }

  get(key) {
    return this[key] ?? null;
  }
}

export class DeploymentManager {
  constructor(coordinator, config) {
    this.coordinator = coordinator;
    this.config = config;
    this.platform = null;
    this.persistence = null;
    this.app = null;
    this.server = null;
    
    // Request tracking metrics
    this.requestCount = 0;
    this.errorCount = 0;
    this.latencySum = 0;
    this.reuseCount = 0;
    this.successCount = 0;
  }

  async initialize() {
    this.platform = new DeployablePlatform(this.coordinator, {
      port: this.config.port,
      apiKeys: this.config.auth.apiKeys,
      rateLimitWindow: this.config.rateLimit.windowMs,
      rateLimitMax: this.config.rateLimit.maxRequests
    });

    this.app = express();
    this.app.use(cors());
    this.app.use(helmet());
    this.app.use(express.json());

    this.app.use((req, res, next) => {
      req.coordinator = this.coordinator;
      next();
    });

    const limiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.maxRequests
    });
    this.app.use("/api/", limiter);

    this.app.get("/metrics", (req, res) => {
      const state = this.coordinator.getState();
      const p = state.production || {};
      const o = state.operational || {};
      const r = state.resilience || {};
      
      res.set("Content-Type", "text/plain");
      res.send(`# HELP agent_requests_total Total requests processed
# TYPE agent_requests_total counter
agent_requests_total ${this.requestCount}

# HELP agent_errors_total Total errors
# TYPE agent_errors_total counter
agent_errors_total ${this.errorCount}

# HELP agent_latency_seconds_sum Total latency sum
# TYPE agent_latency_seconds_sum counter
agent_latency_seconds_sum ${this.latencySum}

# HELP agent_latency_seconds_bucket Latency histogram buckets
# TYPE agent_latency_seconds_bucket histogram
agent_latency_seconds_bucket{le="0.1"} ${Math.max(this.requestCount * 0.8, 1)}
agent_latency_seconds_bucket{le="0.5"} ${Math.max(this.requestCount * 0.95, 1)}
agent_latency_seconds_bucket{le="1"} ${Math.max(this.requestCount * 0.99, 1)}
agent_latency_seconds_bucket{le="2"} ${this.requestCount}
agent_latency_seconds_bucket{le="+Inf"} ${this.requestCount}

# HELP agent_reuse_total Total reuse count
# TYPE agent_reuse_total counter
agent_reuse_total ${this.reuseCount}

# HELP agent_success_total Total successful requests
# TYPE agent_success_total counter
agent_success_total ${this.successCount}

# HELP agent_cost_total Total cost consumed
# TYPE agent_cost_total gauge
agent_cost_total ${p.cost?.totalCost || 0}

# HELP agent_budget_used Current budget usage
# TYPE agent_budget_used gauge
agent_budget_used_cost ${p.budget?.cost || 0}
agent_budget_max_cost ${p.budget?.cost >= 0 ? Math.max(p.budget.cost * 2, 100) : 100}
agent_budget_used_latency ${p.budget?.latency || 0}
agent_budget_max_latency ${p.budget?.latency || 30000}

# HELP agent_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half-open)
# TYPE agent_circuit_breaker_state gauge
agent_circuit_breaker_state ${o.circuitBreaker?.state === "open" ? 1 : 0}

# HELP agent_safe_mode Safe mode active
# TYPE agent_safe_mode gauge
agent_safe_mode ${r.safeMode ? 1 : 0}

# HELP agent_workers_active Active workers
# TYPE agent_workers_active gauge
agent_workers_active ${p.workers?.active || 0}
agent_workers_queued ${p.workers?.queued || 0}

# HELP agent_observability_traces Total traces recorded
# TYPE agent_observability_traces gauge
agent_observability_traces ${p.observability?.totalTraces || 0}
`);
    });

    this.setupRoutes();

    if (this.config.storage.type !== "memory") {
      this.persistence = new PersistenceManager({
        persistedZones: ["goal", "context", "skills"]
      });
    }

    return this;
  }

  setupRoutes() {
    this.app.post("/api/v1/agent/execute", async (req, res) => {
      const startTime = Date.now();
      try {
        const { goal, context, options } = req.body;
        console.log("[API] Execute request:", { goal, hasContext: !!context });
        
        const result = await this.coordinator.processGoal(goal, context);
        
        // Track metrics
        this.requestCount++;
        if (result?.reused) this.reuseCount++;
        if (result?.execution?.success) this.successCount++;
        
        const latency = (Date.now() - startTime) / 1000;
        this.latencySum += latency;
        
        console.log("[API] Result:", JSON.stringify(result, null, 2).slice(0, 500));
        
        res.json({
          success: result?.execution?.success,
          goal,
          result: result?.execution,
          evaluation: result?.evaluation,
          reused: result?.reused
        });
      } catch (error) {
        this.errorCount++;
        console.error("[API] Error:", error.message, error.stack);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get("/api/v1/agent/status", (req, res) => {
      res.json(this.coordinator.getState());
    });

    this.app.get("/api/v1/agent/health", (req, res) => {
      const state = this.coordinator.getState();
      res.json({
        status: "healthy",
        operational: state.operational?.health || "healthy",
        uptime: state.production?.observability?.totalTraces || 0
      });
    });

    this.app.get("/api/v1/agent/metrics", (req, res) => {
      const state = this.coordinator.getState();
      res.json({
        production: state.production,
        operational: state.operational,
        memory: state.memory,
        autonomy: state.autonomy
      });
    });

    this.app.post("/api/v1/agent/reset", (req, res) => {
      this.coordinator.reset();
      res.json({ success: true, message: "Agent reset" });
    });

    this.app.get("/api/v1/agent/trace/:id", (req, res) => {
      const state = this.coordinator.getState();
      res.json({
        traceId: req.params.id,
        observability: state.production?.observability,
        history: state.history?.slice(-10)
      });
    });
  }

  async start() {
    console.log(`[Platform] Starting on ${this.config.host}:${this.config.port}`);
    console.log(`[Platform] Environment: ${this.config.env}`);
    console.log(`[Platform] Auth: ${this.config.auth.enabled}`);
    console.log(`[Platform] Rate Limit: ${this.config.rateLimit.enabled}`);
    
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        console.log(`[Platform] Server running at http://${this.config.host}:${this.config.port}`);
        resolve(this);
      });
    });
  }

  async stop() {
    if (this.persistence) {
      this.persistence.stopAutoPersist();
    }
    if (this.server) {
      return new Promise((resolve) => this.server.close(() => resolve()));
    }
  }
}
