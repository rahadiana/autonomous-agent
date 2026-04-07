import { Skill } from "../models/skill.js";
import { runSkill } from "../core/executor.js";
import { validate } from "../core/validator.js";
import { evaluate } from "../core/scoring.js";
import { mutateSkill } from "../core/mutation.js";
import { createVersion } from "../core/versioning.js";
import { evaluateSkill } from "../core/testRunner.js";

/**
 * Configuration for skill selection and evolution
 */
const CONFIG = {
  reEvalInterval: 5,        // Re-evaluate every 5 uses
  decayRate: 0.02,         // 2% score decay per day idle
  mutationRate: 0.0,       // DISABLED - not ready yet
  
  // Selection strategy: 'greedy' | 'ucb' | 'thompson'
  // UCB is recommended - handles exploration mathematically
  selectionStrategy: 'ucb',
  
  // UCB parameters
  ucbConstant: 1.414,      // sqrt(2) - standard exploration constant
  
  // Smoothing parameters (anti-oscillation)
  scoreInertia: 0.7,       // 70% old score, 30% new evaluation
  reEvalCooldown: 3600000, // 1 hour cooldown between re-evaluations
  
  // Confidence parameters
  confidenceCap: 20,       // Full confidence at 20 uses
  confidenceWeight: 0.2,    // 20% confidence in final score
  
  // NEW: Skill cooldown (newly created skills need time before being used)
  skillCooldown: 300000,    // 5 minutes cooldown for new skills
  
  // NEW: Lineage tracking (don't mutate low-usage or bad lineage)
  mutationMinUsage: 5,      // Minimum 5 uses before mutation allowed
  mutationTopPercent: 30,  // Only mutate top 30% skills
  
  // NEW: Normalization for bandit-style scoring
  scoreNormalization: true,

  // NEW: Context-aware selection parameters
  contextMatchWeight: 0.3,    // Weight for context matching in selection
  similarityWeight: 0.4,       // Weight for retrieval similarity
  scoreWeight: 0.3,           // Weight for skill quality score
  
  // NEW: Hard filter threshold
  minContextMatch: 0.5         // Minimum context match to be considered
};

/**
 * Context matching weight distribution
 */
const CONTEXT_WEIGHTS = {
  capability: 0.4,    // Must match capability
  operation: 0.3,    // Must match operation type
  inputType: 0.2,    // Input type should match
  constraints: 0.1    // Constraint overlap bonus
};

/**
 * Calculate context match score between target context and skill
 * 
 * @param {Object} targetContext - The context we want to match
 * @param {Object} skill - The skill to match against
 * @returns {number} Context match score 0-1
 */
function calculateContextMatch(targetContext, skill) {
  if (!skill) return 0;
  
  let score = 0;
  
  // Capability match (40%)
  if (targetContext.capability && skill.context_capability) {
    if (targetContext.capability === skill.context_capability) {
      score += CONTEXT_WEIGHTS.capability;
    }
  } else if (targetContext.capability && skill.capability) {
    // Fallback to capability field
    if (targetContext.capability === skill.capability) {
      score += CONTEXT_WEIGHTS.capability;
    }
  }
  
  // Operation match (30%)
  if (targetContext.operation && skill.context_operation) {
    if (targetContext.operation === skill.context_operation) {
      score += CONTEXT_WEIGHTS.operation;
    }
  }
  
  // Input type match (20%)
  if (targetContext.inputType && skill.context_input_type) {
    if (targetContext.inputType === skill.context_input_type) {
      score += CONTEXT_WEIGHTS.inputType;
    }
  }
  
  // Constraints overlap bonus (10%)
  if (targetContext.constraints && skill.context_constraints && Array.isArray(skill.context_constraints)) {
    const overlap = targetContext.constraints.filter(
      c => skill.context_constraints.includes(c)
    ).length;
    const maxLen = Math.max(targetContext.constraints.length, skill.context_constraints.length);
    if (maxLen > 0) {
      score += (overlap / maxLen) * CONTEXT_WEIGHTS.constraints;
    }
  }
  
  return Math.min(1, score);
}

/**
 * Extract context signature from input/target
 * 
 * @param {string} capability - The capability type
 * @param {Object} input - Input parameters
 * @returns {Object} Extracted context
 */
function extractContext(capability, input = {}) {
  const context = {
    capability: capability,
    operation: inferOperation(capability),
    inputType: inferInputType(input),
    constraints: extractConstraints(capability, input)
  };
  
  return context;
}

/**
 * Infer operation type from capability
 */
function inferOperation(capability) {
  if (!capability) return "unknown";
  
  const ops = ["filter", "map", "reduce", "add", "subtract", "multiply", "divide", "concat", "sort"];
  for (const op of ops) {
    if (capability.includes(op)) return op;
  }
  
  return "unknown";
}

/**
 * Infer input type from input object
 */
function inferInputType(input) {
  if (!input || typeof input !== "object") return "unknown";
  
  const keys = Object.keys(input);
  
  if (keys.some(k => Array.isArray(input[k]))) return "array";
  if (keys.some(k => typeof input[k] === "number")) return "numeric";
  if (keys.some(k => typeof input[k] === "string")) return "string";
  if (keys.some(k => typeof input[k] === "object")) return "object";
  
  return "mixed";
}

/**
 * Extract constraints from capability and input
 */
function extractConstraints(capability, input) {
  const constraints = [];
  
  // Infer from input values
  for (const [key, val] of Object.entries(input || {})) {
    if (val === null) constraints.push("null_check");
    if (typeof val === "number") {
      if (val > 0) constraints.push("positive_check");
      if (val < 0) constraints.push("negative_check");
    }
  }
  
  // Infer from capability
  if (capability?.includes("divide") && (input?.b === 0 || input?.divisor === 0)) {
    constraints.push("division_by_zero_check");
  }
  
  return constraints;
}

/**
 * Context-aware skill selection
 * Combines similarity + score + context match
 * 
 * @param {Array} skills - Available skills
 * @param {Object} targetContext - Context we want to match
 * @param {number} retrievalScore - Similarity score from retrieval (0-1)
 * @returns {Object} Selected skill with breakdown
 */
function selectWithContext(skills, targetContext, retrievalScore = 0) {
  // Filter by hard threshold first
  const eligibleSkills = skills.filter(skill => {
    const contextMatch = calculateContextMatch(targetContext, skill);
    return contextMatch >= CONFIG.minContextMatch;
  });
  
  if (eligibleSkills.length === 0) {
    console.log(`[SELECT] No skills met context threshold ${CONFIG.minContextMatch}`);
    return { skill: null, reason: "no_context_match" };
  }
  
  // Calculate final scores
  const scored = eligibleSkills.map(skill => {
    const contextMatch = calculateContextMatch(targetContext, skill);
    const skillScore = skill.normalizedScore ?? skill.score ?? 0.5;
    
    // Weighted combination
    const finalScore = (
      retrievalScore * CONFIG.similarityWeight +
      skillScore * CONFIG.scoreWeight +
      contextMatch * CONFIG.contextMatchWeight
    );
    
    return {
      skill,
      finalScore,
      breakdown: {
        similarity: retrievalScore * CONFIG.similarityWeight,
        skillScore: skillScore * CONFIG.scoreWeight,
        contextMatch: contextMatch * CONFIG.contextMatchWeight,
        total: finalScore
      },
      contextMatch
    };
  });
  
  // Sort by final score
  scored.sort((a, b) => b.finalScore - a.finalScore);
  
  const selected = scored[0];
  
  console.log(`[SELECT] Context-aware selection:`);
  console.log(`  - Selected: ${selected.skill.name}`);
  console.log(`  - Context match: ${selected.contextMatch.toFixed(2)}`);
  console.log(`  - Breakdown:`, selected.breakdown);
  
  return {
    skill: selected.skill,
    score: selected.finalScore,
    contextMatch: selected.contextMatch,
    breakdown: selected.breakdown
  };
}

/**
 * Calculate confidence based on usage count
 * Higher usage = higher confidence in the score
 */
function getConfidence(usageCount) {
  return Math.min(usageCount / CONFIG.confidenceCap, 1.0);
}

/**
 * Check if skill is in cooldown period (newly created)
 * NEW: Prevents newly created skills from being overused immediately
 */
function isInCooldown(skill) {
  if (!skill.created_at) return false;
  
  const now = Date.now();
  const created = new Date(skill.created_at).getTime();
  const cooldownMs = CONFIG.skillCooldown;
  
  return (now - created) < cooldownMs;
}

/**
 * Normalize score for bandit-style selection
 * NEW: Maps scores to [0, 1] range for fair comparison
 */
function normalizeScore(skills) {
  if (skills.length === 0) return skills;
  
  const scores = skills.map(s => s.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  
  if (max === min) {
    return skills.map(s => ({ ...s, normalizedScore: 0.5 }));
  }
  
  return skills.map(s => ({
    ...s,
    normalizedScore: (s.score - min) / (max - min)
  }));
}

/**
 * Check if skill is eligible for mutation
 * NEW: Constrains mutation to mature, high-quality skills
 */
function canMutate(skill) {
  // Must have minimum usage
  if (skill.usage_count < CONFIG.mutationMinUsage) {
    return { eligible: false, reason: "usage_too_low" };
  }
  
  // Must be in top percentile
  // This will be checked by the caller with full context
  return { eligible: true, reason: "ok" };
}

/**
 * Calculate exploration score with uncertainty bias
 * Skills with lower usage get a bonus to encourage exploration
 */
function getExplorationScore(skill) {
  const confidence = getConfidence(skill.usage_count);
  const uncertaintyBonus = 0.2 * (1 - confidence); // More bonus for low confidence
  return skill.score + uncertaintyBonus;
}

/**
 * UCB1 (Upper Confidence Bound) implementation
 * Balances exploration vs exploitation properly
 * Formula: score + c * sqrt(ln(total_time) / n_i)
 * 
 * @param {number} score - Skill's average score (exploitation)
 * @param {number} usageCount - Number of times skill was selected
 * @param {number} totalUsage - Total selections across all skills
 * @param {number} c - Exploration constant (typically sqrt(2) ≈ 1.41)
 * @returns {number} UCB score
 */
function calculateUCB(score, usageCount, totalUsage, c = 1.414) {
  if (usageCount === 0) {
    // Unvisited skills get infinite exploration bonus
    return Infinity;
  }
  
  const exploitation = score;
  const exploration = c * Math.sqrt(Math.log(totalUsage + 1) / (usageCount + 1));
  
  return exploitation + exploration;
}

/**
 * Select a skill using PROPER UCB BANDIT algorithm
 * 
 * This replaces simple greedy selection with true multi-armed bandit:
 * - Uses UCB1 formula for exploration/exploitation balance
 * - Automatically balances between trying new skills vs using known good ones
 * - No manual explorationRate needed - UCB handles it mathematically
 * 
 * @param {Array} skills - Array of skill objects
 * @returns {Object} Selected skill with UCB breakdown
 */
function selectWithUCB(skills) {
  // Filter out skills in cooldown
  const availableSkills = skills.filter(s => !isInCooldown(s));
  
  if (availableSkills.length === 0) {
    console.log("[SELECT] All skills in cooldown, allowing cooldown skills");
    return skills[0];
  }
  
  // Calculate total usage across all skills
  const totalUsage = availableSkills.reduce((sum, s) => sum + (s.usage_count || 0), 0);
  
  // Calculate UCB for each skill
  const ucbResults = availableSkills.map(skill => {
    const score = skill.normalizedScore ?? skill.score;
    const usageCount = skill.usage_count || 0;
    
    const ucb = calculateUCB(score, usageCount, totalUsage);
    
    return {
      skill,
      ucb,
      exploitation: score,
      exploration: usageCount === 0 ? Infinity : 1.414 * Math.sqrt(Math.log(totalUsage + 1) / (usageCount + 1)),
      usageCount
    };
  });
  
  // Sort by UCB score (highest first)
  ucbResults.sort((a, b) => b.ucb - a.ucb);
  
  const selected = ucbResults[0];
  
  console.log(`[UCB] Selected: ${selected.skill.name}`);
  console.log(`  - UCB: ${selected.ucb.toFixed(3)}`);
  console.log(`  - Exploitation: ${selected.exploitation.toFixed(3)}`);
  console.log(`  - Exploration: ${selected.exploitation === selected.ucb ? '∞' : selected.exploration.toFixed(3)}`);
  console.log(`  - Usage: ${selected.usageCount} / ${totalUsage}`);
  
  return selected.skill;
}

/**
 * Alternative: Thompson Sampling (Bayesian approach)
 * Useful if you want probabilistic exploration
 * 
 * @param {Array} skills - Array of skill objects
 * @returns {Object} Selected skill
 */
function selectWithThompsonSampling(skills) {
  // Filter out skills in cooldown
  const availableSkills = skills.filter(s => !isInCooldown(s));
  
  if (availableSkills.length === 0) {
    return skills[0];
  }
  
  // Sample from Beta distribution for each skill
  // Beta(alpha, beta) where alpha = successes + 1, beta = failures + 1
  const samples = availableSkills.map(skill => {
    const alpha = (skill.success_count || 0) + 1;
    const beta = (skill.failure_count || 0) + 1;
    
    // Simple Beta sampling using gamma distribution
    const sample = betaSample(alpha, beta);
    
    return { skill, sample };
  });
  
  // Select highest sample
  samples.sort((a, b) => b.sample - a.sample);
  
  console.log(`[Thompson] Selected: ${samples[0].skill.name} (sample: ${samples[0].sample.toFixed(3)})`);
  
  return samples[0].skill;
}

// Helper for Thompson Sampling (simplified Beta sampling)
function betaSample(alpha, beta) {
  // Using Marsaglia's method for Gamma distribution
  const gammaA = gammaSample(alpha);
  const gammaB = gammaSample(beta);
  return gammaA / (gammaA + gammaB);
}

function gammaSample(shape) {
  // Simplified gamma sampling (Knuth algorithm)
  if (shape < 1) {
    return gammaSample(1 + shape) * Math.random();
  }
  
  const d = shape - 1/3;
  const c = 1 / Math.sqrt(9 * d);
  
  while (true) {
    let x, v;
    do {
      x = gaussianSample();
      v = 1 + c * x;
    } while (v <= 0);
    
    v = v * v * v;
    const u = Math.random();
    
    if (u < 1 - 0.0331 * (x * x) * (x * x)) {
      return d * v;
    }
    
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

function gaussianSample() {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Version locking for race condition prevention
 * Uses optimistic locking pattern
 */

/**
 * Acquire lock for skill update
 * Returns current version if lock acquired, null if failed
 */
async function acquireVersionLock(skillId, currentVersion) {
  // This would be implemented with actual DB in production
  // For now, return the version for validation
  return currentVersion;
}

/**
 * Update skill with version check (anti-race condition)
 * Only updates if version matches, rejects if stale
 */
async function updateWithVersionCheck(skillId, updates, expectedVersion) {
  // Validate version before update
  // In production, this would be:
  // UPDATE Skills SET ... WHERE id = ? AND version_lock = ?
  
  console.log(`[VERSION] Attempting update for ${skillId}`);
  console.log(`[VERSION] Expected version: ${expectedVersion}`);
  
  // For in-memory implementation, just log
  return {
    success: true,
    newVersion: expectedVersion + 1,
    applied: updates
  };
}

/**
 * Promote new version, deactivate old
 * Ensures only one active version per capability
 */
async function promoteVersion(newSkill, oldSkill) {
  console.log(`[VERSION] Promoting ${newSkill.id} (v${newSkill.version})`);
  console.log(`[VERSION] Deactivating ${oldSkill.id} (v${oldSkill.version})`);
  
  // Deactivate old
  if (oldSkill) {
    oldSkill.status = "inactive";
  }
  
  // Activate new
  newSkill.status = "active";
  newSkill.version = (oldSkill?.version || 0) + 1;
  
  return { newSkill, oldSkill };
}

/**
 * Select a skill with EXPLORATION (uncertainty-aware + cooldown + normalized)
 * - Uses PROPER UCB BANDIT algorithm
 * - Falls back to Thompson Sampling if UCB fails
 * - SKIPS skills in cooldown period
 * - Uses normalized scores for fair comparison
 */
function selectWithExploration(skills) {
  // Filter out skills in cooldown
  const availableSkills = skills.filter(s => !isInCooldown(s));
  
  if (availableSkills.length === 0) {
    // If all skills in cooldown, fall back to original list
    console.log("[SELECT] All skills in cooldown, allowing cooldown skills");
    return skills[0];
  }
  
  // Normalize scores if enabled (for UCB calculation)
  let processedSkills = CONFIG.scoreNormalization 
    ? normalizeScore(availableSkills) 
    : availableSkills.map(s => ({ ...s, normalizedScore: s.score }));
  
  // Use UCB bandit selection (replaces manual exploration/exploitation)
  return selectWithUCB(processedSkills);
}

/**
 * Apply time-based freshness decay to skill score
 * With SOFT FLOOR - push lower but don't clamp up
 */
function applyFreshnessDecay(score, lastUsedAt) {
  if (!lastUsedAt) return score;
  
  const now = new Date();
  const daysIdle = (now - new Date(lastUsedAt)) / (1000 * 60 * 60 * 24);
  
  if (daysIdle < 1) return score;
  
  // Light exponential decay: score *= exp(-0.02 * daysIdle)
  const decayMultiplier = Math.exp(-CONFIG.decayRate * daysIdle);
  const decayed = score * decayMultiplier;
  
  // SOFT FLOOR: push lower but don't clamp up
  // If score < 0.2, push it even lower (0.5x), don't boost it up
  if (decayed < 0.2) {
    return decayed * 0.5; // Push to 0.1 instead of clamping to 0.2
  }
  
  return decayed;
}

/**
 * Apply score smoothing (inertia) to prevent oscillation
 * newScore = oldScore * 0.7 + newEvaluation * 0.3
 */
function applyScoreSmoothing(oldScore, newEvaluation) {
  return (oldScore * CONFIG.scoreInertia) + (newEvaluation * (1 - CONFIG.scoreInertia));
}

/**
 * Check if enough time has passed since last re-evaluation
 * Prevents re-eval spam
 */
function shouldReevaluate(lastEvalTime) {
  if (!lastEvalTime) return true;
  
  const now = new Date();
  const hoursSinceEval = (now - new Date(lastEvalTime)) / (1000 * 60 * 60);
  
  return hoursSinceEval >= 1; // At least 1 hour since last re-eval
}

export async function handleRequest(input, capability) {
  const skills = await Skill.findAll({
    where: { capability, status: "active" }
  });

  if (skills.length === 0) {
    // Try to find inactive skills and revive if possible
    const anySkill = await Skill.findOne({
      where: { capability }
    });
    
    if (anySkill) {
      // Revive the best inactive skill for this capability
      const bestInactive = await Skill.findOne({
        where: { capability, status: "inactive" },
        order: [["score", "DESC"]]
      });
      
      if (bestInactive) {
        await bestInactive.update({ status: "active" });
        console.log(`[SKILL] Revived inactive skill for ${capability}: ${bestInactive.name}`);
        
        const result = await runSkill(bestInactive.json, input);
        await updateScoreWithEvaluator(bestInactive, capability);
        return result;
      }
    }
    
    throw new Error("No active skill found for capability: " + capability);
  }

  // Apply freshness decay to scores before selection
  const now = new Date();
  for (const skill of skills) {
    if (skill.last_used_at) {
      const decay = applyFreshnessDecay(skill.score, skill.last_used_at);
      if (decay < skill.score * 0.95) {
        // Only log if significant decay
        console.log(`[DECAY] ${skill.name}: ${skill.score.toFixed(2)} -> ${decay.toFixed(2)}`);
      }
      // Note: We don't persist this decay immediately, just use for selection
      skill._decayedScore = decay;
    }
  }

  // Select skill with exploration
  const skill = selectWithExploration(skills);

  const result = await runSkill(skill.json, input);

  const validation = validate(skill.json.output_schema, result);

  // Use proper evaluation instead of simple pass/fail
  const evalResult = await evaluateSkill(skill.json, capability);
  
  // Update skill score using evaluator result (with smoothing + floor)
  await updateSkillScore(skill, evalResult.score, capability);

  // Re-evaluation trigger: every N uses + cooldown guard
  const currentUsage = skill.usage_count + 1;
  if (currentUsage % CONFIG.reEvalInterval === 0 && shouldReevaluate(skill.last_evaluated_at)) {
    console.log(`[REEVAL] Full re-evaluation: ${skill.name} at ${currentUsage} uses`);
    await skill.update({ last_evaluated_at: new Date() });
  }

  // Mutation logic (with CONSTRAINTS)
  // Only mutate if:
  // 1. Mutation is enabled (mutationRate > 0)
  // 2. Skill has minimum usage (mutationMinUsage)
  // 3. Skill is in top percentile (mutationTopPercent)
  if (CONFIG.mutationRate > 0 && Math.random() < CONFIG.mutationRate) {
    // Check minimum usage requirement
    const mutationCheck = canMutate(skill);
    if (!mutationCheck.eligible) {
      console.log(`[MUTATION] Skipped: ${skill.name} - ${mutationCheck.reason}`);
    } else {
      // Check if skill is in top percentile
      const allSkills = await Skill.findAll({
        where: { capability, status: "active" }
      });
      
      // Sort by score and check if in top percent
      allSkills.sort((a, b) => b.score - a.score);
      const topCount = Math.ceil(allSkills.length * (CONFIG.mutationTopPercent / 100));
      const topSkills = allSkills.slice(0, topCount);
      
      const isTopSkill = topSkills.some(s => s.id === skill.id);
      
      if (!isTopSkill) {
        console.log(`[MUTATION] Skipped: ${skill.name} - not in top ${CONFIG.mutationTopPercent}%`);
      } else {
        const mutated = mutateSkill(skill.json);

        const testResult = await runSkill(mutated, input);

        // Evaluate mutated skill
        const mutatedEval = await evaluateSkill(mutated, capability);

        // Only create version if mutation is actually better
        if (mutatedEval.score > skill.score + 0.05) {
          await createVersion(skill, mutated);
          console.log(`[MUTATION] New version created: ${skill.name} (score: ${mutatedEval.score.toFixed(2)})`);
        }
      }
    }
  }

  return result;
}

async function updateSkillScore(skill, newEvaluatorScore, capability) {
  // Apply score smoothing (inertia) to prevent oscillation
  // newScore = oldScore * 0.7 + newEvaluation * 0.3
  const smoothedScore = applyScoreSmoothing(skill.score, newEvaluatorScore);

  // Soft floor is handled in applyFreshnessDecay, not here
  // Skills below 0.2 get pushed to 0.1 (soft floor)
  const finalScore = smoothedScore;

  await skill.update({
    score: finalScore,
    usage_count: skill.usage_count + 1,
    last_used_at: new Date()
  });
}

async function updateScoreWithEvaluator(skill, capability) {
  // Full evaluation for periodic score refresh
  const evalResult = await evaluateSkill(skill.json, capability);
  await updateSkillScore(skill, evalResult.score, capability);
}

/**
 * Get monitoring metrics for system health
 * These metrics help identify drift, stagnation, and exploration success
 */
export async function getMonitoringMetrics() {
  const skills = await Skill.findAll({
    where: { status: "active" }
  });

  const now = new Date();
  
  // 1. Score drift tracking
  let scoreIncreased = 0;
  let scoreDecreased = 0;
  let scoreStagnant = 0;
  
  // 2. Exploration success tracking (compare random picks vs best)
  const explorationPicks = [];
  
  // 3. Skill stagnation (high usage, low score change)
  const stagnantSkills = [];
  
  // 4. Score distribution
  const scoreRanges = {
    "0.0-0.3": 0,
    "0.3-0.5": 0,
    "0.5-0.7": 0,
    "0.7-0.85": 0,
    "0.85-1.0": 0
  };

  // 5. Freshness (days since last use)
  const freshness = [];

  for (const skill of skills) {
    // Score distribution
    if (skill.score < 0.3) scoreRanges["0.0-0.3"]++;
    else if (skill.score < 0.5) scoreRanges["0.3-0.5"]++;
    else if (skill.score < 0.7) scoreRanges["0.5-0.7"]++;
    else if (skill.score < 0.85) scoreRanges["0.7-0.85"]++;
    else scoreRanges["0.85-1.0"]++;

    // Freshness
    if (skill.last_used_at) {
      const daysIdle = (now - new Date(skill.last_used_at)) / (1000 * 60 * 60 * 24);
      freshness.push({ name: skill.name, daysIdle: daysIdle.toFixed(1) });
    }

    // Stagnation check: high usage but score not improving
    if (skill.usage_count > 20 && skill.success_count > 0) {
      const successRate = skill.success_count / skill.usage_count;
      // If success rate is similar to score, it's stagnant
      if (Math.abs(skill.score - successRate) < 0.1) {
        stagnantSkills.push({
          name: skill.name,
          usage: skill.usage_count,
          score: skill.score.toFixed(2)
        });
      }
    }
  }

  // 6. Confidence vs Score gap (high score but low confidence = potential false positive)
  const falsePositiveCandidates = [];
  
  // 7. Skills near floor (stuck at low score)
  const floorEffectSkills = [];

  for (const skill of skills) {
    // Score distribution
    if (skill.score < 0.3) scoreRanges["0.0-0.3"]++;
    else if (skill.score < 0.5) scoreRanges["0.3-0.5"]++;
    else if (skill.score < 0.7) scoreRanges["0.5-0.7"]++;
    else if (skill.score < 0.85) scoreRanges["0.7-0.85"]++;
    else scoreRanges["0.85-1.0"]++;

    // Freshness
    if (skill.last_used_at) {
      const daysIdle = (now - new Date(skill.last_used_at)) / (1000 * 60 * 60 * 24);
      freshness.push({ name: skill.name, daysIdle: daysIdle.toFixed(1) });
    }

    // Confidence calculation
    const confidence = getConfidence(skill.usage_count);
    
    // False positive detection: high score but low confidence
    if (skill.score > 0.7 && confidence < 0.3) {
      falsePositiveCandidates.push({
        name: skill.name,
        score: skill.score.toFixed(2),
        confidence: confidence.toFixed(2),
        usage: skill.usage_count
      });
    }
    
    // Floor effect detection: skill stuck below 0.25
    if (skill.score < 0.25) {
      floorEffectSkills.push({
        name: skill.name,
        score: skill.score.toFixed(2),
        usage: skill.usage_count
      });
    }

    // Stagnation check: high usage but score not improving
    if (skill.usage_count > 20 && skill.success_count > 0) {
      const successRate = skill.success_count / skill.usage_count;
      // If success rate is similar to score, it's stagnant
      if (Math.abs(skill.score - successRate) < 0.1) {
        stagnantSkills.push({
          name: skill.name,
          usage: skill.usage_count,
          score: skill.score.toFixed(2)
        });
      }
    }
  }

  return {
    totalActiveSkills: skills.length,
    scoreDistribution: scoreRanges,
    freshness,
    stagnantSkills,
    // New metrics
    falsePositiveCandidates,
    floorEffectCount: floorEffectSkills.length,
    floorEffectSkills: floorEffectSkills.slice(0, 5), // Top 5
    explorationRate: CONFIG.explorationRate,
    reEvalInterval: CONFIG.reEvalInterval,
    decayRate: CONFIG.decayRate,
    scoreInertia: CONFIG.scoreInertia,
    mutationRate: CONFIG.mutationRate,
    confidenceCap: CONFIG.confidenceCap,
    confidenceWeight: CONFIG.confidenceWeight,
    // Full config for reference
    config: {
      explorationRate: CONFIG.explorationRate,
      decayRate: CONFIG.decayRate,
      scoreInertia: CONFIG.scoreInertia,
      reEvalCooldown: CONFIG.reEvalCooldown,
      confidenceCap: CONFIG.confidenceCap,
      confidenceWeight: CONFIG.confidenceWeight,
      mutationRate: CONFIG.mutationRate
    }
  };
}

async function updateStats(skill, success) {
  const usage = skill.usage_count + 1;

  const successCount = skill.success_count + (success ? 1 : 0);
  const failCount = skill.failure_count + (success ? 0 : 1);

  const successRate = successCount / usage;

  const newScore =
    skill.score * 0.7 + successRate * 0.3;

  await skill.update({
    usage_count: usage,
    success_count: successCount,
    failure_count: failCount,
    score: newScore,
    last_used_at: new Date()
  });
}

// ============== HARD FILTER (FIX #2) ==============

function filterSkills(skills) {
  return skills.filter(s =>
    s.score > 0.5 &&
    s.usage_count > 2
  );
}

function selectWithHardFilter(skills) {
  const candidates = filterSkills(skills);

  if (candidates.length === 0) {
    console.log("[SELECT] No skills passed hard filter, forcing new skill generation");
    return { forceNew: true, reason: "no_qualified_skills" };
  }

  const scored = candidates.map(skill => ({
    skill,
    score: skill.score * (skill.usage_count / 10)
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].skill;
}

export { filterSkills, selectWithHardFilter };