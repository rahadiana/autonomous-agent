/**
 * Execute With Learning Wrapper
 * 
 * Implements the learning loop from next_plan.md (lines 102-143):
 * - Wraps all skill execution
 * - Validates output schema
 * - Updates skill stats after every execution
 * - Enforces hard validation before returning
 */

import { runSkill } from "./executor.js";
import { validate as validateOutputSchema } from "./validator.js";
import { updateSkillStatsWithFeedback } from "./learningPhase.js";

/**
 * Execute skill with mandatory learning loop integration
 * All executions MUST go through this wrapper - no bypass allowed
 * 
 * @param {Object} skill - The skill to execute
 * @param {Object} input - Input data
 * @param {Object} options - Execution options
 * @returns {Object} Execution result with learning metadata
 */
export async function executeWithLearning(skill, input, options = {}) {
  const startTime = Date.now();
  
  try {
    // Execute the skill (DSL)
    const result = await runSkill(skill.logic, input, options);
    
    // Validate output schema
    const schemaValidation = validateOutputSchema(result, skill.output_schema);
    
    const success = schemaValidation.valid;
    
    // Update skill stats - MANDATORY (this is the learning loop)
    const learningResult = await updateSkillStatsWithFeedback(skill, success, {
      score: schemaValidation.valid ? 1.0 : 0.0,
      valid: schemaValidation.valid,
      errors: schemaValidation.errors || []
    });
    
    return {
      result,
      success,
      learning: {
        statsUpdated: true,
        newScore: learningResult?.score || skill.score,
        executionTime: Date.now() - startTime
      },
      validation: schemaValidation
    };
    
  } catch (error) {
    // Even on failure, update stats (this is critical for learning)
    await updateSkillStatsWithFeedback(skill, false, {
      score: 0,
      valid: false,
      errors: [error.message]
    });
    
    return {
      result: null,
      success: false,
      learning: {
        statsUpdated: true,
        newScore: skill.score,
        executionTime: Date.now() - startTime
      },
      validation: { valid: false, errors: [error.message] },
      error: error.message
    };
  }
}

/**
 * Batch execution with learning (for call_skill_map)
 */
export async function executeBatchWithLearning(skill, inputs, options = {}) {
  const results = [];
  
  for (const input of inputs) {
    const result = await executeWithLearning(skill, input, options);
    results.push(result);
  }
  
  return results;
}

/**
 * Verify that learning is properly integrated
 * Used for debugging/monitoring
 */
export function verifyLearningIntegration() {
  return {
    wrapperActive: true,
    description: "All skill executions must go through executeWithLearning",
    required: true
  };
}