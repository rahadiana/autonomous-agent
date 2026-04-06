/**
 * Skill Registry - Skill Management with Bandit Integration
 * 
 * Manages skills with:
 * - Registration
 * - Stats tracking (score, usage, success_rate)
 * - Bandit-based selection
 * - Versioning support
 */

import { banditScore, selectSkill } from "./bandit.js";

/**
 * Default skill structure
 */
export function createSkill(options = {}) {
  return {
    id: options.id || `skill_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: options.name || options.capability,
    capability: options.capability,
    description: options.description || "",
    logic: options.logic || [],
    score: options.score || 0.5,
    usage_count: options.usage_count || 0,
    success_count: options.success_count || 0,
    total_score: options.total_score || 0,
    confidence: options.confidence || 0.5,
    version: options.version || 1,
    parent_id: options.parent_id || null,
    mutation_number: options.mutation_number || 0,
    last_used_at: options.last_used_at || null,
    created_at: options.created_at || Date.now(),
    // Additional metadata
    avg_latency: options.avg_latency || 0,
    cost: options.cost || 1,
    tags: options.tags || []
  };
}

/**
 * Skill Registry class
 */
export class SkillRegistry {
  constructor(options = {}) {
    this.skills = new Map();  // capability -> skill (latest version)
    this.versions = new Map(); // versionId -> skill
    this.maxVersions = options.maxVersions || 5;
    this.minScoreThreshold = options.minScoreThreshold || 0.3;
  }

  /**
   * Register a new skill
   */
  register(skill) {
    if (!skill || !skill.capability) {
      console.warn("[SKILL REGISTRY] Cannot register skill without capability");
      return false;
    }

    const normalizedCapability = skill.capability;
    
    // Store in capabilities map
    const existing = this.skills.get(normalizedCapability);
    if (existing) {
      // Keep both in version history
      this.versions.set(skill.id, skill);
      // Update latest version
      if (skill.score > existing.score) {
        this.skills.set(normalizedCapability, skill);
      }
    } else {
      this.skills.set(normalizedCapability, skill);
      this.versions.set(skill.id, skill);
    }

    console.log(`[SKILL REGISTRY] Registered: ${skill.name || skill.capability} (score: ${skill.score?.toFixed(3)})`);
    return true;
  }

  /**
   * Unregister a skill
   */
  unregister(skillId) {
    // Find skill
    let capability = null;
    for (const [cap, skill] of this.skills) {
      if (skill.id === skillId) {
        capability = cap;
        break;
      }
    }

    if (capability) {
      const skill = this.skills.get(capability);
      this.skills.delete(capability);
      this.versions.delete(skillId);
      console.log(`[SKILL REGISTRY] Unregistered: ${skillId}`);
      return true;
    }

    return false;
  }

  /**
   * Get skill by capability (latest version)
   */
  get(capability) {
    return this.skills.get(capability);
  }

  /**
   * Get all skills
   */
  list() {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by capability
   */
  getByCapability(capability) {
    return Array.from(this.versions.values())
      .filter(s => s.capability === capability);
  }

  /**
   * Select skill using bandit
   */
  selectWithBandit(capability = null) {
    let skillsToSelect = this.list();
    
    if (capability) {
      skillsToSelect = this.getByCapability(capability);
    }

    if (skillsToSelect.length === 0) {
      return null;
    }

    const totalUsage = skillsToSelect.reduce((sum, s) => sum + (s.usage_count || 1), 0);
    
    let best = null;
    let bestScore = -Infinity;

    for (const skill of skillsToSelect) {
      const score = banditScore(skill, totalUsage);
      if (score > bestScore) {
        bestScore = score;
        best = skill;
      }
    }

    return best;
  }

  /**
   * Update skill stats after execution
   */
  updateStats(skillId, success, score) {
    const skill = this.versions.get(skillId);
    if (!skill) return false;

    skill.usage_count = (skill.usage_count || 0) + 1;
    
    if (success) {
      skill.success_count = (skill.success_count || 0) + 1;
    }

    // Update running average
    const alpha = 0.2;
    skill.total_score = (skill.total_score || 0) * (1 - alpha) + score * alpha;
    
    // Recalculate score
    if (skill.usage_count > 0) {
      const successRate = skill.success_count / skill.usage_count;
      skill.score = successRate * 0.7 + (skill.total_score / skill.usage_count) * 0.3;
    }

    skill.last_used_at = Date.now();

    // Update latest version if better
    const latest = this.skills.get(skill.capability);
    if (skill.score > (latest?.score || 0)) {
      this.skills.set(skill.capability, skill);
    }

    return true;
  }

  /**
   * Get stats for all skills
   */
  getStats() {
    const stats = {
      totalSkills: this.skills.size,
      totalVersions: this.versions.size,
      skills: []
    };

    for (const skill of this.list()) {
      stats.skills.push({
        id: skill.id,
        name: skill.name,
        capability: skill.capability,
        score: skill.score?.toFixed(3),
        usage_count: skill.usage_count,
        success_count: skill.success_count,
        success_rate: skill.usage_count > 0 
          ? (skill.success_count / skill.usage_count).toFixed(3) 
          : 0,
        version: skill.version,
        confidence: skill.confidence?.toFixed(3)
      });
    }

    return stats;
  }

  /**
   * Clear all skills
   */
  clear() {
    this.skills.clear();
    this.versions.clear();
  }
}

/**
 * Create default math skills
 */
export function createDefaultSkills() {
  return [
    createSkill({
      name: "math.add",
      capability: "math.add",
      description: "Add two numbers",
      logic: [{ op: "add", a: "input.a", b: "input.b", to_output: "result" }],
      score: 0.5
    }),
    createSkill({
      name: "math.multiply",
      capability: "math.multiply",
      description: "Multiply two numbers",
      logic: [{ op: "multiply", a: "input.a", b: "input.b", to_output: "result" }],
      score: 0.5
    }),
    createSkill({
      name: "math.subtract",
      capability: "math.subtract",
      description: "Subtract two numbers",
      logic: [{ op: "subtract", a: "input.a", b: "input.b", to_output: "result" }],
      score: 0.5
    }),
    createSkill({
      name: "math.divide",
      capability: "math.divide",
      description: "Divide two numbers",
      logic: [{ op: "divide", a: "input.a", b: "input.b", to_output: "result" }],
      score: 0.5
    })
  ];
}

export default SkillRegistry;