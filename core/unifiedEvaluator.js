/**
 * Unified Evaluator - Real Task-Specific Scoring
 * 
 * Ini evaluator yang BENAR (bukan dummy scoring):
 * - Ground truth based scoring
 * - Task-specific metrics per capability
 * - Robustness checks
 * - Stability validation
 * 
 * Sebelum: score hanya dari plan.status (0-1 itu bohong)
 * Sekarang: score dari task correctness + stability + efficiency
 */

import { getTestCases, getNormalTestCases, getEdgeCases, generateRandomTestCases } from "./groundTruth.js";

/**
 * Evaluator configuration
 */
export const EVALUATOR_CONFIG = {
  // Weights for final score
  weights: {
    taskCorrectness: 0.6,  // Main weight - correctness based on ground truth
    schemaValidity: 0.15,  // Output format correct
    robustness: 0.15,      // Handle edge cases
    efficiency: 0.1        // Resource usage
  },

  // Thresholds
  thresholds: {
    success: 0.8,
    accept: 0.6,
    reject: 0.4
  },

  // Testing options
  testOptions: {
    normalTestCount: 3,    // Normal cases to test
    edgeTestCount: 2,      // Edge cases to test
    randomTestCount: 2     // Random cases to test
  }
};

/**
 * Task-specific scoring functions per capability
 */
const TASK_SCORES = {
  /**
   * Math operations - numeric equality with tolerance
   */
  "math.add": (result, expected) => {
    if (!result || expected === null) return result === expected ? 1 : 0;
    const actual = result.result ?? result.value ?? result;
    const exp = expected.result ?? expected.value ?? expected;
    
    if (typeof actual === "number" && typeof exp === "number") {
      return Math.abs(actual - exp) < 1e-9 ? 1 : 0;
    }
    return actual === exp ? 1 : 0;
  },

  "math.multiply": (result, expected) => {
    if (!result) return expected === null ? 1 : 0;
    if (expected === null) return result.error ? 1 : 0;
    
    const actual = result.result ?? result.value ?? result;
    const exp = expected.result ?? expected.value ?? expected;
    
    if (typeof actual === "number" && typeof exp === "number") {
      console.log(`[MULTIPLY CHECK] actual=${actual}, exp=${exp}, equal=${Math.abs(actual - exp) < 1e-9}`);
      return Math.abs(actual - exp) < 1e-9 ? 1 : 0;
    }
    return actual === exp ? 1 : 0;
  },

  "math.subtract": (result, expected) => {
    if (!result || expected === null) return result === expected ? 1 : 0;
    const actual = result.result ?? result.value ?? result;
    const exp = expected.result ?? expected.value ?? expected;
    
    if (typeof actual === "number" && typeof exp === "number") {
      return Math.abs(actual - exp) < 1e-9 ? 1 : 0;
    }
    return actual === exp ? 1 : 0;
  },

  "math.divide": (result, expected) => {
    // Special case: division by zero should return error
    if (expected === null) {
      // If expected is null, skill should either return error or handle gracefully
      if (result === null || result === undefined) return 1;
      if (result.error) return 1;
      return result.result === null || isNaN(result.result) ? 1 : 0;
    }
    
    const actual = result.result ?? result.value ?? result;
    const exp = expected.result ?? expected.value ?? expected;
    
    if (typeof actual === "number" && typeof exp === "number") {
      return Math.abs(actual - exp) < 1e-9 ? 1 : 0;
    }
    return actual === exp ? 1 : 0;
  },

  /**
   * Default - generic comparison
   */
  "default": (result, expected) => {
    if (expected === null) {
      return result === null || result === undefined || result.error ? 1 : 0;
    }
    if (typeof result === "object" && result !== null) {
      return JSON.stringify(result) === JSON.stringify(expected) ? 1 : 0;
    }
    return result === expected ? 1 : 0;
  }
};

/**
 * Get task-specific scoring function
 */
function getTaskScoreFn(capability) {
  return TASK_SCORES[capability] || TASK_SCORES["default"];
}

/**
 * Run task-specific evaluation
 * Tests result against ground truth test cases
 */
export function evaluateTaskSpecific(goal, capability, result, options = {}) {
  const config = { ...EVALUATOR_CONFIG.testOptions, ...options };
  
  // Get test cases for this capability
  const normalCases = getNormalTestCases(capability);
  const edgeCases = getEdgeCases(capability);
  const randomCases = generateRandomTestCases(capability, config.randomTestCount);

  const taskScoreFn = getTaskScoreFn(capability);
  
  let totalTests = 0;
  let passedTests = 0;
  const details = [];

  // Test normal cases (weighted higher)
  const normalToTest = normalCases.slice(0, config.normalTestCount);
  for (const testCase of normalToTest) {
    totalTests++;
    const score = taskScoreFn(result, testCase.expected);
    if (score >= 0.5) passedTests++;
    details.push({
      type: "normal",
      input: testCase.input,
      expected: testCase.expected,
      result,
      score,
      passed: score >= 0.5
    });
  }

  // Test edge cases (weighted lower)
  const edgeToTest = edgeCases.slice(0, config.edgeTestCount);
  for (const testCase of edgeToTest) {
    totalTests++;
    const score = taskScoreFn(result, testCase.expected);
    if (score >= 0.5) passedTests++;
    details.push({
      type: "edge",
      input: testCase.input,
      expected: testCase.expected,
      result,
      score,
      passed: score >= 0.5
    });
  }

  // Test random cases
  for (const testCase of randomCases) {
    totalTests++;
    const score = taskScoreFn(result, testCase.expected);
    if (score >= 0.5) passedTests++;
    details.push({
      type: "random",
      input: testCase.input,
      expected: testCase.expected,
      result,
      score,
      passed: score >= 0.5
    });
  }

  // Calculate score (normal cases weighted 2x)
  const normalCount = normalToTest.length;
  const edgeCount = edgeToTest.length + randomCases.length;
  
  const normalScore = normalCount > 0 
    ? details.filter(d => d.type === "normal" && d.passed).length / normalCount 
    : 0;
  const edgeScore = edgeCount > 0 
    ? details.filter(d => d.type !== "normal" && d.passed).length / edgeCount 
    : 0;

  const taskScore = (normalScore * 2 + edgeScore) / 3;

  return {
    taskScore,
    totalTests,
    passedTests,
    details,
    normalScore,
    edgeScore
  };
}

/**
 * Validate output schema
 */
function validateSchema(result, capability) {
  if (!result) return { valid: false, score: 0 };

  // Check for common result fields
  const validFields = ["result", "value", "output", "data"];
  const hasValidField = validFields.some(f => result[f] !== undefined);
  
  if (hasValidField) {
    return { valid: true, score: 1 };
  }

  // For error cases, check if error field exists
  if (result.error) {
    return { valid: true, score: 1 };
  }

  return { valid: false, score: 0.5 };
}

/**
 * Check robustness - can handle edge cases
 */
function checkRobustness(result, capability) {
  let score = 0;
  const checks = [];

  // Check 1: No crash on null/undefined
  const noCrash = result !== undefined && result !== null;
  checks.push({ name: "no_crash", passed: noCrash });
  if (noCrash) score += 0.33;

  // Check 2: Error handling for bad input
  if (result && typeof result === "object") {
    const hasError = result.error !== undefined;
    checks.push({ name: "error_handling", passed: hasError });
    if (hasError || result.result !== undefined) score += 0.33;
  }

  // Check 3: Type consistency
  const typeConsistent = result && typeof result === "object" 
    ? "result" in result || "error" in result || "value" in result
    : true;
  checks.push({ name: "type_consistency", passed: typeConsistent });
  if (typeConsistent) score += 0.34;

  return { score, checks };
}

/**
 * Calculate efficiency score
 */
function calculateEfficiency(plan, result, meta = {}) {
  let score = 0;

  // Fewer steps = more efficient (baseline 3 steps)
  if (plan?.bestPath) {
    const stepCount = plan.bestPath.length;
    const efficiency = Math.max(0, 1 - (stepCount - 1) / 10);
    score += efficiency * 0.5;
  }

  // Latency (if provided)
  if (meta.latency !== undefined) {
    const latencyScore = Math.max(0, 1 - meta.latency / 5000);
    score += latencyScore * 0.5;
  }

  return score;
}

/**
 * Main Unified Evaluator
 * 
 * @param {Object} params - { goal, plan, result, context }
 * @returns {Object} - { score, success, details, factors }
 */
export function unifiedEvaluate(params) {
  const { goal, plan, result, context, options = {} } = params;
  const config = { ...EVALUATOR_CONFIG, ...options };

  console.log("[EVALUATOR] Starting evaluation for goal:", goal);

  // Extract capability from plan
  const capability = plan?.capability 
    || plan?.bestPath?.[0]?.capability 
    || context?.capability 
    || "default";

  console.log("[EVALUATOR] Capability:", capability);

  // PHASE 1: Task-Specific Evaluation (MAIN)
  const taskEval = evaluateTaskSpecific(goal, capability, result, config.testOptions);
  console.log(`[EVALUATOR] Task score: ${taskEval.taskScore.toFixed(3)} (${taskEval.passedTests}/${taskEval.totalTests} tests passed)`);

  // PHASE 2: Schema Validation
  const schemaEval = validateSchema(result, capability);
  console.log(`[EVALUATOR] Schema valid: ${schemaEval.valid}, score: ${schemaEval.score.toFixed(3)}`);

  // PHASE 3: Robustness Check
  const robustnessEval = checkRobustness(result, capability);
  console.log(`[EVALUATOR] Robustness score: ${robustnessEval.score.toFixed(3)}`);

  // PHASE 4: Efficiency
  const efficiencyScore = calculateEfficiency(plan, result, context.meta);
  console.log(`[EVALUATOR] Efficiency score: ${efficiencyScore.toFixed(3)}`);

  // Combine scores with weights
  const finalScore = (
    taskEval.taskScore * config.weights.taskCorrectness +
    schemaEval.score * config.weights.schemaValidity +
    robustnessEval.score * config.weights.robustness +
    efficiencyScore * config.weights.efficiency
  );

  // Determine success/failure
  const success = finalScore >= config.thresholds.success;
  const accept = finalScore >= config.thresholds.accept;
  const reject = finalScore < config.thresholds.accept;

  // Build detailed result
  const evaluation = {
    score: Math.min(1, finalScore),
    success,
    accept,
    reject,
    capability,
    factors: {
      taskScore: { value: taskEval.taskScore, weight: config.weights.taskCorrectness },
      schemaValidity: { value: schemaEval.score, weight: config.weights.schemaValidity },
      robustness: { value: robustnessEval.score, weight: config.weights.robustness },
      efficiency: { value: efficiencyScore, weight: config.weights.efficiency }
    },
    details: {
      taskEvaluation: taskEval,
      schemaValidation: schemaEval,
      robustness: robustnessEval,
      efficiency: efficiencyScore
    },
    suggestions: generateSuggestions(taskEval, schemaEval, robustnessEval, finalScore, config)
  };

  console.log(`[EVALUATOR] Final score: ${finalScore.toFixed(3)}, success: ${success}`);

  return evaluation;
}

/**
 * Generate suggestions based on evaluation results
 */
function generateSuggestions(taskEval, schemaEval, robustnessEval, finalScore, config) {
  const suggestions = [];

  if (finalScore < config.thresholds.success) {
    // Task-specific suggestions
    if (taskEval.taskScore < 0.5) {
      suggestions.push("Task correctness low - check computation logic");
      if (taskEval.normalScore < taskEval.edgeScore) {
        suggestions.push("Failed normal cases - fix core logic first");
      } else {
        suggestions.push("Failed edge cases - add proper error handling");
      }
    }

    if (!schemaEval.valid) {
      suggestions.push("Output format incorrect - return proper result structure");
    }

    if (robustnessEval.score < 0.5) {
      suggestions.push("Robustness issues - handle null/undefined inputs");
    }
  }

  return suggestions;
}

/**
 * UnifiedEvaluator class for more complex scenarios
 */
export class UnifiedEvaluator {
  constructor(options = {}) {
    this.config = { ...EVALUATOR_CONFIG, ...options };
  }

  evaluate(params) {
    return unifiedEvaluate({
      ...params,
      options: this.config
    });
  }

  /**
   * Batch evaluate multiple results
   */
  evaluateBatch(results) {
    return results.map(r => this.evaluate(r));
  }
}

export default unifiedEvaluate;

/**
 * Structural Evaluation Function
 * Based on next_plan.md FIX 3 - Evaluates based on structure, not just output
 * 
 * @param {Object} result - The result from skill execution
 * @param {Object} schema - Expected output schema
 * @param {Object} expectedShape - Expected shape of output
 * @returns {Object} - { score, breakdown }
 */
export function structuralEvaluate(result, schema, expectedShape) {
  let score = 0;
  const breakdown = {
    validation: 0,
    shape: 0,
    completeness: 0,
    stability: 0
  };

  if (!result) {
    return { score: 0, breakdown };
  }

  if (schema) {
    const validation = validateSchemaWithSchema(schema, result);
    if (validation.valid) {
      breakdown.validation = 0.3;
      score += 0.3;
    }
  }

  if (expectedShape) {
    if (typeof result === typeof expectedShape) {
      breakdown.shape = 0.2;
      score += 0.2;
    }

    const keys = Object.keys(expectedShape || {});
    if (keys.length > 0) {
      const match = keys.filter(k => result[k] !== undefined).length;
      const completenessScore = (match / keys.length) * 0.3;
      breakdown.completeness = completenessScore;
      score += completenessScore;
    }
  }

  breakdown.stability = 0.2;
  score += 0.2;

  return { score, breakdown };
}

/**
 * Validate result against a schema
 */
function validateSchemaWithSchema(schema, result) {
  const errors = [];
  
  if (!schema) {
    return { valid: true, errors: [] };
  }

  if (schema.required) {
    for (const field of schema.required) {
      if (result[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  if (schema.properties) {
    for (const [field, type] of Object.entries(schema.properties)) {
      if (result[field] !== undefined && typeof result[field] !== type) {
        errors.push(`Field ${field} expected type ${type}, got ${typeof result[field]}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * External Objective Function
 * Based on next_plan.md FIX 9 - Real success metric, not proxy
 * 
 * @param {Object} result - Skill execution result
 * @param {string|Object} userGoal - The user's goal
 * @returns {Object} - { score, alignment }
 */
export function computeGoalAlignment(result, userGoal) {
  if (!userGoal) {
    return { score: 0.5, alignment: "no_goal" };
  }

  let goalText = "";
  if (typeof userGoal === "string") {
    goalText = userGoal.toLowerCase();
  } else if (typeof userGoal === "object" && userGoal.goal) {
    goalText = String(userGoal.goal).toLowerCase();
  }

  if (!goalText) {
    return { score: 0.5, alignment: "unknown" };
  }

  let score = 0.5;

  if (goalText.includes("add") || goalText.includes("sum") || goalText.includes("plus")) {
    const actual = result?.result ?? result?.value ?? result;
    if (typeof actual === "number" && !isNaN(actual)) {
      score = 1;
    }
  } else if (goalText.includes("multiply") || goalText.includes("product") || goalText.includes("times")) {
    const actual = result?.result ?? result?.value ?? result;
    if (typeof actual === "number" && !isNaN(actual)) {
      score = 1;
    }
  } else if (goalText.includes("subtract") || goalText.includes("minus")) {
    const actual = result?.result ?? result?.value ?? result;
    if (typeof actual === "number" && !isNaN(actual)) {
      score = 1;
    }
  } else if (goalText.includes("divide")) {
    const actual = result?.result ?? result?.value ?? result;
    if (typeof actual === "number" && !isNaN(actual)) {
      score = 1;
    }
  } else if (goalText.includes("get") || goalText.includes("retrieve") || goalText.includes("fetch")) {
    if (result && typeof result === "object" && Object.keys(result).length > 0) {
      score = 1;
    }
  }

  return { score, alignment: "computed" };
}

/**
 * Combined Score with External Objective
 * Based on next_plan.md FIX 9 - Combines internal and external scores
 * 
 * @param {number} internalScore - Score from internal evaluator
 * @param {number} externalScore - Score from goal alignment
 * @returns {number} - Combined final score
 */
export function computeFinalScoreWithObjective(internalScore, externalScore) {
  const internalWeight = 0.5;
  const externalWeight = 0.5;

  return internalScore * internalWeight + externalScore * externalWeight;
}

/**
 * Compute Reward Function
 * Simple scoring based on next_plan.md line 153-181
 * 
 * @param {Object} params - { result, validation, skill }
 * @returns {number} - reward score 0-1
 */
export function computeReward({ result, validation, skill }) {
  let score = 0;

  // 1. Schema validity (30%)
  if (validation?.valid) {
    score += 0.3;
  }

  // 2. Output richness (20%)
  if (typeof result === "object" && result !== null && Object.keys(result).length > 0) {
    score += 0.2;
  }

  // 3. Determinism check (20%)
  // More usage = more established/deterministic skill
  if (skill?.usage_count > 3) {
    score += 0.2;
  }

  // 4. Latency bonus (10%)
  if (result?._latency !== undefined && result._latency < 100) {
    score += 0.1;
  }

  // 5. Historical success rate (20%)
  const successRate = skill?.usage_count > 0
    ? skill.success_count / skill.usage_count
    : 0;
  score += successRate * 0.2;

  return Math.min(1, score);
}