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
  explorationRate: 0.1,    // 10% exploration
  decayRate: 0.02,         // 2% score decay per day idle
  mutationRate: 0.0,       // DISABLED - not ready yet
  
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
  scoreNormalization: true // Normalize scores before UCB calculation
};

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
 * Select a skill with EXPLORATION (uncertainty-aware + cooldown + normalized)
 * - 90%: select best by final score (score + confidence)
 * - 10%: random selection from TOP 50% by exploration score
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
  
  // Normalize scores if enabled
  let processedSkills = CONFIG.scoreNormalization 
    ? normalizeScore(availableSkills) 
    : availableSkills.map(s => ({ ...s, normalizedScore: s.score }));
  
  if (Math.random() < CONFIG.explorationRate) {
    // Calculate exploration scores and pick from top 50%
    const withExplorationScore = processedSkills.map(s => ({
      skill: s,
      explorationScore: getExplorationScore(s)
    }));
    
    // Sort by exploration score (not just raw score)
    withExplorationScore.sort((a, b) => b.explorationScore - a.explorationScore);
    const topHalf = withExplorationScore.slice(0, Math.ceil(withExplorationScore.length / 2));
    
    const randomIdx = Math.floor(Math.random() * topHalf.length);
    const selected = topHalf[randomIdx].skill;
    
    console.log(`[EXPLORE] Uncertainty-aware pick: ${selected.name} (score: ${selected.normalizedScore?.toFixed(2) || selected.score.toFixed(2)}, usage: ${selected.usage_count})`);
    return selected;
  }
  
  // Exploitation: select based on final score (score + confidence blend)
  const withFinalScore = processedSkills.map(s => ({
    skill: s,
    finalScore: (s.normalizedScore ?? s.score) * (1 - CONFIG.confidenceWeight) + getConfidence(s.usage_count) * CONFIG.confidenceWeight
  }));
  
  withFinalScore.sort((a, b) => b.finalScore - a.finalScore);
  return withFinalScore[0].skill;
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