export const SUPPORTED_OPS = new Set([
  "get", "set", "add", "subtract", "multiply", "divide", "concat", "mcp_call",
  "compare", "if", "jump", "call_skill", "map"
]);

const MAX_CALL_DEPTH = 3;

const COMPARE_OPS = new Set(["==", "!=", ">", "<", ">=", "<="]);

const ALLOWED_MCP_TOOLS = ["http.get", "http.post", "json.parse"];

const DEFAULT_MEMORY_LIMIT = 1000;
const MAX_STEPS = 50;
const MCP_RATE_LIMIT_MS = 200;

let lastMCPCall = 0;

export class MCPTools {
  constructor() {
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;
  }

  async httpGet(args) {
    await this.rateLimit();
    const fetch = (await import("node-fetch")).default;
    const res = await fetch(args.url);
    return { status: res.status, body: await res.text() };
  }

  async httpPost(args) {
    await this.rateLimit();
    const fetch = (await import("node-fetch")).default;
    const res = await fetch(args.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args.body)
    });
    return { status: res.status, body: await res.text() };
  }

  jsonParse(args) {
    try {
      return JSON.parse(args.text);
    } catch {
      return null;
    }
  }

  async rateLimit() {
    const now = Date.now();
    const elapsed = now - lastMCPCall;
    if (elapsed < MCP_RATE_LIMIT_MS) {
      await new Promise(r => setTimeout(r, MCP_RATE_LIMIT_MS - elapsed));
    }
    lastMCPCall = Date.now();
  }

  getTool(name) {
    if (!ALLOWED_MCP_TOOLS.includes(name)) {
      throw new Error(`MCP tool not allowed: ${name}`);
    }
    return this[name].bind(this);
  }
}

export class DSLExecutor {
  constructor(options = {}) {
    this.maxSteps = options.maxSteps || MAX_STEPS;
    this.maxMemory = options.maxMemory || DEFAULT_MEMORY_LIMIT;
    this.mcp = options.mcp || new MCPTools();
  }

  async execute(skill, input) {
    const { logic } = skill;
    if (!this.validateDSL(skill)) {
      throw new Error("Invalid DSL skill");
    }

    await this.mcp.init();

    const ctx = this.createContext(input);
    let stepCount = 0;
    let ip = 0;

    while (ip < logic.length) {
      if (++stepCount > this.maxSteps) {
        throw new Error("Step limit exceeded");
      }
      const step = logic[ip];
      const jump = await this.executeStep(step, ctx);
      if (jump !== undefined && typeof jump === "number") {
        ip = jump;
      } else {
        ip++;
      }
    }

    return ctx.output;
  }

  createContext(input) {
    this.ctx = {
      input,
      output: {},
      memory: {}
    };
    return this.ctx;
  }

  validateDSL(skill) {
    if (!skill || !Array.isArray(skill.logic)) return false;
    for (const step of skill.logic) {
      if (!step.op || !SUPPORTED_OPS.has(step.op)) return false;
    }
    return true;
  }

  executeStep(step, ctx) {
    switch (step.op) {
      case "get":
        return this.opGet(step, ctx);
      case "set":
        return this.opSet(step, ctx);
      case "add":
        return this.opAdd(step, ctx);
      case "subtract":
        return this.opSubtract(step, ctx);
      case "multiply":
        return this.opMultiply(step, ctx);
      case "divide":
        return this.opDivide(step, ctx);
      case "concat":
        return this.opConcat(step, ctx);
      case "mcp_call":
        return this.opMCPCall(step, ctx);
      case "compare":
        return this.opCompare(step, ctx);
      case "if":
        return this.opIf(step, ctx);
      case "jump":
        return this.opJump(step, ctx);
      case "call_skill":
        return this.opCallSkill(step, ctx);
      case "map":
        return this.opMap(step, ctx);
      default:
        throw new Error(`Unknown op: ${step.op}`);
    }
  }

  opGet(step, ctx) {
    let path = step.path || "";
    if (path.startsWith("input.")) {
      path = path.replace(/^input\./, "");
    }
    const parts = path.split(".");
    let value = ctx.input;
    for (const p of parts) {
      if (!p) continue;
      if (value === undefined || value === null) {
        value = undefined;
        break;
      }
      value = value[p];
    }
    ctx.memory[step.to] = value;
  }

  opSet(step, ctx) {
    let path = step.path || "";
    if (path.startsWith("output.")) {
      path = path.replace(/^output\./, "");
    }
    const value = this.resolveValue(step.value, ctx);
    this.setPath(ctx.output, path, value);
  }

  opAdd(step, ctx) {
    const a = this.resolveValue(step.a, ctx);
    const b = this.resolveValue(step.b, ctx);
    ctx.memory[step.to] = Number(a) + Number(b);
  }

  opSubtract(step, ctx) {
    const a = this.resolveValue(step.a, ctx);
    const b = this.resolveValue(step.b, ctx);
    ctx.memory[step.to] = Number(a) - Number(b);
  }

  opMultiply(step, ctx) {
    const a = this.resolveValue(step.a, ctx);
    const b = this.resolveValue(step.b, ctx);
    ctx.memory[step.to] = Number(a) * Number(b);
  }

  opDivide(step, ctx) {
    const a = this.resolveValue(step.a, ctx);
    const b = this.resolveValue(step.b, ctx);
    const numB = Number(b);
    ctx.memory[step.to] = numB === 0 ? null : Number(a) / numB;
  }

  opConcat(step, ctx) {
    const a = this.resolveValue(step.a, ctx);
    const b = this.resolveValue(step.b, ctx);
    ctx.memory[step.to] = String(a) + String(b);
  }

  async opMCPCall(step, ctx) {
    const toolFn = this.mcp.getTool(step.tool);
    const args = this.resolveObject(step.args, ctx);
    const result = await toolFn(args);
    ctx.memory[step.to] = result;
  }

  opCompare(step, ctx) {
    const a = this.resolveValue(step.a, ctx);
    const b = this.resolveValue(step.b, ctx);
    const op = step.operator;
    let result = false;
    switch (op) {
      case "==": result = a === b; break;
      case "!=": result = a !== b; break;
      case ">": result = a > b; break;
      case "<": result = a < b; break;
      case ">=": result = a >= b; break;
      case "<=": result = a <= b; break;
    }
    ctx.memory[step.to] = result;
  }

  opIf(step, ctx) {
    const condition = this.resolveValue(step.condition, ctx);
    if (condition) {
      return step.true_jump;
    } else if (step.false_jump !== undefined) {
      return step.false_jump;
    }
  }

  opJump(step, ctx) {
    return step.to;
  }

  async opCallSkill(step, ctx) {
    const depth = ctx.depth || 0;
    if (depth >= MAX_CALL_DEPTH) {
      throw new Error("Max skill call depth exceeded");
    }
    const capability = step.skill;
    const input = this.resolveObject(step.input || {}, ctx);
    let skillData = null;
    if (this.skillRegistry) {
      skillData = await this.skillRegistry.findOne({ where: { capability } });
    }
    if (!skillData && this.mockSkills && this.mockSkills[capability]) {
      skillData = this.mockSkills[capability];
    }
    if (!skillData) {
      throw new Error(`Skill not found: ${capability}`);
    }
    const subSkill = skillData.json || skillData;
    const subExecutor = new DSLExecutor({
      maxSteps: this.maxSteps,
      mcp: this.mcp,
      skillRegistry: this.skillRegistry,
      mockSkills: this.mockSkills
    });
    const result = await subExecutor.execute(subSkill, input);
    ctx.memory[step.to] = result;
  }

  async opMap(step, ctx) {
    let sourceKey = step.source || "";
    if (sourceKey.startsWith("input.")) {
      sourceKey = sourceKey.replace(/^input\./, "");
    }
    const arr = this.getPath(ctx.input, sourceKey);
    if (!Array.isArray(arr)) {
      throw new Error("Map source must be an array");
    }
    const results = [];
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const subMemory = { ...ctx.memory, [step.as]: item };
      if (step.index_as) {
        subMemory[step.index_as] = i;
      }
      const subCtx = {
        input: ctx.input,
        output: {},
        memory: subMemory,
        depth: ctx.depth || 0
      };
      for (const subStep of step.steps) {
        await this.executeStep(subStep, subCtx);
      }
      results.push(subCtx.output);
    }
    ctx.memory[step.to] = results;
  }

  resolveValue(val, ctx) {
    if (typeof val === "string" && ctx.memory[val] !== undefined) {
      return ctx.memory[val];
    }
    return val;
  }

  resolveObject(obj, ctx) {
    if (typeof obj !== "object" || obj === null) return obj;
    const result = {};
    for (const key in obj) {
      const val = obj[key];
      if (typeof val === "string" && ctx.memory[val] !== undefined) {
        result[key] = ctx.memory[val];
      } else if (typeof val === "object" && val !== null) {
        result[key] = this.resolveObject(val, ctx);
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  getPath(obj, path) {
    if (!path) return obj;
    const parts = path.split(".");
    let current = obj;
    for (const p of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[p];
    }
    return current;
  }

  setPath(obj, path, value) {
    if (!path || path === "") {
      if (typeof value === "object" && value !== null) {
        Object.assign(obj, value);
      } else {
        obj.value = value;
      }
      return;
    }
    const parts = path.split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!p) continue;
      if (!current[p]) current[p] = {};
      current = current[p];
    }
    const lastKey = parts[parts.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }
}

export function runDSL(skill, input) {
  const executor = new DSLExecutor();
  return executor.execute(skill, input);
}