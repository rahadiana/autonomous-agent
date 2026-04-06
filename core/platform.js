export class AgentAPI {
  constructor(coordinator, options = {}) {
    this.coordinator = coordinator;
    this.port = options.port || 3000;
    this.basePath = options.basePath || "/api/v1";
    this.routes = {};
  }

  async handleRequest(req) {
    const { method, path, body, query, headers } = req;
    
    const route = this.findRoute(path, method);
    if (!route) {
      return { status: 404, body: { error: "Not found" } };
    }

    try {
      const result = await route.handler({
        params: route.params,
        body,
        query,
        headers,
        coordinator: this.coordinator
      });
      return { status: 200, body: result };
    } catch (error) {
      return { status: 500, body: { error: error.message } };
    }
  }

  findRoute(path, method) {
    for (const [routeKey, route] of Object.entries(this.routes)) {
      const [routeMethod, routePath] = routeKey.split(" ");
      if (routeMethod !== method) continue;

      const params = this.matchPath(routePath, path);
      if (params !== null) {
        return { ...route, params };
      }
    }
    return null;
  }

  matchPath(routePath, requestPath) {
    const routeParts = routePath.split("/");
    const requestParts = requestPath.split("?").shift().split("/");
    
    if (routePath === requestPath) return {};

    const params = {};
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(":")) {
        params[routeParts[i].slice(1)] = requestParts[i];
      } else if (routeParts[i] !== requestParts[i]) {
        return null;
      }
    }

    return params;
  }

  registerRoute(method, path, handler) {
    this.routes[`${method} ${path}`] = { method, path, handler };
  }

  registerDefaultRoutes() {
    this.registerRoute("POST", "/agent/execute", async ({ body, coordinator }) => {
      const { goal, context, options } = body;
      
      const result = await coordinator.processGoal(goal, context);
      
      return {
        success: result?.execution?.success,
        goal,
        result: result?.execution,
        evaluation: result?.evaluation,
        reused: result?.reused
      };
    });

    this.registerRoute("GET", "/agent/status", async ({ coordinator }) => {
      return coordinator.getState();
    });

    this.registerRoute("GET", "/agent/trace/:id", async ({ params, coordinator }) => {
      const state = coordinator.getState();
      return {
        traceId: params.id,
        observability: state.production?.observability,
        history: state.history?.slice(-10)
      };
    });

    this.registerRoute("GET", "/agent/memory", async ({ coordinator }) => {
      return coordinator.getMemoryStats();
    });

    this.registerRoute("POST", "/agent/skill", async ({ body, coordinator }) => {
      const { name, capability, logic } = body;
      coordinator.registerSkill({ name, capability, logic });
      return { success: true, message: "Skill registered" };
    });

    this.registerRoute("GET", "/agent/health", async ({ coordinator }) => {
      const state = coordinator.getState();
      return {
        status: "healthy",
        operational: state.operational?.health || "healthy",
        uptime: state.production?.observability?.totalTraces || 0
      };
    });

    this.registerRoute("POST", "/agent/reset", async ({ coordinator }) => {
      coordinator.reset();
      return { success: true, message: "Agent reset" };
    });

    this.registerRoute("GET", "/agent/metrics", async ({ coordinator }) => {
      const state = coordinator.getState();
      return {
        production: state.production,
        operational: state.operational,
        memory: state.memory,
        autonomy: state.autonomy
      };
    });
  }
}

export class RequestValidator {
  validateExecuteRequest(body) {
    const errors = [];
    
    if (!body.goal) {
      errors.push("goal is required");
    }
    
    if (body.goal && typeof body.goal !== "string") {
      errors.push("goal must be a string");
    }

    if (body.context && typeof body.context !== "object") {
      errors.push("context must be an object");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateSkillRegistration(body) {
    const errors = [];

    if (!body.name) errors.push("name is required");
    if (!body.capability) errors.push("capability is required");
    if (!body.logic) errors.push("logic is required");

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export class ResponseFormatter {
  static success(data, meta = {}) {
    return {
      success: true,
      data,
      meta: {
        timestamp: Date.now(),
        ...meta
      }
    };
  }

  static error(message, code = "ERROR", details = {}) {
    return {
      success: false,
      error: {
        message,
        code,
        details,
        timestamp: Date.now()
      }
    };
  }

  static paginated(data, page, limit, total) {
    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

export class RequestRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 100;
    this.userRequests = new Map();
  }

  check(userId) {
    const now = Date.now();
    const userKey = userId || "anonymous";
    
    let requests = this.userRequests.get(userKey) || [];
    requests = requests.filter(t => now - t < this.windowMs);
    
    if (requests.length >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetIn: this.windowMs };
    }
    
    requests.push(now);
    this.userRequests.set(userKey, requests);
    
    return {
      allowed: true,
      remaining: this.maxRequests - requests.length,
      resetIn: this.windowMs
    };
  }

  reset(userId) {
    this.userRequests.delete(userId);
  }
}

export class AuthMiddleware {
  constructor(options = {}) {
    this.apiKeys = new Set(options.apiKeys || []);
    this.jwtSecret = options.jwtSecret;
  }

  validateApiKey(apiKey) {
    if (this.apiKeys.size === 0) return true;
    return this.apiKeys.has(apiKey);
  }

  validateToken(token) {
    if (!this.jwtSecret) return true;
    try {
      return true;
    } catch {
      return false;
    }
  }

  authenticate(headers) {
    const apiKey = headers["x-api-key"];
    const auth = headers["authorization"];

    if (apiKey && this.validateApiKey(apiKey)) {
      return { valid: true, user: "api-key-user" };
    }

    if (auth && auth.startsWith("Bearer ")) {
      const token = auth.slice(7);
      if (this.validateToken(token)) {
        return { valid: true, user: "token-user" };
      }
    }

    return { valid: false, error: "Authentication required" };
  }
}

export class DeployablePlatform {
  constructor(coordinator, options = {}) {
    this.coordinator = coordinator;
    this.api = new AgentAPI(coordinator, options);
    this.validator = new RequestValidator();
    this.rateLimiter = new RequestRateLimiter({
      windowMs: options.rateLimitWindow || 60000,
      maxRequests: options.rateLimitMax || 100
    });
    this.auth = new AuthMiddleware({
      apiKeys: options.apiKeys || []
    });
    this.api.registerDefaultRoutes();
  }

  async handleRequest(req) {
    const { headers, ...rest } = req;

    const auth = this.auth.authenticate(headers);
    if (!auth.valid) {
      return { status: 401, body: ResponseFormatter.error("Unauthorized", "AUTH_FAILED") };
    }

    const rateLimit = this.rateLimiter.check(auth.user);
    if (!rateLimit.allowed) {
      return {
        status: 429,
        body: ResponseFormatter.error("Rate limit exceeded", "RATE_LIMIT", {
          resetIn: rateLimit.resetIn
        })
      };
    }

    return this.api.handleRequest({ ...rest, headers });
  }

  getStatus() {
    return {
      api: "running",
      coordinator: "healthy",
      rateLimit: this.rateLimiter.userRequests.size
    };
  }
}
