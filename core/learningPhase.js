/**
 * Learning Phase - Closed-Loop Learning Mechanism
 * 
 * Ini adalah titik di mana sistem benar-benar "belajar":
 * - Update skill stats
 * - Versioning (improvement tracking)
 * - Mutation (exploration)
 * - Decay
 * - Pruning
 * 
 * Semua mekanisme learning kamu terintegrasi di sini.
 */

import { shouldMutate, mutateWithControl, acceptMutation, mutateSkill } from "./mutation.js";
import { applyDecay } from "./decay.js";
import { shouldPrune } from "./experienceWeight.js";
import { createVersion } from "./versioning.js";
import { SkillRegistry } from "./skillRegistry.js";

/**
 * Konfigurasi learning phase
 */
export const LEARNING_CONFIG = {
  // Mutation settings
  enableMutation: true,
  minUsageForMutation: 3,
  improvementThreshold: 0.1,
  maxMutationsPerSkill: 3,
  mutationCooldown: 60000,  // 1 minute cooldown

  // Decay settings
  enableDecay: true,
  decayRate: 0.03,
  decayInterval: 60000,  // 1 minute

  // Pruning settings
  enablePruning: true,
  pruneThreshold: {
    minScore: 0.3,
    minUsage: 2,
    minConfidence: 0.2
  },

  // Versioning settings
  enableVersioning: true,
  minImprovementForVersion: 0.05,

  // Selection pressure
  enableSelectionPressure: true,
  minScoreThreshold: 0.4
};

/**
 * Learning Phase - Main entry point
 * 
 * @param {Object} params - { plan, result, evaluation, skillRegistry }
 * @returns {Object} - Learning results
 */
export async function learningPhase(params) {
  const { plan, result, evaluation, skillRegistry } = params;
  const config = { ...LEARNING_CONFIG, ...params.config };

  console.log("[LEARNING PHASE] Starting...");

  const results = {
    skillUpdated: false,
    versionCreated: false,
    mutationAttempted: false,
    mutationAccepted: false,
    decayed: false,
    pruned: false,
    errors: []
  };

  try {
    const success = evaluation.score >= config.successThreshold;
    const skill = plan.skill || skillRegistry.get(plan.capability);

    if (!skill) {
      console.log("[LEARNING PHASE] No skill found for plan");
      return results;
    }

    // PHASE 1: Update Skill Stats
    results.skillUpdated = await updateSkillStatsWithFeedback(skill, success, evaluation);
    console.log(`[LEARNING PHASE] Skill stats updated: ${skill.score?.toFixed(3)}`);

    // PHASE 2: Versioning (if improvement detected)
    if (config.enableVersioning && evaluation.score > skill.score + config.minImprovementForVersion) {
      const versionResult = await createSkillVersion(skill, plan, evaluation);
      if (versionResult.success) {
        results.versionCreated = true;
        console.log(`[LEARNING PHASE] New version created: ${versionResult.version.id}`);
      }
    }

    // PHASE 3: Mutation (Exploration)
    if (config.enableMutation && shouldExplore(config)) {
      const mutationResult = await attemptSkillMutation(skill, skillRegistry, evaluation);
      results.mutationAttempted = mutationResult.attempted;
      results.mutationAccepted = mutationResult.accepted;

      if (mutationResult.accepted) {
        console.log(`[LEARNING PHASE] Mutation accepted: ${mutationResult.mutatedSkill.id}`);
      }
    }

    // PHASE 4: Decay (periodic)
    if (config.enableDecay) {
      await applySkillDecay(skillRegistry);
      results.decayed = true;
    }

    // PHASE 5: Pruning (remove low-performing skills)
    if (config.enablePruning) {
      const pruned = await pruneLowQualitySkills(skillRegistry, config);
      results.pruned = pruned.length > 0;
      if (results.pruned) {
        console.log(`[LEARNING PHASE] Pruned ${pruned.length} skills`);
      }
    }

  } catch (error) {
    console.error("[LEARNING PHASE] Error:", error.message);
    results.errors.push(error.message);
  }

  console.log("[LEARNING PHASE] Complete:", results);
  return results;
}

/**
 * Update skill stats based on execution feedback
 */
export async function updateSkillStatsWithFeedback(skill, success, evaluation) {
  if (!skill) return false;

  // Initialize stats if not exist
  if (!skill.usage_count) skill.usage_count = 0;
  if (!skill.success_count) skill.success_count = 0;
  if (!skill.total_score) skill.total_score = 0;
  if (!skill.score) skill.score = 0.5;

  // Update usage
  skill.usage_count++;

  // Update success count
  if (success) {
    skill.success_count++;
  }

  // Update total score (exponential moving average)
  const alpha = 0.2;  // Learning rate
  skill.total_score = skill.total_score * (1 - alpha) + evaluation.score * alpha;

  // Recalculate score
  skill.score = skill.usage_count > 0 
    ? (skill.success_count / skill.usage_count) * 0.7 + (skill.total_score / skill.usage_count) * 0.3
    : skill.score;

  // Update confidence
  if (!skill.confidence) skill.confidence = 0.5;
  const confidenceDelta = success ? 0.1 : -0.1;
  skill.confidence = Math.max(0.1, Math.min(1.0, skill.confidence + confidenceDelta));

  // Update last used
  skill.last_used_at = Date.now();

  console.log(`[SKILL STATS] ${skill.name || skill.capability}: score=${skill.score.toFixed(3)}, confidence=${skill.confidence.toFixed(3)}`);

  return true;
}

/**
 * Create new version of skill if improvement detected
 */
export async function createSkillVersion(skill, plan, evaluation) {
  try {
    const newVersion = createVersion(skill, {
      parent_id: skill.id,
      mutation_number: (skill.mutation_count || 0) + 1,
      score: evaluation.score,
      source: 'improvement'
    });

    // Override with new score
    newVersion.score = evaluation.score;
    newVersion.created_at = Date.now();

    console.log(`[VERSION] Created version ${newVersion.id} from ${skill.id}`);

    return {
      success: true,
      version: newVersion
    };
  } catch (error) {
    console.error("[VERSION] Error creating version:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Attempt to mutate a skill for exploration
 */
export async function attemptSkillMutation(skill, skillRegistry, evaluation) {
  // Check if mutation should happen
  const mutationCheck = shouldMutate(skill, Array.from(skillRegistry.skills?.values() || []));

  if (!mutationCheck.shouldMutate) {
    console.log(`[MUTATION] Skipped: ${mutationCheck.reason}`);
    return { attempted: false, accepted: false, reason: mutationCheck.reason };
  }

  console.log(`[MUTATION] Attempting mutation for ${skill.name || skill.capability}`);

  // Apply mutation
  const mutatedSkill = mutateSkill(skill);

  // Validate mutated skill
  if (!validateMutatedSkill(mutatedSkill)) {
    return { attempted: true, accepted: false, reason: "invalid_mutated_skill" };
  }

  // Test mutated skill
  const testScore = await testMutatedSkill(mutatedSkill);

  // Check if improvement meets threshold
  const acceptCheck = acceptMutation(skill.score || 0.5, testScore);

  if (acceptCheck.accept) {
    // Register mutated skill
    const mutatedWithVersion = createVersion(skill, {
      parent_id: skill.id,
      mutation_number: (skill.mutation_count || 0) + 1,
      score: testScore,
      source: 'mutation'
    });

    skillRegistry.register(mutatedWithVersion);

    console.log(`[MUTATION] Accepted: ${testScore.toFixed(3)} vs original ${skill.score?.toFixed(3)}`);

    return {
      attempted: true,
      accepted: true,
      mutatedSkill: mutatedWithVersion,
      testScore,
      originalScore: skill.score
    };
  }

  return {
    attempted: true,
    accepted: false,
    reason: acceptCheck.reason,
    testScore,
    originalScore: skill.score
  };
}

/**
 * Validate mutated skill structure
 */
function validateMutatedSkill(skill) {
  if (!skill) return false;

  // Check has required fields
  if (!skill.capability) return false;

  // Validate logic if exists
  if (skill.logic && Array.isArray(skill.logic)) {
    for (const step of skill.logic) {
      if (!step.op || !step.params) return false;
    }
  }

  return true;
}

/**
 * Test mutated skill (simple validation)
 */
async function testMutatedSkill(skill) {
  // Simple test - just return a random score for now
  // In production, this would run actual test cases
  return Math.random() * 0.3 + 0.5;  // 0.5-0.8 range
}

/**
 * Decide whether to explore (vs exploit)
 */
function shouldExplore(config) {
  const explorationRate = config.explorationRate || 0.2;
  return Math.random() < explorationRate;
}

/**
 * Apply decay to all skills
 */
export async function applySkillDecay(skillRegistry) {
  const skills = skillRegistry.list ? skillRegistry.list() : [];
  
  for (const skill of skills) {
    if (skill.last_used_at) {
      const timeSinceLastUse = Date.now() - skill.last_used_at;
      const decayAmount = (timeSinceLastUse / 86400000) * 0.01;  // 1% per day
      skill.score = Math.max(0, (skill.score || 0.5) - decayAmount);
    }
  }

  console.log("[DECAY] Applied decay to skills");
}

/**
 * Prune low-quality skills
 */
export async function pruneLowQualitySkills(skillRegistry, config) {
  const pruned = [];
  const skills = skillRegistry.list ? skillRegistry.list() : [];

  for (const skill of skills) {
    if (shouldPruneSkill(skill, config.pruneThreshold)) {
      skillRegistry.unregister(skill.id);
      pruned.push(skill.id);
    }
  }

  return pruned;
}

/**
 * Check if skill should be pruned
 */
function shouldPruneSkill(skill, threshold) {
  if (!skill) return false;

  // Must have minimum usage
  if ((skill.usage_count || 0) < threshold.minUsage) return false;

  // Check score threshold
  if ((skill.score || 0) > threshold.minScore) return false;

  // Check confidence threshold
  if ((skill.confidence || 0) > threshold.minConfidence) return false;

  return true;
}

/**
 * Export LearningPhase class for more complex scenarios
 */
export class LearningPhase {
  constructor(options = {}) {
    this.config = { ...LEARNING_CONFIG, ...options };
    this.memory = options.memory;
    this.lastDecay = Date.now();
  }

  async execute(params) {
    return learningPhase(params);
  }

  async periodicMaintenance() {
    // Apply decay periodically
    if (Date.now() - this.lastDecay > this.config.decayInterval) {
      // Would apply to skill registry here
      this.lastDecay = Date.now();
    }
  }
}

export default learningPhase;