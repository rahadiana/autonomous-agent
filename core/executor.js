/**
 * DSL Executor - Production-Grade Implementation
 * 
 * Features:
 * - Execution Frame model
 * - Path-based memory (getPath, setPath)
 * - $ reference system
 * - Step validator with op whitelist
 * - Step timeout and retry
 * - Trace system
 * - Output schema validation
 * - Hard execution limits
 */

import vm from "vm";
import { fork } from "child_process";
import { callTool } from "./mcp.js";

// ============== CONFIGURATION ==============

const EXECUTOR_CONFIG = {
  // Timeout
  stepTimeoutMs: 100,
  maxSteps: 20,
  maxCost: 100,
  maxMcpCall: 3,
  
  // Retry
  maxRetries: 2,
  retryDelayMs: 10,
  
  // Safety
  dangerousKeywords: ["process", "require", "module", "exports", "__dirname", "__filename"],
  
  // Sandbox
  useSandbox: false,
  sandboxTimeout: 1000,
  
  // Allowed operations (whitelist)
  allowedOps: new Set([
    "set", "get", "add", "subtract", "multiply", "divide",
    "concat", "mcp_call", "call_skill", "call_skill_map",
    "if", "switch", "for", "for_range", "while", "map", "filter", "reduce", "break", "continue"
  ])
};

// ============== PATH-BASED MEMORY ==============

/**
 * Get value by dot-notation path
 * getPath({ a: { b: 1 } }, "a.b") → 1
 */
export function getPath(obj, path) {
  if (!path || !obj) return undefined;
  const parts = String(path).split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Set value by dot-notation path (creates nested structure)
 * setPath({}, "a.b.c", 1) → { a: { b: { c: 1 } } }
 */
export function setPath(obj, path, value) {
  if (!path || !obj) return;
  const parts = String(path).split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (current[key] === undefined || current[key] === null) {
      current[key] = {};
    } else if (typeof current[key] !== "object") {
      current[key] = {};  // Overwrite non-object
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

// ============== REFERENCE RESOLUTION ==============

/**
 * Resolve value with $ reference support
 * - $memory.path → memory reference
 * - $input.path → input reference
 * - literal strings preserved
 */
export function resolveValue(val, ctx) {
  if (val === undefined || val === null) return undefined;
  
  if (typeof val === "string") {
    // $ reference system
    if (val.startsWith("$memory.")) {
      const path = val.slice(8);  // Remove "$memory."
      return getPath(ctx.memory, path);
    }
    
    if (val.startsWith("$input.")) {
      const path = val.slice(7);  // Remove "$input."
      return getPath(ctx.input, path);
    }
    
    // Legacy input.X support
    if (val.startsWith("input.")) {
      const key = val.slice(6);
      return ctx.input?.[key];
    }
    
    // Legacy memory.X support
    if (val.startsWith("memory.")) {
      const key = val.slice(7);
      return getPath(ctx.memory, key);
    }
    
    // If val is exactly "true" or "false" as strings, treat as boolean
    if (val === "true") return true;
    if (val === "false") return false;
    
    // Use getPath for dot-notation keys (handles nested paths in memory)
    // Check both ctx.memory and ctx.memory.memory for nested paths
    if (val.includes(".")) {
      let fromMemory = getPath(ctx.memory, val);
      if (fromMemory !== undefined) return fromMemory;
      
      // Also check nested memory.memory
      if (ctx.memory.memory) {
        fromMemory = getPath(ctx.memory.memory, val);
        if (fromMemory !== undefined) return fromMemory;
      }
      
      const fromInput = getPath(ctx.input, val);
      if (fromInput !== undefined) return fromInput;
    }
    
    // Simple key lookup in memory - ONLY for exact key match
    // Use hasOwnProperty to avoid prototype chain issues
    // Priority: 
    // 1. frame.memory (current values set by loops/steps)
    // 2. ctx.memory.memory (nested memory from set operations)
    // 3. ctx.memory (top level, rare case)
    if (Object.prototype.hasOwnProperty.call(ctx.memory, val)) {
      return ctx.memory[val];
    }
    if (ctx.memory.memory && Object.prototype.hasOwnProperty.call(ctx.memory.memory, val)) {
      return ctx.memory.memory[val];
    }
    
    // Also check output (for loop variables set via setPath)
    if (Object.prototype.hasOwnProperty.call(ctx.output, val)) {
      return ctx.output[val];
    }
    
    // Fallback chain (||)
    if (val.includes("||")) {
      const parts = val.split("||");
      for (const part of parts) {
        const trimmed = part.trim();
        if (Object.prototype.hasOwnProperty.call(ctx.memory, trimmed)) {
          return ctx.memory[trimmed];
        }
        if (trimmed && !trimmed.includes(".")) {
          const num = parseFloat(trimmed);
          if (!isNaN(num)) return num;
        }
      }
      return parts[parts.length - 1].trim();
    }
    
    // Expression evaluation
    if (val.includes("+") || val.includes("-") || val.includes("*") || val.includes("/")) {
      try {
        // Replace $ references in expression
        let expr = val.replace(/\$input\.(\w+)/g, (match, key) => {
          const val = getPath(ctx.input, key);
          return val !== undefined ? String(val) : "0";
        });
        expr = expr.replace(/\$memory\.(\w+)/g, (match, key) => {
          const val = getPath(ctx.memory, key);
          return val !== undefined ? String(val) : "0";
        });
        
        if (/^[\d\s+\-*/().]+$/.test(expr)) {
          const result = Function('"use strict"; return (' + expr + ')')();
          return result;
        }
      } catch (e) {
        console.error("[resolveValue] Expression error:", e.message);
      }
    }
  }
  
  return val;
}

/**
 * Resolve all values in an object
 */
export function resolveObject(obj, ctx) {
  if (typeof obj !== "object" || obj === null) return obj;

  const result = {};
  for (const key in obj) {
    const val = obj[key];
    if (typeof val === "string") {
      result[key] = resolveValue(val, ctx);
    } else if (typeof val === "object" && val !== null) {
      result[key] = resolveObject(val, ctx);
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ============== SAFE MCP CALL ==============

const TIMEOUT = 3000;
const MAX_RETRIES = 2;

export async function safeMcpCall(tool, args) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await callTool(tool, { ...args, signal: controller.signal });
      clearTimeout(id);
      return normalizeOutput(result);
    } catch (e) {
      if (attempt === MAX_RETRIES) {
        clearTimeout(id);
        return { error: true, message: e.message };
      }
      await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
    }
  }
  return { error: true, message: "Max retries exceeded" };
}

function normalizeOutput(result) {
  if (!result) return { status: 0, data: null, error: "No result" };
  if (result.error) return { status: 0, data: null, error: result.message || result.error };
  return { status: 1, data: result, error: null };
}

// ============== VALIDATION ==============

export function validateStepIO(prevOutput, nextInputSchema) {
  if (!nextInputSchema || !nextInputSchema.properties) return true;
  
  for (const key in nextInputSchema.properties) {
    const expectedType = nextInputSchema.properties[key].type;
    const value = prevOutput[key];
    
    if (value !== undefined && typeof value !== expectedType) {
      return false;
    }
  }
  return true;
}

/**
 * Step validator - ensures safe operations
 * @param {Object} step - step to validate
 * @param {Array} capabilities - allowed capabilities
 */
export function validateStep(step, capabilities = []) {
  if (!step) {
    throw new Error("Step is null or undefined");
  }
  
  if (!step.op) {
    throw new Error("Step missing 'op' field");
  }
  
  if (!EXECUTOR_CONFIG.allowedOps.has(step.op)) {
    throw new Error(`Invalid or disallowed operation: ${step.op}`);
  }
  
  if (step.capability && capabilities.length > 0) {
    if (!capabilities.includes(step.capability)) {
      throw new Error(`Invalid capability: ${step.capability}`);
    }
  }
  
  if (typeof step.input !== "object" && step.input !== undefined) {
    throw new Error("Invalid step input");
  }
  
  return true;
}

/**
 * Execute plan with execution contract enforcement
 * @param {Object} plan - plan with steps
 * @param {Object} input - input data
 * @param {Array} capabilities - allowed capabilities
 */
export async function executePlan(plan, input, capabilities = []) {
  let ctx = input;

  for (const step of plan.steps) {
    validateStep(step, capabilities);
    ctx = await runCapability(step.capability, step.input, ctx);
  }

  return ctx;
}

async function runCapability(capability, stepInput, ctx) {
  // Placeholder for capability execution
  // In real implementation, this would call the appropriate capability
  return ctx;
}

/**
 * Dangerous code detector for string-based logic
 */
function containsDangerousCode(code) {
  if (typeof code !== "string") return false;
  for (const keyword of EXECUTOR_CONFIG.dangerousKeywords) {
    if (code.includes(keyword)) return true;
  }
  return false;
}

// ============== EXECUTION HELPERS ==============

/**
 * Execute with timeout
 */
async function withTimeout(promise, ms = EXECUTOR_CONFIG.stepTimeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Step timeout")), ms)
    )
  ]);
}

/**
 * Execute with retry
 */
async function executeWithRetry(fn, retries = EXECUTOR_CONFIG.maxRetries) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries) {
        await new Promise(r => setTimeout(r, EXECUTOR_CONFIG.retryDelayMs));
      }
    }
  }
  throw lastError;
}

/**
 * Evaluate condition for if/switch
 */
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
      case "contains": return Array.isArray(left) && left.includes(right) || typeof left === "string" && left.includes(right);
      case "typeof": return typeof left === right;
      default: return false;
    }
  }
  if (typeof expr === "object" && expr !== null && expr.op) {
    const left = resolveValue(expr.left, ctx);
    const right = resolveValue(expr.right, ctx);
    switch (expr.op) {
      case "eq": return left === right;
      case "neq": return left !== right;
      case "gt": return left > right;
      case "gte": return left >= right;
      case "lt": return left < right;
      case "lte": return left <= right;
      case "in": return Array.isArray(right) && right.includes(left);
      case "contains": return Array.isArray(left) && left.includes(right) || typeof left === "string" && left.includes(right);
      case "typeof": return typeof left === right;
      default: return false;
    }
  }
  return !!expr;
}

// ============== STEP EXECUTION ==============

/**
 * Execute a single step with trace and validation (Fix #1: Step-level validation + trace)
 */
export async function executeStepWithTrace(step, ctx) {
  const before = JSON.parse(JSON.stringify(ctx.output));

  let result;

  switch (step.op) {
    case "set":
      result = setValue(step, ctx);
      break;
    case "get":
      result = getValue(step, ctx);
      break;
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
      result = mathOperation(step.op, step, ctx);
      break;
    case "concat":
      result = concatValue(step, ctx);
      break;
    case "mcp_call":
      result = await callMCP(step, ctx);
      break;
    case "call_skill":
      result = await callSkill(step, ctx);
      break;
    default:
      result = null;
  }

  if (result === undefined) {
    throw new Error(`Step ${step.op} returned undefined`);
  }
  if (typeof result === "object" && result === null) {
    throw new Error(`Step ${step.op} returned null object`);
  }

  const after = ctx.output;

  return {
    result,
    trace: {
      step,
      before,
      after,
      status: "ok"
    }
  };
}

function setValue(step, ctx) {
  const value = resolveValue(step.value, ctx);
  const path = step.path || step.to;
  if (path) {
    setPath(ctx.output, path, value);
  }
  return value;
}

function getValue(step, ctx) {
  const path = step.path || step.from;
  return getPath(ctx.input, path) ?? getPath(ctx.output, path);
}

function mathOperation(op, step, ctx) {
  const a = resolveValue(step.a, ctx);
  const b = resolveValue(step.b, ctx);
  let result;
  switch (op) {
    case "add": result = a + b; break;
    case "subtract": result = a - b; break;
    case "multiply": result = a * b; break;
    case "divide": result = b !== 0 ? a / b : NaN; break;
  }
  const to = step.to || step.to_output;
  if (to) setPath(ctx.output, to, result);
  return result;
}

function concatValue(step, ctx) {
  const a = resolveValue(step.a, ctx) ?? "";
  const b = resolveValue(step.b, ctx) ?? "";
  const result = String(a) + String(b);
  if (step.to) setPath(ctx.output, step.to, result);
  return result;
}

async function callMCP(step, ctx) {
  const tool = resolveValue(step.tool, ctx);
  const args = resolveObject(step.args || {}, ctx);
  const result = await callTool(tool, args);
  if (step.to) setPath(ctx.output, step.to, result);
  return result;
}

async function callSkill(step, ctx) {
  if (!SkillRunner) throw new Error("SkillRunner not configured");
  const skillName = resolveValue(step.skill, ctx);
  const inputResolved = resolveObject(step.input || {}, ctx);
  return await SkillRunner.run(skillName, { input: inputResolved });
}

function validateStepWithSchema(step, result) {
  if (step.expect_schema) {
    for (const [key, expectedType] of Object.entries(step.expect_schema)) {
      const actualType = typeof result[key];
      if (actualType !== expectedType) {
        throw new Error(`Step validation failed: ${key} expected ${expectedType}, got ${actualType}`);
      }
    }
  }
  return true;
}

/**
 * Execute a single step
 */
async function executeStep(step, frame, input) {
  let ctx = {
    input,
    memory: frame.memory,
    output: frame.output
  };
  
  const op = step.op;

  switch (op) {
    case "set": {
      const value = resolveValue(step.value, ctx);
      const path = step.path || step.to;
      if (path) {
        setPath(frame.memory, path, value);
        setPath(frame.output, path, value);
      }
      break;
    }

    case "get": {
      const path = step.path || step.from;
      const val = getPath(input, path) ?? getPath(frame.memory, path);
      const to = step.to || step.into;
      if (to) {
        setPath(frame.memory, to, val);
        setPath(frame.output, to, val);
      }
      break;
    }

    case "add":
    case "subtract":
    case "multiply":
    case "divide": {
      const a = resolveValue(step.a, ctx);
      const b = resolveValue(step.b, ctx);
      let result;
      switch (op) {
        case "add": result = a + b; break;
        case "subtract": result = a - b; break;
        case "multiply": result = a * b; break;
        case "divide": result = b !== 0 ? a / b : NaN; break;
      }
      const to = step.to || step.to_output;
      if (to) {
        setPath(frame.memory, to, result);
        setPath(frame.output, to, result);
      }
      break;
    }

    case "concat": {
      const a = resolveValue(step.a, ctx) ?? "";
      const b = resolveValue(step.b, ctx) ?? "";
      const result = String(a) + String(b);
      if (step.to) {
        setPath(frame.memory, step.to, result);
        setPath(frame.output, step.to, result);
      }
      break;
    }

    case "mcp_call": {
      const tool = resolveValue(step.tool, ctx);
      const args = resolveObject(step.args || {}, ctx);
      const result = await callTool(tool, args);
      if (step.to) {
        safeAssign({ output: frame.memory }, step.to, result, step.output_schema);
        setPath(frame.output, step.to, result);
      }
      break;
    }

    case "call_skill": {
      const skillName = resolveValue(step.skill, ctx);
      const inputResolved = resolveObject(step.input || {}, ctx);
      
      if (!SkillRunner) {
        throw new Error("SkillRunner not configured");
      }
      
      const result = await SkillRunner.run(skillName, { input: inputResolved });
      if (step.to) {
        setPath(frame.memory, step.to, result);
        setPath(frame.output, step.to, result);
      }
      break;
    }

    case "call_skill_map": {
      const collection = resolveValue(step.collection, ctx) ?? [];
      const skillName = resolveValue(step.skill, ctx);
      const inputKey = step.input_key || "item";
      const results = [];

      for (const item of collection) {
        if (!SkillRunner) {
          throw new Error("SkillRunner not configured");
        }
        const result = await SkillRunner.run(skillName, { input: { [inputKey]: item } });
        results.push(result);
      }

      if (step.to) {
        setPath(frame.memory, step.to, results);
        setPath(frame.output, step.to, results);
      }
      break;
    }

    case "if": {
      const condition = evaluateCondition(step.condition, ctx);
      const branches = step.branches || {};
      const steps = condition ? branches.then : branches.else;
      if (steps) {
        for (const subStep of steps) {
          await executeStep(subStep, frame, input);
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
            await executeStep(subStep, frame, input);
          }
          if (caseValue !== "default") {
            matched = true;
            break;
          }
        }
      }

      if (!matched && cases.default) {
        for (const subStep of cases.default) {
          await executeStep(subStep, frame, input);
        }
      }
      break;
    }

    case "for": {
      // Resolve collection - check nested memory structure first
      let collection = ctx.memory.memory?.[step.collection] ?? resolveValue(step.collection, ctx) ?? [];
      const varName = step.var || step.item || "item";
      const indexName = step.index || "index";
      const steps = step.steps || [];
      const maxLoops = 10000;
      let idx = 0;

      // Convert objects to their values if needed
      if (typeof collection === "object" && !Array.isArray(collection)) {
        collection = Object.values(collection);
      }

      for (const item of collection) {
        if (idx >= maxLoops) break;
        
        setPath(frame.memory, varName, item);
        setPath(frame.memory, indexName, idx);
        setPath(frame.output, varName, item);
        setPath(frame.output, indexName, idx);
        
        try {
          for (const subStep of steps) {
            await executeStep(subStep, frame, input);
          }
        } catch (err) {
          if (err.message === "__BREAK__") break;
          if (err.message === "__CONTINUE__") { idx++; continue; }
          throw err;
        }
        idx++;
      }
      // Clean up loop variables
      delete frame.memory[varName];
      delete frame.memory[indexName];
      delete frame.output[varName];
      delete frame.output[indexName];
      break;
    }

    case "for_range": {
      const start = resolveValue(step.start, ctx) ?? 0;
      const end = resolveValue(step.end, ctx) ?? 0;
      const stepSize = resolveValue(step.step, ctx) ?? 1;
      const varName = step.var || "i";
      const steps = step.steps || [];

      for (let i = start; i < end; i += stepSize) {
        setPath(frame.memory, varName, i);
        setPath(frame.output, varName, i);
        
        try {
          for (const subStep of steps) {
            await executeStep(subStep, frame, input);
          }
        } catch (err) {
          if (err.message === "__BREAK__") break;
          if (err.message === "__CONTINUE__") continue;
          throw err;
        }
      }
      break;
    }

    case "while": {
      const condition = step.condition;
      const steps = step.steps || [];
      const maxLoops = 10000;
      let loopCount = 0;

      while (evaluateCondition(condition, ctx)) {
        if (loopCount >= maxLoops) {
          break; // Stop at max without throwing
        }
        
        try {
          // Update ctx before executing steps
          ctx = {
            input,
            memory: frame.memory,
            output: frame.output
          };
          
          for (const subStep of steps) {
            await executeStep(subStep, frame, input);
          }
        } catch (err) {
          if (err.message === "__BREAK__") break;
          if (err.message === "__CONTINUE__") continue;
          throw err;
        }
        
        loopCount++;
        
        // Update ctx for next iteration
        ctx = {
          input,
          memory: frame.memory,
          output: frame.output
        };
      }
      break;
    }

    case "map": {
      const collection = resolveValue(step.collection, ctx) ?? [];
      const varName = step.var || step.item || "item";
      const steps = step.steps || [];
      const results = [];

      for (const item of collection) {
        setPath(frame.memory, varName, item);
        
        for (const subStep of steps) {
          await executeStep(subStep, frame, input);
        }
        
        // Get the result from the last step's output
        let resultVal;
        if (steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          if (lastStep.to) {
            resultVal = getPath(frame.memory, lastStep.to);
          }
        }
        if (resultVal === undefined) {
          resultVal = getPath(frame.memory, varName);
        }
        results.push(resultVal);
        
        // Clean up loop variable
        delete frame.memory[varName];
      }

      if (step.to) {
        setPath(frame.memory, step.to, results);
      }
      break;
    }

    case "filter": {
      const collection = resolveValue(step.collection, ctx) ?? [];
      const varName = step.var || step.item || "item";
      const steps = step.steps || [];
      const results = [];

      for (const item of collection) {
        setPath(frame.memory, varName, item);
        
        let keep = true;
        
        // If there's a condition, evaluate it
        if (step.condition) {
          keep = evaluateCondition(step.condition, ctx);
        } else if (steps.length > 0) {
          // If there are steps, execute them and check the result
          for (const subStep of steps) {
            await executeStep(subStep, frame, input);
          }
          
          // Check the last step's output
          if (steps.length > 0) {
            const lastStep = steps[steps.length - 1];
            if (lastStep.to) {
              const resultVal = getPath(frame.memory, lastStep.to);
              keep = !!resultVal;
            }
          }
        }
        
        if (keep) results.push(item);
        
        // Clean up loop variable
        delete frame.memory[varName];
      }

      if (step.to) {
        setPath(frame.memory, step.to, results);
      }
      break;
    }

    case "reduce": {
      const collection = resolveValue(step.collection, ctx) ?? [];
      const initial = resolveValue(step.initial, ctx);
      const varAcc = step.accumulator || "acc";
      const varItem = step.item || "item";
      const steps = step.steps || [];

      let acc = initial;
      setPath(frame.memory, varAcc, acc);
      setPath(frame.output, varAcc, acc);

      for (const item of collection) {
        setPath(frame.memory, varItem, item);
        setPath(frame.output, varItem, item);
        
        for (const subStep of steps) {
          await executeStep(subStep, frame, input);
        }
        
        acc = getPath(frame.memory, varAcc) ?? getPath(frame.output, varAcc);
      }

      if (step.to) {
        setPath(frame.memory, step.to, acc);
        setPath(frame.output, step.to, acc);
      }
      break;
    }

    case "break": {
      throw new Error("__BREAK__");
    }

    case "continue": {
      throw new Error("__CONTINUE__");
    }

    default:
      throw new Error(`Unknown operation: ${op}`);
  }
}

// ============== MAIN EXECUTOR ==============

/**
 * Create execution frame
 */
function createFrame() {
  return {
    stepIndex: 0,
    memory: {},
    output: {},
    trace: [],
    error: null,
    metadata: {
      startedAt: Date.now(),
      stepsExecuted: 0
    }
  };
}

/**
 * Run skill with full execution frame
 */
export async function runSkill(skill, input) {
  if (EXECUTOR_CONFIG.useSandbox && typeof skill.logic === "string") {
    return runIsolated(skill, input);
  }

  const startTime = Date.now();
  const logic = skill.logic;

  // Handle string-based logic (VM)
  if (typeof logic === "string") {
    if (containsDangerousCode(logic)) {
      throw new Error("Dangerous code detected in skill logic");
    }

    const context = { input, output: {}, memory: {} };
    vm.createContext(context);
    const script = new vm.Script(logic);
    script.runInContext(context, { timeout: EXECUTOR_CONFIG.stepTimeoutMs });
    
    const result = context.output;
    result._meta = { latency: Date.now() - startTime };
    return result;
  }

  // Handle array-based logic (DSL steps)
  if (Array.isArray(logic)) {
    const frame = createFrame();

    // Execution loop with limits
    for (let i = 0; i < logic.length; i++) {
      // Check step limit
      if (i >= EXECUTOR_CONFIG.maxSteps) {
        frame.error = new Error(`Max steps exceeded (${EXECUTOR_CONFIG.maxSteps})`);
        break;
      }

      frame.stepIndex = i;
      const step = logic[i];

      // Validate step
      validateStep(step);

      // Schema enforcement between steps (FIX 2.2)
      if (i > 0 && logic[i - 1]?.output_schema) {
        if (!validateStepIO(frame.output, step.input_schema)) {
          throw new Error(`Step IO mismatch at step ${i}`);
        }
      }

      try {
        // Execute with timeout and retry
        const execFn = () => executeStep(step, frame, input);
        await withTimeout(executeWithRetry(execFn), EXECUTOR_CONFIG.stepTimeoutMs);
        
        frame.metadata.stepsExecuted++;

        // Add to trace
        frame.trace.push({
          stepIndex: i,
          op: step.op,
          timestamp: Date.now()
        });

      } catch (err) {
        frame.error = err;
        
        // Handle break/continue
        if (err.message === "__BREAK__") break;
        if (err.message === "__CONTINUE__") continue;
        
        // Re-throw other errors
        throw err;
      }
    }

    // Validate output schema if defined
    if (skill.output_schema) {
      const validation = validateOutput(skill.output_schema, frame.output);
      if (!validation.valid) {
        frame.error = new Error(`Output schema validation failed: ${validation.errors.join(", ")}`);
      }
    }

    // Add metadata
    frame.output._meta = {
      latency: Date.now() - startTime,
      stepsExecuted: frame.metadata.stepsExecuted,
      stepLimit: EXECUTOR_CONFIG.maxSteps,
      hadError: !!frame.error
    };

    // Merge memory into output for accessibility
    // Always use memory values (they represent the final state after loops/etc)
    if (frame.memory) {
      for (const key of Object.keys(frame.memory)) {
        frame.output[key] = frame.memory[key];
      }
    }

    return frame.output;
  }

  throw new Error("Invalid skill logic format");
}

/**
 * Validate output against schema
 */
function validateOutput(schema, output) {
  const errors = [];
  
  if (!schema) {
    return { valid: true };
  }

  // Simple schema validation
  if (schema.required) {
    for (const field of schema.required) {
      if (output[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Type checking
  if (schema.properties) {
    for (const [field, type] of Object.entries(schema.properties)) {
      if (output[field] !== undefined && typeof output[field] !== type) {
        errors.push(`Field ${field} expected type ${type}, got ${typeof output[field]}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============== TYPE-SAFE DSL EXECUTOR WITH VALIDATION (FIX 1) ==============

export async function runDSLWithValidation(skill, input) {
  let ctx = { input, memory: {}, output: {} };

  for (const step of skill.logic) {
    ctx = await executeStepWithContext(step, ctx);

    if (!validateStepContext(step, ctx)) {
      throw new Error(`Step failed: ${step.op}`);
    }
  }

  if (skill.output_schema) {
    const validation = validateOutput(skill.output_schema, ctx.output);
    if (!validation.valid) {
      throw new Error(`Output schema invalid: ${validation.errors.join(", ")}`);
    }
  }

  return ctx.output;
}

async function executeStepWithContext(step, ctx) {
  const frame = {
    memory: ctx.memory,
    output: ctx.output
  };

  await executeStep(step, frame, ctx.input);

  return {
    input: ctx.input,
    memory: frame.memory,
    output: frame.output
  };
}

export function validateStepContext(step, ctx) {
  switch (step.op) {
    case "get":
      return ctx.memory !== undefined;
    case "set":
      return true;
    case "mcp_call":
      return ctx.memory[step.to] !== undefined || step.to === undefined;
    default:
      return true;
  }
}

export async function runDSL(skill, input) {
  return runSkill(skill, input);
}

export async function executeSkill(skill, input) {
  if (!skill) {
    return { error: "no_skill", _meta: { score: 0 } };
  }

  if (skill.type === "code" || typeof skill.logic === "string") {
    try {
      return await runSkill(skill, input);
    } catch {
      return runDSL(skill, input);
    }
  }

  return runDSL(skill, input);
}

// ============== SKILL RUNNER ==============

let SkillRunner = null;

export function setSkillRunner(runner) {
  SkillRunner = runner;
}

export function getSkillRunner() {
  return SkillRunner;
}

// ============== SAFE ASSIGN WITH SCHEMA VALIDATION (FIX #1) ==============

function safeAssign(ctx, key, value, schema) {
  if (!schema) {
    ctx.output[key] = value;
    return;
  }

  const valid = validateSchema(schema, value);

  if (!valid.valid) {
    throw new Error(`Invalid output for ${key}: ${valid.errors.join(", ")}`);
  }

  ctx.output[key] = value;
}

function validateSchema(schema, value) {
  const errors = [];

  if (!schema || !value) {
    return { valid: true, errors: [] };
  }

  if (schema.required) {
    for (const field of schema.required) {
      if (value[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  if (schema.properties) {
    for (const [field, typeDef] of Object.entries(schema.properties)) {
      if (value[field] !== undefined) {
        const expectedType = typeDef.type;
        const actualType = typeof value[field];
        if (actualType !== expectedType) {
          errors.push(`Field ${field} expected ${expectedType}, got ${actualType}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============== STRICT DSL VALIDATOR (FIX #2) ==============

export function validateDSL(skill) {
  if (!skill) {
    return { valid: false, errors: ["Skill is null or undefined"] };
  }

  if (!skill.logic) {
    return { valid: false, errors: ["Skill missing logic"] };
  }

  if (!Array.isArray(skill.logic)) {
    return { valid: false, errors: ["Skill logic must be an array"] };
  }

  const errors = [];

  for (let i = 0; i < skill.logic.length; i++) {
    const step = skill.logic[i];

    if (!step.op) {
      errors.push(`Step ${i} missing 'op' field`);
    }

    if (step.op && !EXECUTOR_CONFIG.allowedOps.has(step.op)) {
      errors.push(`Step ${i} has invalid operation: ${step.op}`);
    }

    if (step.to && typeof step.to !== "string") {
      errors.push(`Step ${i} has invalid 'to' field`);
    }

    if (step.from && typeof step.from !== "string") {
      errors.push(`Step ${i} has invalid 'from' field`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============== DETERMINISM CHECK (FIX #3) ==============

export async function checkDeterminism(skill, input, runDSL) {
  try {
    const r1 = await runDSL(skill, input);
    const r2 = await runDSL(skill, input);

    const s1 = JSON.stringify(r1);
    const s2 = JSON.stringify(r2);

    if (s1 !== s2) {
      return {
        deterministic: false,
        error: "Non-deterministic skill: different outputs for same input"
      };
    }

    return { deterministic: true };
  } catch (e) {
    return {
      deterministic: false,
      error: e.message
    };
  }
}

// ============== TRACE SYSTEM (FIX #4) ==============

export function createTraceEntry(step, input, output, success, error = null) {
  return {
    step: step.op || "unknown",
    stepIndex: step._index || 0,
    input: input ? JSON.parse(JSON.stringify(input)) : null,
    output: output ? JSON.parse(JSON.stringify(output)) : null,
    success,
    error: error?.message || null,
    timestamp: Date.now()
  };
}

export { EXECUTOR_CONFIG, validateStepWithSchema, safeAssign, validateSchema };

// ============== SANDBOX ISOLATION ==============

let sandboxWorker = null;

function getSandboxWorker() {
  if (!sandboxWorker) {
    sandboxWorker = fork("./core/sandboxWorker.js");
  }
  return sandboxWorker;
}

export async function runIsolated(skill, input) {
  return new Promise((resolve, reject) => {
    const worker = getSandboxWorker();
    const timeout = setTimeout(() => {
      worker.kill();
      reject(new Error("sandbox_timeout"));
    }, EXECUTOR_CONFIG.sandboxTimeout);

    const handler = (msg) => {
      clearTimeout(timeout);
      worker.off("message", handler);
      if (msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve(msg.result);
      }
    };

    worker.on("message", handler);
    worker.send({ skill, input });
  });
}