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
 * Based on usage, history, and performance
 * 
 * @param {Object} skill - Skill to check
 * @param {Array} allSkills - All skills for percentile calculation
 * @returns {Object} { shouldMutate: boolean, reason: string }
 */
export function shouldMutate(skill, allSkills = []) {
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
