/**
 * Mutation Control System
 * 
 * Provides controlled skill mutation with:
 * - Mutation gating (when to mutate)
 * - Mutation budget (how many mutations)
 * - Improvement threshold (minimum improvement required)
 * - Lineage tracking
 */

import { createVersion } from "./versioning.js";

/**
 * Mutation configuration
 */
const MUTATION_CONFIG = {
  minUsageForMutation: 5,           // Minimum uses before mutation allowed
  improvementThreshold: 0.1,      // New score must be at least 0.1 better
  maxMutationsPerSkill: 3,          // Maximum mutations per skill lifetime
  mutationCooldown: 3600000,        // 1 hour between mutations
  onlyTopPercentile: 30,            // Only mutate top 30% skills by score
  enableRegressionCheck: true       // Reject if new score < old score
};

/**
 * Check if skill should be mutated
 * Based on usage, history, performance, AND FAILURE RATE
 * 
 * @param {Object} skill - Skill to check
 * @param {Array} allSkills - All skills for percentile calculation
 * @returns {Object} { shouldMutate: boolean, reason: string }
 */
export function shouldMutate(skill, allSkills = []) {
  // FIX (D): Trigger mutation based on failure rate (not random)
  const failRate = (skill.failure_count || 0) / ((skill.usage_count || 1) + 1);
  if (failRate > 0.3) {
    return { 
      shouldMutate: true, 
      reason: "high_failure_rate",
      details: { failRate, failure_count: skill.failure_count, usage_count: skill.usage_count }
    };
  }
  
  // Check usage count
  if (skill.usage_count < MUTATION_CONFIG.minUsageForMutation) {
    return { 
      shouldMutate: false, 
      reason: "usage_below_threshold",
      details: { 
        current: skill.usage_count, 
        required: MUTATION_CONFIG.minUsageForMutation 
      }
    };
  }
  
  // Check mutation count budget
  if ((skill.mutation_count || 0) >= MUTATION_CONFIG.maxMutationsPerSkill) {
    return { 
      shouldMutate: false, 
      reason: "mutation_budget_exhausted",
      details: { 
        current: skill.mutation_count, 
        max: MUTATION_CONFIG.maxMutationsPerSkill 
      }
    };
  }
  
  // Check cooldown
  if (skill.last_mutated_at) {
    const timeSinceMutation = Date.now() - skill.last_mutated_at;
    if (timeSinceMutation < MUTATION_CONFIG.mutationCooldown) {
      return { 
        shouldMutate: false, 
        reason: "cooldown_period",
        details: { 
          remaining: MUTATION_CONFIG.mutationCooldown - timeSinceMutation 
        }
      };
    }
  }
  
  // Check if in top percentile (if we have other skills to compare)
  if (allSkills.length > 3) {
    const scores = allSkills
      .filter(s => s.capability === skill.capability)
      .map(s => s.score || 0)
      .sort((a, b) => b - a);
    
    const percentileIndex = Math.floor(scores.length * (MUTATION_CONFIG.onlyTopPercentile / 100));
    const threshold = scores[percentileIndex] || 0;
    
    if ((skill.score || 0) < threshold) {
      return { 
        shouldMutate: false, 
        reason: "not_in_top_percentile",
        details: { 
          skillScore: skill.score, 
          threshold 
        }
      };
    }
  }
  
  return { shouldMutate: true, reason: "ok" };
}

/**
 * Check if mutation result should be accepted
 * Only accepts if improvement meets threshold
 * 
 * @param {number} oldScore - Original skill score
 * @param {number} newScore - Mutated skill score
 * @returns {Object} { accept: boolean, reason: string }
 */
export function acceptMutation(oldScore, newScore) {
  if (!MUTATION_CONFIG.enableRegressionCheck) {
    return { accept: true, reason: "regression_check_disabled" };
  }
  
  const improvement = newScore - oldScore;
  
  if (improvement < 0) {
    return { 
      accept: false, 
      reason: "regression_detected",
      details: { oldScore, newScore, improvement }
    };
  }
  
  if (improvement < MUTATION_CONFIG.improvementThreshold) {
    return { 
      accept: false, 
      reason: "improvement_below_threshold",
      details: { improvement, threshold: MUTATION_CONFIG.improvementThreshold }
    };
  }
  
  return { 
    accept: true, 
    reason: "improvement_accepted",
    details: { improvement }
  };
}

/**
 * Mutate a skill with full control
 * - Creates new version
 * - Applies mutation logic
 * - Tracks lineage
 * 
 * @param {Object} skill - Original skill
 * @param {Object} mutationLogic - Custom mutation function
 * @returns {Object} New mutated skill
 */
export function mutateWithControl(skill, mutationLogic = null) {
  const mutationCheck = shouldMutate(skill);
  
  if (!mutationCheck.shouldMutate) {
    return {
      success: false,
      reason: mutationCheck.reason,
      details: mutationCheck.details,
      skill: null
    };
  }
  
  // Apply mutation
  let mutatedSkill;
  if (mutationLogic) {
    mutatedSkill = mutationLogic(skill);
  } else {
    mutatedSkill = mutateSkill(skill);
  }
  
  // Create version with lineage
  mutatedSkill = createVersion(skill, {
    parent_id: skill.id,
    mutation_number: (skill.mutation_count || 0) + 1
  });
  
  return {
    success: true,
    reason: "mutation_applied",
    skill: mutatedSkill,
    lineage: {
      parent_id: skill.id,
      child_id: mutatedSkill.id,
      generation: (skill.generation || 0) + 1
    }
  };
}

/**
 * Original simple mutation (kept for backward compatibility)
 * 
 * @param {Object} skill - Skill to mutate
 * @returns {Object} Mutated skill clone
 */
export function mutateSkill(skill) {
  const clone = JSON.parse(JSON.stringify(skill));

  if (!clone.logic || clone.logic.length === 0) return clone;

  const idx = Math.floor(Math.random() * clone.logic.length);
  const step = clone.logic[idx];

  if (step.op === "add") {
    step.op = Math.random() > 0.5 ? "add" : "subtract";
  }

  return clone;
}

export function mutateSkillSafe(skill, performanceHistory = []) {
  const newSkill = JSON.parse(JSON.stringify(skill));

  if (!newSkill.logic || newSkill.logic.length === 0) return newSkill;

  for (const step of newSkill.logic) {
    if (step.op === "compare") {
      const allowed = [">", "<", "=="];
      const bestOp = pickBestOperator(allowed, performanceHistory);
      if (bestOp) {
        step.operator = bestOp;
      }
    }

    if (step.op === "add" || step.op === "subtract" || step.op === "multiply" || step.op === "divide") {
      const operators = ["add", "subtract", "multiply", "divide"];
      const bestOp = pickBestOperator(operators, performanceHistory);
      if (bestOp) {
        step.op = bestOp;
      }
    }
  }

  return newSkill;
}

function pickBestOperator(allowed, history) {
  if (!history || history.length === 0) {
    return allowed[Math.floor(Math.random() * allowed.length)];
  }

  const scores = {};
  for (const op of allowed) {
    scores[op] = 0;
  }

  for (const record of history) {
    if (record.success && scores[record.operator] !== undefined) {
      scores[record.operator] += 1;
    }
  }

  let best = allowed[0];
  let maxScore = -1;
  for (const op of allowed) {
    if (scores[op] > maxScore) {
      maxScore = scores[op];
      best = op;
    }
  }

  return maxScore > 0 ? best : allowed[Math.floor(Math.random() * allowed.length)];
}

/**
 * Guided mutation - uses critic feedback to determine mutation direction
 * Instead of random mutations, this uses feedback signals to target specific improvements
 * 
 * @param {Object} skill - Original skill to mutate
 * @param {string} feedback - Feedback from critic (e.g., "missing step", "wrong operator")
 * @returns {Object} Mutated skill clone
 */
export function mutateSkillWithFeedback(skill, feedback = "") {
  const newSkill = structuredClone(skill);

  if (!newSkill.logic || newSkill.logic.length === 0) return newSkill;

  const feedbackLower = feedback.toLowerCase();

  if (feedbackLower.includes("missing step")) {
    newSkill.logic.push({
      op: "validate",
      path: "output"
    });
  }

  if (feedbackLower.includes("wrong operator") || feedbackLower.includes("incorrect operation")) {
    for (const step of newSkill.logic) {
      if (step.op === "add") {
        step.op = "multiply";
      } else if (step.op === "subtract") {
        step.op = "add";
      } else if (step.op === "multiply") {
        step.op = "add";
      }
    }
  }

  if (feedbackLower.includes("wrong order") || feedbackLower.includes("incorrect order")) {
    if (newSkill.logic.length > 1) {
      const first = newSkill.logic.shift();
      newSkill.logic.push(first);
    }
  }

  if (feedbackLower.includes("missing validation")) {
    const validateIndex = newSkill.logic.findIndex(s => s.op === "validate");
    if (validateIndex === -1) {
      newSkill.logic.push({
        op: "set",
        path: "_validated",
        value: true
      });
    }
  }

  if (feedbackLower.includes("error handling") || feedbackLower.includes("handle error")) {
    for (const step of newSkill.logic) {
      if (step.op === "divide") {
        if (!step.check) {
          step.check = "b !== 0";
        }
      }
    }
  }

  if (feedbackLower.includes("wrong path") || feedbackLower.includes("incorrect path")) {
    for (const step of newSkill.logic) {
      if (step.to) {
        step.to = step.to.replace(/\./g, "_");
      }
      if (step.path) {
        step.path = step.path.replace(/\./g, "_");
      }
    }
  }

  return newSkill;
}

export function mutateFromFailure(skill, failures) {
  const newSkill = JSON.parse(JSON.stringify(skill));

  if (failures.length === 0) return newSkill;

  const firstFailure = failures[0];
  const errorMsg = firstFailure.error || "";

  if (errorMsg.includes("timeout") || errorMsg.includes("timeout")) {
    for (const step of newSkill.logic) {
      if (step.op === "for" || step.op === "while") {
        step.maxLoops = (step.maxLoops || 1000) / 2;
      }
    }
  }

  if (errorMsg.includes("missing") || errorMsg.includes("undefined")) {
    for (const step of newSkill.logic) {
      if (step.op === "get" && step.path) {
        step.default = step.default ?? null;
      }
    }
  }

  if (errorMsg.includes("schema") || errorMsg.includes("validation")) {
    if (newSkill.logic.length > 0 && newSkill.logic[0].op === "set") {
      newSkill.logic.unshift({
        op: "set",
        path: "_validated",
        value: true
      });
    }
  }

  return newSkill;
}

/**
 * Get mutation config (for testing/debugging)
 */
export function getMutationConfig() {
  return { ...MUTATION_CONFIG };
}

/**
 * Update mutation config
 */
export function updateMutationConfig(updates) {
  Object.assign(MUTATION_CONFIG, updates);
}

/**
 * A/B Testing for Anti-Regression
 * Compares old vs new skill on test cases before accepting
 * 
 * @param {Object} oldSkill - Original skill
 * @param {Object} newSkill - Mutated skill
 * @param {Array} testCases - Test cases to evaluate
 * @param {Function} runDSL - Function to execute skill
 * @returns {Object} { accept: boolean, oldScore, newScore, reason }
 */
export async function compareSkills(oldSkill, newSkill, testCases, runDSL) {
  let oldScore = 0;
  let newScore = 0;

  for (const testCase of testCases) {
    try {
      const oldResult = await runDSL(oldSkill, testCase.input);
      const newResult = await runDSL(newSkill, testCase.input);

      oldScore += evaluateSingle(oldResult, testCase.expected);
      newScore += evaluateSingle(newResult, testCase.expected);
    } catch (e) {
      oldScore += 0;
      newScore += 0;
    }
  }

  const avgOld = testCases.length > 0 ? oldScore / testCases.length : 0;
  const avgNew = testCases.length > 0 ? newScore / testCases.length : 0;

  return {
    accept: avgNew > avgOld,
    oldScore: avgOld,
    newScore: avgNew,
    reason: avgNew > avgOld ? "improvement" : "no_improvement"
  };
}

function evaluateSingle(result, expected) {
  if (!result) return expected === null ? 1 : 0;
  if (expected === null) return result.error ? 1 : 0;
  
  const actual = result.result ?? result.value ?? result;
  const exp = expected.result ?? expected.value ?? expected;
  
  if (typeof actual === "number" && typeof exp === "number") {
    return Math.abs(actual - exp) < 1e-9 ? 1 : 0;
  }
  return actual === exp ? 1 : 0;
}

// ============== TARGETED MUTATION (FIX #3) ==============

export function mutateSkillFromFailure(skill, failureTrace) {
  const newSkill = structuredClone(skill);

  if (!newSkill.logic || newSkill.logic.length === 0) return newSkill;

  const failedStep = failureTrace?.lastFailedStep ?? failureTrace?.stepIndex ?? 0;

  if (failedStep >= newSkill.logic.length) {
    return newSkill;
  }

  const step = newSkill.logic[failedStep];
  const errorMsg = failureTrace?.error?.message || "";

  if (errorMsg.includes("invalid") || errorMsg.includes("parse")) {
    if (step.op === "mcp_call") {
      step.op = "mcp_call";
    }
  }

  if (errorMsg.includes("timeout")) {
    if (step.op === "for" || step.op === "while") {
      step.maxLoops = (step.maxLoops || 1000) / 2;
    }
  }

  if (errorMsg.includes("schema") || errorMsg.includes("validation")) {
    step.expect_schema = step.output_schema || step.expect_schema;
  }

  return newSkill;
}

function suggestBetterOp(step) {
  return step.op;
}
