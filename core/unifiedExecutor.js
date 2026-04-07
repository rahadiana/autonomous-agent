/**
 * Unified Executor - DSL + MCP + Code Execution
 * 
 * Executor unified yang support 3 mode:
 * - DSL: skill execution dengan logic
 * - MCP: external API calls
 * - Code: sandboxed code execution
 * 
 * Setiap output di-normalize ke format konsisten.
 */

import { runSkill } from "./executor.js";
import { callTool as runMCP, mcp } from "./mcp.js";

/**
 * Validate plan before execution - prevents hallucination
 */
export function validatePlan(plan, capabilities = []) {
  if (!plan) {
    return { valid: false, error: "Plan is null or undefined" };
  }

  if (!plan.capability && !plan.skill && !plan.bestPath) {
    return { valid: false, error: "Plan has no capability, skill, or bestPath" };
  }

  const planCapability = plan.capability || plan.bestPath?.[0]?.capability;
  
  if (planCapability && capabilities.length > 0) {
    if (!capabilities.includes(planCapability)) {
      return { valid: false, error: `Capability '${planCapability}' not in available capabilities` };
    }
  }

  return { valid: true };
}

/**
 * Executor Configuration
 */
export const UNIFIED_EXECUTOR_CONFIG = {
  timeout: 10000,              // Max execution time (ms)
  maxRetries: 2,               // Max retries on failure
  enableIsolation: true,       // Run in isolation
  enableNormalization: true,   // Normalize output format
  fallbackOnError: true,       // Use fallback on error
  // Code execution options
  codeExecution: {
    enabled: false,            // Not implemented yet
    maxMemory: 100 * 1024 * 1024,  // 100MB
    maxTime: 5000             // 5s
  },
  // MCP options
  mcp: {
    enabled: true,
    timeout: 8000,
    normalizeOutput: true
  },
  // DSL options
  dsl: {
    enabled: true,
    timeout: 5000
  }
};

/**
 * Execution types
 */
export const ExecutionType = {
  DSL: "dsl",
  MCP: "mcp",
  CODE: "code",
  HYBRID: "hybrid"
};

/**
 * Normalized output format
 */
export function normalizeOutput(result, type = "dsl") {
  if (!result) {
    return {
      status: 0,
      data: null,
      error: "No result returned",
      type
    };
  }

  // If already normalized
  if (result.status !== undefined && result.data !== undefined) {
    return result;
  }

  // Normalize based on type
  switch (type) {
    case ExecutionType.DSL:
      return normalizeDSLResult(result);
    
    case ExecutionType.MCP:
      return normalizeMCPResult(result);
    
    case ExecutionType.CODE:
      return normalizeCodeResult(result);
    
    default:
      return normalizeDefaultResult(result);
  }
}

/**
 * Normalize DSL result
 */
function normalizeDSLResult(result) {
  // Check for error
  if (result.error) {
    return {
      status: 0,
      data: null,
      error: result.error,
      type: ExecutionType.DSL
    };
  }

  // Extract result from common fields
  const value = result.result ?? result.value ?? result.output ?? result.data ?? result;

  return {
    status: 1,
    data: { result: value },
    error: null,
    type: ExecutionType.DSL,
    metadata: {
      hasResult: result.result !== undefined,
      executionTime: result.executionTime || 0
    }
  };
}

/**
 * Normalize MCP result
 */
function normalizeMCPResult(result) {
  // Check for MCP error format
  if (result.error || result.isError) {
    return {
      status: 0,
      data: null,
      error: result.error || result.message || "MCP error",
      type: ExecutionType.MCP
    };
  }

  // MCP tools might return in different formats
  const data = result.data ?? result.result ?? result.output ?? result;

  return {
    status: 1,
    data: data,
    error: null,
    type: ExecutionType.MCP,
    metadata: {
      toolName: result.toolName || result.name || "unknown",
      rawResponse: result.raw ? result.raw : undefined
    }
  };
}

/**
 * Normalize code execution result
 */
function normalizeCodeResult(result) {
  if (result.error) {
    return {
      status: 0,
      data: null,
      error: result.error,
      type: ExecutionType.CODE
    };
  }

  return {
    status: 1,
    data: result.output ?? result.result ?? result,
    error: null,
    type: ExecutionType.CODE,
    metadata: {
      executionTime: result.executionTime || 0,
      memoryUsed: result.memoryUsed || 0
    }
  };
}

/**
 * Default normalization
 */
function normalizeDefaultResult(result) {
  if (result instanceof Error) {
    return {
      status: 0,
      data: null,
      error: result.message,
      type: "unknown"
    };
  }

  return {
    status: 1,
    data: result,
    error: null,
    type: "unknown"
  };
}

/**
 * Unified Executor Class
 */
export class UnifiedExecutor {
  constructor(options = {}) {
    this.config = { ...UNIFIED_EXECUTOR_CONFIG, ...options };
    this.blackboard = options.blackboard || null;
    this.executionHistory = [];
  }

  /**
   * Run a plan
   * 
   * @param {Object} plan - Plan with type and logic
   * @param {Object} input - Input parameters
   * @param {Object} context - Execution context
   * @returns {Object} Normalized result
   */
  async run(plan, input, context = {}) {
    console.log("[UNIFIED EXECUTOR] Running plan:", plan.id || plan.capability);

    const startTime = Date.now();

    try {
      // Validate plan before execution
      const capabilities = context.capabilities || [];
      const validation = validatePlan(plan, capabilities);
      if (!validation.valid) {
        throw new Error(`Plan validation failed: ${validation.error}`);
      }

      // Determine execution type
      const execType = this.determineExecutionType(plan);
      console.log("[UNIFIED EXECUTOR] Execution type:", execType);

      let result;

      switch (execType) {
        case ExecutionType.MCP:
          result = await this.executeMCP(plan, input, context);
          break;
        
        case ExecutionType.CODE:
          result = await this.runCode(plan, input, context);
          break;
        
        case ExecutionType.DSL:
        default:
          result = await this.runDSL(plan, input, context);
          break;
      }

      // Normalize output
      const normalized = this.config.enableNormalization 
        ? normalizeOutput(result, execType)
        : result;

      // Record execution
      this.recordExecution(plan, input, normalized, Date.now() - startTime);

      return {
        success: normalized.status === 1,
        results: [normalized],
        executionTime: Date.now() - startTime,
        type: execType
      };

    } catch (error) {
      console.error("[UNIFIED EXECUTOR] Execution error:", error.message);

      const errorResult = {
        status: 0,
        data: null,
        error: error.message,
        type: this.determineExecutionType(plan)
      };

      this.recordExecution(plan, input, errorResult, Date.now() - startTime);

      // Fallback if enabled
      if (this.config.fallbackOnError && plan.fallback) {
        console.log("[UNIFIED EXECUTOR] Trying fallback plan");
        return this.run(plan.fallback, input, context);
      }

      return {
        success: false,
        results: [errorResult],
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Determine execution type from plan
   */
  determineExecutionType(plan) {
    // Check plan type
    if (plan.type === "mcp") return ExecutionType.MCP;
    if (plan.type === "code") return ExecutionType.CODE;
    if (plan.type === "hybrid") return ExecutionType.HYBRID;
    
    // Check for MCP in logic
    if (plan.logic?.some(l => l.type === "mcp")) {
      return ExecutionType.MCP;
    }

    // Check for code execution
    if (plan.logic?.some(l => l.type === "code" || l.op === "run")) {
      return ExecutionType.CODE;
    }

    // Default to DSL
    return ExecutionType.DSL;
  }

  /**
   * Run DSL (skill) execution
   */
  async runDSL(plan, input, context) {
    const skill = plan.skill || plan.bestPath?.[0]?.skill;
    
    if (!skill) {
      // Try to find from capability
      const capability = plan.capability || plan.bestPath?.[0]?.capability;
      if (capability) {
        return {
          capability,
          error: "Skill not found in registry"
        };
      }
      throw new Error("No skill defined in plan");
    }

    // Parse input from goal if not provided
    let parsedInput = { ...input, ...context };
    if (!parsedInput.a && !parsedInput.b && context.goal) {
      const numbers = context.goal.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        parsedInput = {
          a: parseFloat(numbers[0]),
          b: parseFloat(numbers[1]),
          ...context
        };
      }
    }

    console.log("[EXECUTOR] Running skill with input:", parsedInput);

    // Run skill with executor
    const result = await runSkill(skill, parsedInput);

    console.log("[EXECUTOR] Skill result:", result);

    return result;
  }

  /**
   * Run MCP execution
   */
  async executeMCP(plan, input, context) {
    const mcpCall = plan.logic?.find(l => l.type === "mcp" || l.op === "mcp_call");
    
    if (!mcpCall) {
      throw new Error("No MCP call defined in plan");
    }

    const mcpResult = await runMCP({
      tool: mcpCall.tool || mcpCall.name,
      input: { ...input, ...context },
      options: {
        timeout: this.config.mcp.timeout
      }
    });

    return mcpResult;
  }

  /**
   * Run code execution (placeholder - requires sandbox)
   */
  async runCode(plan, input, context) {
    if (!this.config.codeExecution.enabled) {
      throw new Error("Code execution not enabled");
    }

    // This would require a proper sandbox (vm2, isolated-vm, etc.)
    throw new Error("Code execution requires sandbox implementation");
  }

  /**
   * Run hybrid execution (DSL + MCP + code)
   */
  async runHybrid(plan, input, context) {
    const results = [];

    for (const step of plan.bestPath || plan.logic || []) {
      const stepType = this.determineExecutionType({ logic: [step] });
      
      let stepResult;
      
      switch (stepType) {
        case ExecutionType.MCP:
          stepResult = await this.executeMCP({ logic: [step] }, input, context);
          break;
        
        case ExecutionType.CODE:
          stepResult = await this.runCode({ logic: [step] }, input, context);
          break;
        
        default:
          stepResult = await this.runDSL({ skill: step.skill, capability: step.capability }, input, context);
      }

      results.push(stepResult);

      // Update context for next step
      if (stepResult?.result) {
        context = { ...context, ...stepResult };
      }
    }

    // Combine results
    return {
      results,
      combined: results.every(r => r.success)
    };
  }

  /**
   * Record execution for history
   */
  recordExecution(plan, input, result, duration) {
    this.executionHistory.push({
      planId: plan.id,
      capability: plan.capability,
      input: input,
      result,
      duration,
      timestamp: Date.now()
    });

    // Trim history
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-50);
    }
  }

  /**
   * Get execution statistics
   */
  getStats() {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(e => e.result.status === 1).length;
    const avgDuration = total > 0 
      ? this.executionHistory.reduce((sum, e) => sum + e.duration, 0) / total 
      : 0;

    return {
      total,
      successful,
      failed: total - successful,
      successRate: total > 0 ? successful / total : 0,
      avgDuration: avgDuration.toFixed(2)
    };
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.executionHistory = [];
  }
}

/**
 * Factory function
 */
export function createUnifiedExecutor(options = {}) {
  return new UnifiedExecutor(options);
}

export default UnifiedExecutor;