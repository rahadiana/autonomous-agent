import { Skill } from "../models/skill.js";
import { Op } from "sequelize";

/**
 * Pruning configuration
 */
const PRUNING_CONFIG = {
  minUsageForPrune: 5,          // Protect new skills with < 5 uses
  scoreThreshold: 0.3,         // Hard prune below this
  capabilityMustHaveAtLeast: 1 // Keep at least 1 skill per capability
};

/**
 * Pruning results summary
 */
export class PruningResult {
  constructor() {
    this.pruned = 0;
    this.protected = 0;
    this.revived = 0;
    this.errors = [];
  }

  get summary() {
    return {
      pruned: this.pruned,
      protected: this.protected,
      revived: this.revived,
      errors: this.errors.length,
      success: this.errors.length === 0
    };
  }
}

/**
 * Prune low-quality skills with safety guards
 * 
 * Rules:
 * 1. Skip skills with usage_count < minUsageForPrune (protect new skills)
 * 2. Prune skills with score < scoreThreshold AND usage >= minUsageForPrune
 * 3. Ensure at least 1 skill per capability remains active
 * 4. Use soft delete (status = "inactive") instead of hard delete
 * 
 * @returns {PruningResult} Summary of pruning operation
 */
export async function pruneSkills() {
  const result = new PruningResult();

  try {
    // Get all active skills
    const allSkills = await Skill.findAll({
      where: { status: "active" }
    });

    // Group by capability
    const byCapability = new Map();
    for (const skill of allSkills) {
      if (!byCapability.has(skill.capability)) {
        byCapability.set(skill.capability, []);
      }
      byCapability.get(skill.capability).push(skill);
    }

    // Check each capability
    for (const [capability, skills] of byCapability) {
      // Sort by score (lowest first)
      skills.sort((a, b) => a.score - b.score);

      // Check if we need to prune
      const lowScoreSkills = skills.filter(s => s.score < PRUNING_CONFIG.scoreThreshold);

      for (const skill of lowScoreSkills) {
        // Rule 1: Protect new skills
        if (skill.usage_count < PRUNING_CONFIG.minUsageForPrune) {
          result.protected++;
          console.log(`[PRUNE] Protected new skill: ${skill.name} (uses: ${skill.usage_count})`);
          continue;
        }

        // Rule 4: Soft delete (not hard delete)
        try {
          await skill.update({ status: "inactive" });
          result.pruned++;
          console.log(`[PRUNE] Soft-deleted: ${skill.name} (score: ${skill.score.toFixed(2)}, uses: ${skill.usage_count})`);
        } catch (e) {
          result.errors.push(`Failed to prune ${skill.name}: ${e.message}`);
        }
      }
    }

    // Rule 3: Ensure capability safety - revive best skill if capability would be empty
    await ensureCapabilitySafety(result);

    console.log("[PRUNE] Summary:", result.summary);

  } catch (e) {
    result.errors.push(`Pruning failed: ${e.message}`);
    console.error("[PRUNE] Error:", e);
  }

  return result;
}

/**
 * Ensure at least 1 skill per capability remains active
 * If a capability would be empty, revive the best inactive skill
 * 
 * @param {PruningResult} result - Result object to track revivals
 */
async function ensureCapabilitySafety(result) {
  // Get all capabilities
  const capabilities = await Skill.findAll({
    attributes: ["capability"],
    group: ["capability"],
    where: { status: "active" }
  });

  const activeCapabilities = capabilities.map(c => c.capability);

  // Find all capabilities that exist in DB
  const allCapabilities = await Skill.findAll({
    attributes: ["capability"],
    group: ["capability"]
  });

  const allCapabilityNames = allCapabilities.map(c => c.capability);

  // Check each capability
  for (const cap of allCapabilityNames) {
    const activeCount = await Skill.count({
      where: { capability: cap, status: "active" }
    });

    if (activeCount === 0) {
      // Capability would be empty - revive best inactive skill
      const bestInactive = await Skill.findOne({
        where: { capability: cap, status: "inactive" },
        order: [["score", "DESC"]]
      });

      if (bestInactive) {
        await bestInactive.update({ status: "active" });
        result.revived++;
        console.log(`[PRUNE] Revived capability: ${cap} - ${bestInactive.name} (score: ${bestInactive.score.toFixed(2)})`);
      } else {
        // No inactive skill to revive - check if there's any skill at all
        const anySkill = await Skill.findOne({
          where: { capability: cap }
        });
        
        if (!anySkill) {
          console.warn(`[PRUNE] WARNING: No skill exists for capability: ${cap}`);
        }
      }
    }
  }
}

/**
 * Get pruning statistics
 * 
 * @returns {Object} Statistics about skill distribution
 */
export async function getPruningStats() {
  const activeSkills = await Skill.findAll({ where: { status: "active" } });
  const inactiveSkills = await Skill.findAll({ where: { status: "inactive" } });

  // Score distribution for active skills
  const scoreRanges = {
    "0.0-0.3": 0,
    "0.3-0.5": 0,
    "0.5-0.7": 0,
    "0.7-0.85": 0,
    "0.85-1.0": 0
  };

  for (const skill of activeSkills) {
    if (skill.score < 0.3) scoreRanges["0.0-0.3"]++;
    else if (skill.score < 0.5) scoreRanges["0.3-0.5"]++;
    else if (skill.score < 0.7) scoreRanges["0.5-0.7"]++;
    else if (skill.score < 0.85) scoreRanges["0.7-0.85"]++;
    else scoreRanges["0.85-1.0"]++;
  }

  // Capability coverage
  const activeCapabilities = new Set(activeSkills.map(s => s.capability));
  const allCapabilities = new Set([...activeSkills, ...inactiveSkills].map(s => s.capability));

  // Usage distribution
  const usageRanges = {
    "0-4": 0,
    "5-19": 0,
    "20-99": 0,
    "100+": 0
  };

  for (const skill of activeSkills) {
    if (skill.usage_count < 5) usageRanges["0-4"]++;
    else if (skill.usage_count < 20) usageRanges["5-19"]++;
    else if (skill.usage_count < 100) usageRanges["20-99"]++;
    else usageRanges["100+"]++;
  }

  return {
    total: {
      active: activeSkills.length,
      inactive: inactiveSkills.length,
      all: activeSkills.length + inactiveSkills.length
    },
    scoreDistribution: scoreRanges,
    capabilityCoverage: {
      active: activeCapabilities.size,
      total: allCapabilities.size,
      coverage: allCapabilities.size > 0 
        ? (activeCapabilities.size / allCapabilities.size * 100).toFixed(1) + "%"
        : "0%"
    },
    usageDistribution: usageRanges,
    survivalRate: activeSkills.length + inactiveSkills.length > 0
      ? (activeSkills.length / (activeSkills.length + inactiveSkills.length) * 100).toFixed(1) + "%"
      : "0%"
  };
}

/**
 * Run evaluation on all skills and update scores
 * This should be called periodically to refresh skill scores
 * 
 * @param {Function} evaluateFn - Function to evaluate a skill (skill, capability) => Promise<{score, accuracy}>
 * @returns {Object} Summary of evaluation
 */
export async function refreshSkillScores(evaluateFn) {
  const skills = await Skill.findAll();
  let updated = 0;
  let errors = 0;

  for (const skill of skills) {
    try {
      const evalResult = await evaluateFn(skill.json, skill.capability);
      
      if (evalResult && typeof evalResult.score === "number") {
        await skill.update({ 
          score: evalResult.score,
          last_used_at: new Date()
        });
        updated++;
      }
    } catch (e) {
      console.error(`[SCORE] Failed to evaluate ${skill.name}: ${e.message}`);
      errors++;
    }
  }

  console.log(`[SCORE] Refreshed ${updated} skills, ${errors} errors`);

  return { updated, errors };
}

/**
 * Manual prune a specific skill (for testing/admin)
 * 
 * @param {string} skillId - Skill ID to prune
 * @returns {boolean} Success status
 */
export async function manualPrune(skillId) {
  const skill = await Skill.findByPk(skillId);
  
  if (!skill) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  // Check if this would leave capability empty
  const activeInCap = await Skill.count({
    where: { 
      capability: skill.capability, 
      status: "active",
      id: { [Op.ne]: skillId }
    }
  });

  if (activeInCap === 0) {
    throw new Error(`Cannot prune: ${skill.capability} would have no active skills`);
  }

  await skill.update({ status: "inactive" });
  console.log(`[PRUNE] Manual prune: ${skill.name}`);
  
  return true;
}