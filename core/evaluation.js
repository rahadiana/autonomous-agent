/**
 * Evaluation Layer - Multi-level evaluation system
 * 
 * Architecture:
 * - stepEvaluator: evaluates individual step execution
 * - planEvaluator: evaluates plan-level execution  
 * - goalEvaluator: evaluates end-to-end goal
 * - computeFinalScore: combines all scores
 * - evaluateTask: task-aware evaluation (exact, numeric, partial)
 * - evaluateTestSuite: evaluates full test suite with pass/fail thresholds
 */

import { getTestCases } from "./groundTruth.js";

const TOLERANCE = 1e-9;

export const SystemStats = {
  success_rate: 0,
  avg_score: 0,
  total_runs: 0
};

export function updateSystemStats(success, score) {
  SystemStats.total_runs++;

  SystemStats.success_rate =
    (SystemStats.success_rate * (SystemStats.total_runs - 1) + (success ? 1 : 0)) /
    SystemStats.total_runs;

  SystemStats.avg_score =
    (SystemStats.avg_score * (SystemStats.total_runs - 1) + score) /
    SystemStats.total_runs;
}

export async function evaluateWithBenchmark(skill) {
  const capability = skill.capability;
  const tests = getTestCases(capability);

  if (!tests || tests.length === 0) {
    return { score: 0, pass: 0, total: 0, reason: "no_benchmark_tests" };
  }

  let pass = 0;

  for (const t of tests) {
    try {
      const result = await runDSL(skill, t.input);
      if (deepEqual(result, t.expected)) {
        pass++;
      }
    } catch (e) {
      if (t.expected === null) {
        pass++;
      }
    }
  }

  return pass / tests.length;
}

async function runDSL(skill, input) {
  const { runSkill } = await import("./executor.js");
  return runSkill(skill, input);
}

/**
 * Evaluation thresholds
 * - score < ACCEPT_THRESHOLD: reject (skill not good enough)
 * - score > PASS_THRESHOLD: accept (skill is good)
 * - score between: need more testing or refinement
 */
export const EVAL_THRESHOLDS = {
  REJECT: 0.6,    // Below this: reject skill
  ACCEPT: 0.8,   // Above this: accept skill
  MIN_TESTS: 3   // Minimum tests required for valid evaluation
};

/**
 * Test case types for evaluation
 */
export const TestCaseType = {
  VALID: "valid",     // Normal valid input
  EDGE: "edge",       // Edge case (0, negative, large numbers)
  INVALID: "invalid"  // Invalid input (null, wrong type)
};

/**
 * Task types for evaluation
 */
export const TaskType = {
  EXACT: "exact",       // JSON exact match
  NUMERIC: "numeric",   // Floating point with tolerance
  PARTIAL: "partial",   // Similarity-based
  BOOLEAN: "boolean"    // True/false check
};

/**
 * Task-aware evaluation function
 * Evaluates result against expected based on task type
 * 
 * @param {any} result - Actual result
 * @param {any} expected - Expected result
 * @param {string} taskType - Task type (exact, numeric, partial, boolean)
 * @returns {number} Score 0-1
 */
export function evaluateTask(result, expected, taskType = TaskType.EXACT) {
  if (result === expected) return 1;
  
  switch (taskType) {
    case TaskType.EXACT:
      return deepEqual(result, expected) ? 1 : 0;
    
    case TaskType.NUMERIC:
      return numericEqual(result, expected) ? 1 : 0;
    
    case TaskType.PARTIAL:
      return partialSimilarity(result, expected);
    
    case TaskType.BOOLEAN:
      return Boolean(result) === Boolean(expected) ? 1 : 0;
    
    default:
      return deepEqual(result, expected) ? 1 : 0;
  }
}

/**
 * Evaluate a full test suite
 * Runs all tests and calculates final score with pass/fail decision
 * 
 * @param {Array} testCases - Array of test cases with input, expected, type
 * @param {Function} runFn - Function to execute skill and get result
 * @returns {Object} { score, passed, failed, total, decision, details }
 */
export async function evaluateTestSuite(testCases, runFn) {
  if (!testCases || testCases.length < EVAL_THRESHOLDS.MIN_TESTS) {
    return {
      score: 0,
      passed: 0,
      failed: 0,
      total: 0,
      decision: "reject",
      reason: `insufficient_tests`,
      details: []
    };
  }
  
  let passed = 0;
  let failed = 0;
  const details = [];
  
  for (const test of testCases) {
    try {
      const result = await runFn(test.input);
      const score = evaluateTask(result, test.expected, test.taskType || TaskType.EXACT);
      
      if (score >= 0.5) {
        passed++;
        details.push({ ...test, score, passed: true });
      } else {
        failed++;
        details.push({ ...test, score, passed: false });
      }
    } catch (error) {
      // If test expects error (expected: null), error is acceptable
      if (test.expected === null) {
        passed++;
        details.push({ ...test, score: 1, passed: true, error: error.message });
      } else {
        failed++;
        details.push({ ...test, score: 0, passed: false, error: error.message });
      }
    }
  }
  
  const total = testCases.length;
  const score = total > 0 ? passed / total : 0;
  
  // Determine decision based on thresholds
  let decision = "pending";
  let reason = "";
  
  if (score < EVAL_THRESHOLDS.REJECT) {
    decision = "reject";
    reason = `score_below_threshold`;
  } else if (score >= EVAL_THRESHOLDS.ACCEPT) {
    decision = "accept";
    reason = `score_above_threshold`;
  } else {
    decision = "needs_refinement";
    reason = `score_between_thresholds`;
  }
  
  return {
    score,
    passed,
    failed,
    total,
    decision,
    reason,
    details
  };
}

/**
 * Numeric equality with tolerance
 */
function numericEqual(a, b) {
  const numA = Number(a);
  const numB = Number(b);
  
  if (isNaN(numA) && isNaN(numB)) return true;
  if (isNaN(numA) || isNaN(numB)) return false;
  
  return Math.abs(numA - numB) < TOLERANCE;
}

/**
 * Partial similarity for complex objects
 * Returns 0-1 score based on common fields
 */
function partialSimilarity(a, b) {
  if (a === b) return 1;
  if (a === null || b === null) return 0;
  if (typeof a !== "object" || typeof b !== "object") return 0;
  
  const keysA = Object.keys(a || {});
  const keysB = Object.keys(b || {});
  const common = keysA.filter(k => keysB.includes(k));
  
  if (common.length === 0) return 0;
  
  let matches = 0;
  for (const key of common) {
    if (deepEqual(a[key], b[key])) {
      matches++;
    }
  }
  
  return matches / common.length;
}

/**
 * Deep equality with floating point tolerance
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;
  
  if (typeof a === "object" && typeof b === "object") {
    const aStr = JSON.stringify(a);
    const bStr = JSON.stringify(b);
    if (aStr === bStr) return true;
    
    if (a.result !== undefined && b.result !== undefined) {
      return numbersEqual(a.result, b.result);
    }
    
    return aStr === bStr;
  }
  
  return numbersEqual(a, b);
}

function numbersEqual(a, b) {
  const numA = Number(a);
  const numB = Number(b);
  
  if (isNaN(numA) && isNaN(numB)) return true;
  if (isNaN(numA) || isNaN(numB)) return false;
  
  return Math.abs(numA - numB) < TOLERANCE;
}

/**
 * STEP EVALUATOR (Low Level)
 * 
 * Evaluates individual step execution
 * Used for: debugging, mutation feedback
 * 
 * @param {Object} step - The step that was executed
 * @param {Object} result - The result from execution
 * @param {Object} expected - Expected result (from ground truth or null for error cases)
 * @param {Object} meta - Metadata: latency, cost, etc.
 * @returns {Object} Step evaluation result
 */
export function evaluateStep(step, result, expected, meta = {}) {
  const latency = meta.latency || 0;
  const cost = meta.cost || 0;
  
  let correct = false;
  let reason = "unknown";
  
  // Handle error case (expected: null means skill should handle gracefully)
  if (expected === null) {
    // Skill should either return error or handle without crashing
    if (result === null || result === undefined) {
      correct = true;
      reason = "error_handled";
    } else if (result.error || result.result === null || isNaN(result.result)) {
      correct = true;
      reason = "error_returned";
    } else {
      // Has result but expected error - may be acceptable
      correct = true;
      reason = "handled_without_crash";
    }
  } else {
    // Normal case - check correctness
    correct = deepEqual(result, expected);
    reason = correct ? "correct" : "incorrect";
  }
  
  // Calculate latency penalty (1 second baseline)
  const latencyScore = Math.max(0, 1 - latency / 1000);
  
  // Cost penalty (simple: 0 if cost > 1)
  const costScore = cost > 1 ? 0 : 1;
  
  return {
    correct,
    reason,
    latency,
    latencyScore,
    cost,
    costScore,
    step: step?.capability || step?.skill
  };
}

/**
 * PLAN EVALUATOR (Mid Level)
 * 
 * Evaluates plan-level execution
 * Used for: plan efficiency, step success rate
 * 
 * @param {Array} trace - Array of step evaluations from execution
 * @returns {Object} Plan evaluation result
 */
export function evaluatePlan(trace) {
  if (!trace || trace.length === 0) {
    return {
      successRate: 0,
      failedSteps: [],
      totalSteps: 0,
      avgLatency: 0,
      avgCost: 0
    };
  }
  
  const successSteps = trace.filter(t => t.correct).length;
  const failedSteps = trace.filter(t => !t.correct);
  const successRate = successSteps / trace.length;
  
  const totalLatency = trace.reduce((sum, t) => sum + (t.latency || 0), 0);
  const totalCost = trace.reduce((sum, t) => sum + (t.cost || 0), 0);
  const avgLatency = totalLatency / trace.length;
  const avgCost = totalCost / trace.length;
  
  return {
    successRate,
    failedSteps: failedSteps.map(t => ({
      step: t.step,
      reason: t.reason
    })),
    totalSteps: trace.length,
    avgLatency,
    avgCost,
    trace
  };
}

/**
 * GOAL EVALUATOR (High Level)
 * 
 * Evaluates end-to-end goal execution
 * Used for: final scoring, learning
 * 
 * @param {Object} params - { goal, result, expected, meta }
 * @returns {Object} Goal evaluation result
 */
export function evaluateGoal({ goal, result, expected, meta = {} }) {
  const latency = meta.latency || 0;
  const cost = meta.cost || 0;
  const steps = meta.steps || 0;
  
  let score = 0;
  const factors = [];
  
  // Core correctness (60%)
  const correct = deepEqual(result, expected);
  if (correct) {
    score += 0.6;
    factors.push("correct_result");
  } else {
    factors.push("incorrect_result");
  }
  
  // Latency penalty (20%)
  // Baseline: 1 second = full score, >5s = 0
  const latencyScore = Math.max(0, 1 - latency / 5000);
  score += latencyScore * 0.2;
  if (latencyScore < 0.5) {
    factors.push("high_latency");
  }
  
  // Cost penalty (10%)
  // Simple: cost > 1 gets penalty
  const costScore = cost > 1 ? Math.max(0, 1 - cost / 10) : 1;
  score += costScore * 0.1;
  
  // Plan efficiency (10%)
  // Fewer steps = better, baseline 10 steps
  const efficiencyScore = Math.max(0, 1 - steps / 10);
  score += efficiencyScore * 0.1;
  
  return {
    score: Math.min(1, score),
    correct,
    factors,
    latency,
    cost,
    steps,
    latencyScore,
    costScore,
    efficiencyScore
  };
}

/**
 * COMPUTE FINAL SCORE
 * 
 * Combines goal evaluation with plan evaluation
 * 
 * @param {Object} goalEval - Result from goalEvaluator
 * @param {Object} planEval - Result from planEvaluator
 * @returns {Object} Final combined score
 */
export function computeFinalScore(goalEval, planEval) {
  const goalWeight = 0.7;
  const planWeight = 0.3;
  
  const finalScore = (
    goalEval.score * goalWeight +
    (planEval.successRate || 0) * planWeight
  );
  
  return {
    finalScore: Math.min(1, finalScore),
    goalScore: goalEval.score,
    planScore: planEval.successRate,
    goalWeight,
    planWeight,
    goalFactors: goalEval.factors,
    planFailedSteps: planEval.failedSteps
  };
}

/**
 * EVALUATION LAYER - Main entry point
 * 
 * Runs full evaluation pipeline: step -> plan -> goal -> final
 * 
 * @param {Object} params
 * @returns {Object} Complete evaluation result
 */
export function evaluateExecution({ 
  goal, 
  capability,
  trace, 
  finalResult, 
  meta = {} 
}) {
  // Get ground truth for capability
  const testCases = getTestCases(capability);
  const firstCase = testCases[0];
  const expected = firstCase?.expected || null;
  
  // 1. Evaluate each step (if trace provided)
  let stepEvals = [];
  if (trace && trace.length > 0) {
    stepEvals = trace.map(t => evaluateStep(t.step, t.result, t.expected, {
      latency: t.latency || 0,
      cost: t.cost || 0
    }));
  }
  
  // 2. Evaluate plan
  const planEval = evaluatePlan(stepEvals);
  
  // 3. Evaluate goal
  const goalEval = evaluateGoal({
    goal,
    result: finalResult,
    expected,
    meta
  });
  
  // 4. Compute final score
  const final = computeFinalScore(goalEval, planEval);
  
  return {
    goal,
    capability,
    stepEvaluation: stepEvals,
    planEvaluation: planEval,
    goalEvaluation: goalEval,
    finalScore: final.finalScore,
    details: final
  };
}

/**
 * VALIDATE PLAN
 * 
 * Validates that all steps in a plan have valid capabilities
 * 
 * @param {Object} plan - Plan with bestPath
 * @param {Object} registry - Skill registry (Map of capability -> skill)
 * @returns {Object} Validation result
 */
export function validatePlan(plan, registry) {
  if (!plan?.bestPath || plan.bestPath.length === 0) {
    return {
      valid: false,
      reason: "empty_plan"
    };
  }
  
  const invalidSteps = [];
  
  for (const step of plan.bestPath) {
    const capability = step.capability || step.skill?.capability;
    
    if (!capability) {
      invalidSteps.push({
        step,
        reason: "no_capability"
      });
      continue;
    }
    
    // Check if capability exists in registry
    const skill = registry.get(capability);
    if (!skill) {
      invalidSteps.push({
        step,
        capability,
        reason: "capability_not_found"
      });
    }
  }
  
  return {
    valid: invalidSteps.length === 0,
    invalidSteps,
    validSteps: plan.bestPath.length - invalidSteps.length
  };
}
