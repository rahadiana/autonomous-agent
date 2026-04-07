/**
 * Skill Management Utilities - Production Grade
 * 
 * Features:
 * - Duplicate detection
 * - Capability normalization
 * - Failure memory system
 * - Diversity control
 * - Global reward signal
 */

import { createVersion } from "./versioning.js";

// ============== CIRCUIT BREAKER ==============

const CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000
};

const circuitBreakerState = new Map();

export function checkCircuitBreaker(skill) {
  const key = skill.id || skill.capability;
  const state = circuitBreakerState.get(key);
  
  if (!state) return { closed: true };
  
  if (state.failure_count > CircuitBreakerConfig.failureThreshold) {
    if (Date.now() - state.last_failure < CircuitBreakerConfig.resetTimeout) {
      return { closed: false, reason: "circuit_open", failure_count: state.failure_count };
    }
    state.failure_count = 0;
  }
  
  return { closed: true };
}

export function recordSkillFailure(skill) {
  const key = skill.id || skill.capability;
  let state = circuitBreakerState.get(key);
  
  if (!state) {
    state = { failure_count: 0, last_failure: 0 };
    circuitBreakerState.set(key, state);
  }
  
  state.failure_count++;
  state.last_failure = Date.now();
}

export function recordSkillSuccess(skill) {
  const key = skill.id || skill.capability;
  const state = circuitBreakerState.get(key);
  
  if (state) {
    state.failure_count = 0;
  }
}

export function getDisabledSkills() {
  const disabled = [];
  for (const [key, state] of circuitBreakerState) {
    if (state.failure_count > CircuitBreakerConfig.failureThreshold) {
      disabled.push(key);
    }
  }
  return disabled;
}

// ============== CONFIGURATION ==============

export const SKILL_MANAGEMENT_CONFIG = {
  maxSkills: 1000,
  maxMutations: 50,
  maxCycles: 10,
  minDiversityScore: 0.3,
  failureThreshold: 3,  // failures before penalty
  failurePenalty: 0.5   // multiply score by 0.5 after too many failures
};

// ============== CAPABILITY NORMALIZATION ==============

/**
 * Normalize capability string to standard format
 * "Math.Add" -> "math.add"
 * "HTTP_GET Request" -> "http_get_request"
 */
export function normalizeCapability(text) {
  if (!text || typeof text !== "string") return "unknown";
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .trim();
}

/**
 * Extract capability type from goal text
 */
export function extractCapabilityFromGoal(goalText) {
  const text = goalText.toLowerCase();
  
  const patterns = [
    { regex: /(add|sum|plus|total)/, capability: "math.add" },
    { regex: /(multiply|times|product)/, capability: "math.multiply" },
    { regex: /(subtract|minus|diff)/, capability: "math.subtract" },
    { regex: /(divide|division|quotient)/, capability: "math.divide" },
    { regex: /(get|fetch|retrieve|read)/, capability: "http.get" },
    { regex: /(post|create|send)/, capability: "http.post" },
    { regex: /(parse|convert|transform)/, capability: "data.transform" }
  ];
  
  for (const p of patterns) {
    if (p.regex.test(text)) {
      return p.capability;
    }
  }
  
  return "general.unknown";
}

export function filterEnabledSkills(skills) {
  const disabled = getDisabledSkills();
  return skills.filter(s => !disabled.includes(s.id || s.capability));
}

// ============== DUPLICATE DETECTION ==============

/**
 * Check if skill is duplicate of existing skill
 * Compares logic structure, not ID or metadata
 */
export function isDuplicateSkill(newSkill, existingSkills) {
  if (!newSkill?.logic) return false;
  
  const newLogicStr = JSON.stringify(newSkill.logic);
  
  return existingSkills.some(s => {
    if (!s?.logic) return false;
    return JSON.stringify(s.logic) === newLogicStr;
  });
}

/**
 * Check similarity between two skills (for diversity control)
 * Returns 0-1 score
 */
export function calculateSkillSimilarity(skillA, skillB) {
  if (!skillA?.logic || !skillB?.logic) return 0;
  
  // Same capability = high similarity
  if (skillA.capability === skillB.capability) {
    return 0.8;
  }
  
  // Same operations = medium similarity
  const opsA = skillA.logic.map(s => s.op).sort().join(",");
  const opsB = skillB.logic.map(s => s.op).sort().join(",");
  
  if (opsA === opsB) {
    return 0.5;
  }
  
  return 0;  // Different
}

// ============== DIVERSITY CONTROL ==============

/**
 * Ensure skill selection maintains diversity
 * Prevents all selections converging to same skill type
 */
export function ensureDiversity(skills, selectedCount = 3) {
  if (skills.length <= selectedCount) return skills;
  
  // Group by capability
  const byCapability = new Map();
  for (const skill of skills) {
    const cap = skill.capability || "unknown";
    if (!byCapability.has(cap)) {
      byCapability.set(cap, []);
    }
    byCapability.get(cap).push(skill);
  }
  
  // Select top from each capability
  const selected = [];
  for (const [, capSkills] of byCapability) {
    // Sort by score
    capSkills.sort((a, b) => (b.score || 0) - (a.score || 0));
    selected.push(capSkills[0]);  // Best from each capability
  }
  
  // If not enough, add best overall
  if (selected.length < selectedCount) {
    const remaining = skills.filter(s => !selected.includes(s));
    remaining.sort((a, b) => (b.score || 0) - (a.score || 0));
    selected.push(...remaining.slice(0, selectedCount - selected.length));
  }
  
  return selected;
}

// ============== FAILURE MEMORY ==============

export class FailureMemory {
  constructor(options = {}) {
    this.maxFailures = options.maxFailures || 1000;
    this.failures = new Map();  // skillId -> [{ input, error, timestamp }]
    this.globalFailureCount = 0;
  }
  
  /**
   * Log a failure for a skill
   */
  async logFailure(skillId, input, error) {
    if (!this.failures.has(skillId)) {
      this.failures.set(skillId, []);
    }
    
    const skillFailures = this.failures.get(skillId);
    skillFailures.push({
      input: this.sanitizeInput(input),
      error: error.message || String(error),
      timestamp: Date.now()
    });
    
    this.globalFailureCount++;
    
    // Trim if too many
    if (skillFailures.length > 100) {
      skillFailures.splice(0, skillFailures.length - 100);
    }
    
    return this.getFailureStats(skillId);
  }
  
  /**
   * Get failure count for a skill
   */
  getFailureCount(skillId) {
    return this.failures.get(skillId)?.length || 0;
  }
  
  /**
   * Check if skill has too many failures
   */
  hasTooManyFailures(skillId) {
    return this.getFailureCount(skillId) >= SKILL_MANAGEMENT_CONFIG.failureThreshold;
  }
  
  /**
   * Get failure rate for a skill
   */
  getFailureRate(skillId, totalAttempts) {
    const failures = this.getFailureCount(skillId);
    return totalAttempts > 0 ? failures / totalAttempts : 0;
  }
  
  /**
   * Get failure stats for a skill
   */
  getFailureStats(skillId) {
    const failures = this.failures.get(skillId) || [];
    const recent = failures.slice(-5);
    
    return {
      count: failures.length,
      recentErrors: recent.map(f => f.error),
      failureRate: 0,  // Calculated externally
      shouldPenalize: failures.length >= SKILL_MANAGEMENT_CONFIG.failureThreshold
    };
  }
  
  /**
   * Get global failure stats
   */
  getGlobalStats() {
    return {
      totalFailures: this.globalFailureCount,
      skillsWithFailures: this.failures.size,
      avgFailuresPerSkill: this.failures.size > 0 
        ? this.globalFailureCount / this.failures.size 
        : 0
    };
  }
  
  /**
   * Sanitize input for storage (remove sensitive data)
   */
  sanitizeInput(input) {
    if (!input) return {};
    const sanitized = { ...input };
    
    // Remove potentially sensitive fields
    const sensitiveKeys = ["password", "token", "secret", "key", "api_key"];
    for (const key of sensitiveKeys) {
      if (sanitized[key]) sanitized[key] = "[REDACTED]";
    }
    
    return sanitized;
  }
  
  /**
   * Clear failures for a skill (after successful execution)
   */
  clearFailures(skillId) {
    this.failures.delete(skillId);
  }
  
  /**
   * Get recent failure patterns (for learning)
   */
  getFailurePatterns(limit = 10) {
    const patterns = [];
    
    for (const [skillId, failures] of this.failures) {
      const recent = failures.slice(-limit);
      if (recent.length > 0) {
        patterns.push({
          skillId,
          count: recent.length,
          lastError: recent[recent.length - 1].error
        });
      }
    }
    
    return patterns.sort((a, b) => b.count - a.count);
  }
}

// ============== GLOBAL REWARD SIGNAL ==============

/**
 * Compute reward signal (replaces dummy evaluator)
 * 
 * @param {Object} params - { result, validation, skill, failureRate, latency }
 * @returns {number} Score 0-1
 */
export function computeReward(params) {
  const { result, validation, skill, failureRate = 0, latency = 0 } = params;
  
  let score = 0;
  
  // 1. Schema validity (30%)
  if (validation?.valid) {
    score += 0.3;
  } else if (validation?.errors?.length > 0) {
    score += 0.1;  // Partial credit
  }
  
  // 2. Output richness (20%)
  if (result && typeof result === "object") {
    const keys = Object.keys(result).filter(k => !k.startsWith("_"));
    if (keys.length > 0) {
      score += Math.min(0.2, keys.length * 0.05);
    }
  }
  
  // 3. Historical success rate (20%)
  const usageCount = skill?.usage_count || 1;
  const successCount = skill?.success_count || 0;
  const historicalRate = successCount / usageCount;
  score += historicalRate * 0.2;
  
  // 4. Latency bonus (10%)
  if (latency > 0 && latency < 100) {
    score += 0.1;
  } else if (latency >= 100 && latency < 500) {
    score += 0.05;
  }
  
  // 5. Failure penalty (apply negative signal)
  if (failureRate > 0.5) {
    score *= 0.5;  // Heavy penalty for high failure rate
  } else if (failureRate > 0.3) {
    score *= 0.8;  // Light penalty
  }
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Determine if exploration should happen
 * Based on exploration rate and skill diversity
 */
export function shouldExplore(config = {}) {
  const explorationRate = config.explorationRate || 0.2;
  
  // Random exploration
  if (Math.random() < explorationRate * 0.5) {
    return true;
  }
  
  // Exploration for low-usage skills
  return false;
}

/**
 * Calculate improvement score for mutation
 */
export function calculateImprovement(oldScore, newScore) {
  if (oldScore === 0) return newScore;
  return (newScore - oldScore) / oldScore;
}

// ============== SKILL LIFECYCLE ==============

/**
 * Complete skill lifecycle management
 */
export class SkillLifecycleManager {
  constructor(options = {}) {
    this.failureMemory = new FailureMemory(options);
    this.maxSkills = options.maxSkills || SKILL_MANAGEMENT_CONFIG.maxSkills;
  }
  
  /**
   * Before execution: check if skill should be used
   */
  beforeExecution(skill) {
    // Check failure penalty
    if (this.failureMemory.hasTooManyFailures(skill.id)) {
      console.log(`[LIFECYCLE] Skill ${skill.id} has too many failures, applying penalty`);
      return {
        allowed: true,
        penalty: true,
        modifiedScore: (skill.score || 0.5) * SKILL_MANAGEMENT_CONFIG.failurePenalty
      };
    }
    
    return { allowed: true, penalty: false };
  }
  
  /**
   * After execution: update skill state
   */
  afterExecution(skill, result, success) {
    if (!success) {
      // Log failure
      this.failureMemory.logFailure(skill.id, result, new Error("Execution failed"));
    } else {
      // Clear failures on success
      this.failureMemory.clearFailures(skill.id);
    }
  }
  
  /**
   * Check if new skill should be accepted
   */
  shouldAcceptNewSkill(newSkill, existingSkills) {
    // Check limit
    if (existingSkills.length >= this.maxSkills) {
      console.log("[LIFECYCLE] Max skills reached");
      return { accepted: false, reason: "max_skills" };
    }
    
    // Check duplicate
    if (isDuplicateSkill(newSkill, existingSkills)) {
      return { accepted: false, reason: "duplicate" };
    }
    
    return { accepted: true };
  }
}

// ============== FACTORY ==============

export function createSkillManager(options = {}) {
  return new SkillLifecycleManager(options);
}

export default {
  normalizeCapability,
  extractCapabilityFromGoal,
  isDuplicateSkill,
  calculateSkillSimilarity,
  ensureDiversity,
  computeReward,
  shouldExplore,
  calculateImprovement,
  FailureMemory,
  SkillLifecycleManager,
  SKILL_MANAGEMENT_CONFIG
};