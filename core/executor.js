import vm from "vm";
import { callTool } from "./mcp.js";

const TIMEOUT_MS = 100;
const MAX_LOOP_ITERATIONS = 10000;
const DANGEROUS_KEYWORDS = ["process", "require", "module", "exports", "__dirname", "__filename"];

function containsDangerousCode(code) {
  if (typeof code === "string") {
    for (const keyword of DANGEROUS_KEYWORDS) {
      if (code.includes(keyword)) {
        return true;
      }
    }
  }
  return false;
}

function resolveValue(val, ctx) {
  if (typeof val === "string") {
    if (ctx.memory[val] !== undefined) {
      return ctx.memory[val];
    }
    
    if (val.includes("||")) {
      const parts = val.split("||");
      for (const part of parts) {
        const trimmed = part.trim();
        if (ctx.memory[trimmed] !== undefined) {
          return ctx.memory[trimmed];
        }
        if (trimmed && !trimmed.includes(".")) {
          const num = parseFloat(trimmed);
          if (!isNaN(num)) return num;
        }
      }
      return parts[parts.length - 1].trim();
    }
    
    if (val.includes("+") || val.includes("-") || val.includes("*") || val.includes("/")) {
      try {
        // Replace input.X with actual values from ctx.input
        const expr = val.replace(/input\.(\w+)/g, (match, key) => {
          const inputVal = ctx.input?.[key];
          if (inputVal !== undefined) {
            return String(inputVal);
          }
          return "0";
        });
        // Also handle memory.X references
        const expr2 = expr.replace(/memory\.(\w+)/g, (match, key) => {
          const memVal = ctx.memory?.[key];
          if (memVal !== undefined) {
            return String(memVal);
          }
          return "0";
        });
        // Now evaluate the expression
        if (/^[\d\s+\-*/().]+$/.test(expr2)) {
          const result = Function('"use strict"; return (' + expr2 + ')')();
          return result;
        }
      } catch (e) {
        console.error("[resolveValue] Expression evaluation error:", e.message, "Expression:", val);
      }
    }
  }
  return val;
}

function resolveObject(obj, ctx) {
  if (typeof obj !== "object" || obj === null) return obj;

  const result = {};
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === "string") {
      if (ctx.memory[val] !== undefined) {
        result[key] = ctx.memory[val];
      } else if (val.includes(".")) {
        const memVal = getByPath(ctx.memory, val);
        result[key] = memVal !== undefined ? memVal : val;
      } else {
        result[key] = val;
      }
    } else if (typeof val === "object" && val !== null) {
      result[key] = resolveObject(val, ctx);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function getByPath(obj, path) {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function setByPath(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function setMemory(ctx, path, value) {
  if (path.startsWith("memory.")) {
    const actualPath = path.slice(7);
    setByPath(ctx.memory, actualPath, value);
    setByPath(ctx.output, actualPath, value);
  } else {
    setByPath(ctx.output, path, value);
  }
}

function evaluateCondition(expr, ctx) {
  if (typeof expr === "boolean") return expr;
  if (typeof expr === "string") {
    const resolved = resolveValue(expr, ctx);
    return !!resolved;
  }
  if (typeof expr === "object" && expr !== null && expr.comparison) {
    const left = resolveValue(expr.comparison.left, ctx);
    const right = resolveValue(expr.comparison.right, ctx);
    const op = expr.comparison.op;
    switch (op) {
      case "eq": return left === right;
      case "neq": return left !== right;
      case "gt": return left > right;
      case "gte": return left >= right;
      case "lt": return left < right;
      case "lte": return left <= right;
      case "in": return Array.isArray(right) && right.includes(left);
      case "contains": return Array.isArray(left) && left.includes(right);
      case "typeof": return typeof left === right;
      default: return false;
    }
  }
  return !!expr;
}

async function executeStep(step, ctx) {
  const op = step.op;

  switch (op) {
    case "set": {
      const value = resolveValue(step.value, ctx);
      setMemory(ctx, step.path, value);
      break;
    }

    case "get": {
      const val = getByPath(ctx.input, step.path) ?? getByPath(ctx.memory, step.path);
      ctx.memory[step.to] = val;
      ctx.output[step.to] = val;
      break;
    }

    case "add":
    case "subtract":
    case "multiply":
    case "divide": {
      const a = resolveValue(step.a, ctx) ?? 0;
      const b = resolveValue(step.b, ctx) ?? 0;
      let result;
      switch (op) {
        case "add": result = a + b; break;
        case "subtract": result = a - b; break;
        case "multiply": result = a * b; break;
        case "divide": result = b !== 0 ? a / b : NaN; break;
      }
      if (step.to) ctx.memory[step.to] = result;
      if (step.to_output) {
        setByPath(ctx.output, step.to_output, result);
      } else if (step.to) {
        ctx.output[step.to] = result;
      }
      break;
    }

    case "concat": {
      const a = resolveValue(step.a, ctx) ?? "";
      const b = resolveValue(step.b, ctx) ?? "";
      const result = String(a) + String(b);
      if (step.to) {
        ctx.memory[step.to] = result;
        ctx.output[step.to] = result;
      }
      break;
    }

    case "mcp_call": {
      const tool = step.tool;
      const args = resolveObject(step.args, ctx);
      const result = await callTool(tool, args);
      ctx.memory[step.to] = result;
      ctx.output[step.to] = result;
      break;
    }

    case "call_skill": {
      const skillName = resolveValue(step.skill, ctx);
      const input = resolveObject(step.input || {}, ctx);
      
      if (!SkillRunner) {
        throw new Error("SkillRunner not configured");
      }
      
      const result = await SkillRunner.run(skillName, { input });
      ctx.memory[step.to] = result;
      ctx.output[step.to] = result;
      break;
    }

    case "call_skill_map": {
      const collection = resolveValue(step.collection, ctx) ?? [];
      const skillName = resolveValue(step.skill, ctx);
      const inputKey = step.input_key || "item";
      const results = [];

      for (const item of collection) {
        const input = { input: { [inputKey]: item } };
        if (!SkillRunner) {
          throw new Error("SkillRunner not configured");
        }
        const result = await SkillRunner.run(skillName, input);
        results.push(result);
      }

      ctx.memory[step.to] = results;
      ctx.output[step.to] = results;
      break;
    }

    case "if": {
      const condition = evaluateCondition(step.condition, ctx);
      const branches = step.branches || {};
      if (condition && branches.then) {
        for (const subStep of branches.then) {
          await executeStep(subStep, ctx);
        }
      } else if (!condition && branches.else) {
        for (const subStep of branches.else) {
          await executeStep(subStep, ctx);
        }
      }
      break;
    }

    case "switch": {
      const value = resolveValue(step.value, ctx);
      const cases = step.cases || {};
      let matched = false;

      for (const [key, steps] of Object.entries(cases)) {
        const caseValue = key === "default" ? "default" : resolveValue(key, ctx);
        if (caseValue === value || caseValue === "default") {
          for (const subStep of steps) {
            await executeStep(subStep, ctx);
          }
          if (caseValue !== "default") {
            matched = true;
            break;
          }
        }
      }

      if (!matched && cases.default) {
        for (const subStep of cases.default) {
          await executeStep(subStep, ctx);
        }
      }
      break;
    }

    case "for": {
      const collection = resolveValue(step.collection, ctx) ?? [];
      const arr = Array.isArray(collection) ? collection : Object.values(collection || {});
      let iterations = 0;

      for (const item of arr) {
        if (iterations >= MAX_LOOP_ITERATIONS) break;
        ctx.memory[step.item] = item;
        if (step.index !== undefined) {
          ctx.memory[step.index] = iterations;
        }
        for (const subStep of step.steps) {
          await executeStep(subStep, ctx);
        }
        iterations++;
      }
      break;
    }

    case "for_range": {
      const start = resolveValue(step.start, ctx) ?? 0;
      const end = resolveValue(step.end, ctx) ?? 0;
      const stepSize = step.step ?? 1;
      let iterations = 0;

      for (let i = start; i < end; i += stepSize) {
        if (iterations >= MAX_LOOP_ITERATIONS) break;
        ctx.memory[step.item] = i;
        for (const subStep of step.steps) {
          await executeStep(subStep, ctx);
        }
        iterations++;
      }
      break;
    }

    case "while": {
      let iterations = 0;
      while (evaluateCondition(step.condition, ctx)) {
        if (iterations >= MAX_LOOP_ITERATIONS) break;
        for (const subStep of step.steps) {
          await executeStep(subStep, ctx);
        }
        iterations++;
      }
      break;
    }

    case "map": {
      const collection = resolveValue(step.collection, ctx) ?? [];
      const arr = Array.isArray(collection) ? collection : [];
      const results = [];

      for (const item of arr) {
        const loopCtx = { ...ctx, memory: { ...ctx.memory, [step.item]: item } };
        for (const subStep of step.steps) {
          await executeStep(subStep, loopCtx);
        }
        const result = resolveValue(step.result, loopCtx);
        results.push(result);
      }

      ctx.memory[step.to] = results;
      ctx.output[step.to] = results;
      break;
    }

    case "filter": {
      const collection = resolveValue(step.collection, ctx) ?? [];
      const arr = Array.isArray(collection) ? collection : [];
      const results = [];

      for (const item of arr) {
        const loopCtx = { ...ctx, memory: { ...ctx.memory, [step.item]: item } };
        const condition = evaluateCondition(step.condition, loopCtx);
        if (condition) {
          results.push(item);
        }
      }

      ctx.memory[step.to] = results;
      ctx.output[step.to] = results;
      break;
    }

    case "reduce": {
      const collection = resolveValue(step.collection, ctx) ?? [];
      const arr = Array.isArray(collection) ? collection : [];
      let acc = resolveValue(step.initial, ctx);

      for (const item of arr) {
        const loopCtx = {
          ...ctx,
          memory: { ...ctx.memory, [step.item]: item, [step.accumulator]: acc }
        };
        for (const subStep of step.steps) {
          await executeStep(subStep, loopCtx);
        }
        acc = resolveValue(step.accumulator, loopCtx);
      }

      ctx.memory[step.to] = acc;
      ctx.output[step.to] = acc;
      break;
    }

    case "break": {
      throw new Error("__BREAK__");
      break;
    }

    case "continue": {
      throw new Error("__CONTINUE__");
      break;
    }

    default:
      throw new Error(`Unknown operation: ${op}`);
  }
}

export async function runSkill(skill, input) {
  const startTime = Date.now();
  const logic = skill.logic;
  
  if (typeof logic === "string") {
    if (containsDangerousCode(logic)) {
      throw new Error("Dangerous code detected in skill logic");
    }

    const context = {
      input,
      output: {},
      memory: {}
    };

    vm.createContext(context);
    const script = new vm.Script(logic);
    script.runInContext(context, { timeout: TIMEOUT_MS });
    const result = context.output;
    result._meta = {
      latency: Date.now() - startTime
    };
    return result;
  }

  if (Array.isArray(logic)) {
    const ctx = {
      input,
      output: {},
      memory: {}
    };

    for (const step of logic) {
      await executeStep(step, ctx);
    }
    const result = ctx.output;
    result._meta = {
      latency: Date.now() - startTime
    };
    return result;
  }

  throw new Error("Invalid skill logic format");
}

export async function runDSL(skill, input) {
  return runSkill(skill, input);
}

let SkillRunner = null;

export function setSkillRunner(runner) {
  SkillRunner = runner;
}

export function getSkillRunner() {
  return SkillRunner;
}
