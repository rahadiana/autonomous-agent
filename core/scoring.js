/**
 * Simple scoring helper for backward compatibility
 * Note: New code should use evaluateSkill() from testRunner.js instead
 */

import { validate } from "./validator.js";

export const WEIGHTS = {
  correctness: 0.4,
  schema_validity: 0.2,
  efficiency: 0.15,
  reuse: 0.15,
  latency: 0.1
};

export function globalScore({
  correctness = 0,
  schema_validity = 0,
  efficiency = 0,
  reuse = 0,
  latency = 0
}) {
  return (
    correctness * WEIGHTS.correctness +
    schema_validity * WEIGHTS.schema_validity +
    efficiency * WEIGHTS.efficiency +
    reuse * WEIGHTS.reuse +
    latency * WEIGHTS.latency
  );
}

/**
 * Calculate latency score (0-1, higher is better)
 * @param {number} latencyMs - execution time in ms
 * @param {number} thresholdMs - threshold for full score
 */
export function latencyScore(latencyMs, thresholdMs = 1000) {
  if (latencyMs <= 0) return 1;
  if (latencyMs >= thresholdMs * 2) return 0;
  return Math.max(0, 1 - latencyMs / thresholdMs);
}

/**
 * Calculate efficiency score based on step usage
 * @param {number} stepsUsed - steps executed
 * @param {number} maxSteps - maximum allowed steps
 */
export function efficiencyScore(stepsUsed, maxSteps = 20) {
  if (stepsUsed <= 0) return 1;
  if (stepsUsed >= maxSteps) return 0;
  return Math.max(0, 1 - stepsUsed / maxSteps);
}

/**
 * Basic scoring based on validation result only
 * @deprecated Use evaluateSkill() from testRunner.js for proper evaluation
 * @param {any} result - skill output
 * @param {boolean} valid - schema validation result
 * @returns {number} score between 0 and 1
 */
export function evaluate(result, valid) {
  // Simple binary score - valid = 1, invalid = 0
  // This is kept for backward compatibility only
  return valid ? 1.0 : 0.0;
}

/**
 * Calculate score from evaluation result
 * Used by other parts of the system that expect evaluate() format
 * @param {Object} evalResult - result from evaluateSkill()
 * @returns {number} score between 0 and 1
 */
export function scoreFromEvaluation(evalResult) {
  if (!evalResult) return 0;
  return evalResult.score || 0;
}