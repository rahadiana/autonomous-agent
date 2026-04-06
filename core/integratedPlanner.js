/**
 * Integrated Planner - Memory + Bandit + Reuse
 * 
 * Planner yang sudah terintegrasi dengan:
 * - Episodic memory untuk plan reuse
 * - Skill registry dengan bandit selection
 * - Capability-based filtering
 * - Context dari relevant episodes
 */

import { createPlan } from "./planner.js";
import { SkillRegistry, createDefaultSkills } from "./skillRegistry.js";

/**
 * Integrated Planner Configuration
 */
export const INTEGRATED_PLANNER_CONFIG = {
  enableMemoryReuse: true,
  enableSkillSelection: true,
  enableContextEnhancement: true,
  maxReuseAttempts: 2,
  reuseThreshold: 0.7,
  maxPlans: 4,
  enableFallbackPlanning: true
};

/**
 * Integrated Planner Class
 */
export class IntegratedPlanner {
  constructor(options = {}) {
    this.config = { ...INTEGRATED_PLANNER_CONFIG, ...options };
    this.memory = options.memory || null;
    this.skillRegistry = options.skillRegistry || new SkillRegistry();
    this.plans = [];  // Cache generated plans
  }

  /**
   * Generate plans for a goal
   * 
   * @param {Object} params - { goal, context, episodes, capabilities }
   * @returns {Object} - { plans, reused, source }
   */
  async generate(params) {
    const { goal, context = {}, episodes = [], capabilities = [] } = params;
    
    console.log("[INTEGRATED PLANNER] Generating plans for:", goal);

    const plans = [];
    let reused = false;
    let source = "search";

    // PHASE 1: Try memory reuse first
    if (this.config.enableMemoryReuse && this.memory) {
      const reuseResult = await this.tryMemoryReuse(goal, episodes);
      if (reuseResult) {
        plans.push(reuseResult);
        reused = true;
        source = "memory";
        console.log("[INTEGRATED PLANNER] Reused plan from memory");
      }
    }

    // PHASE 2: Generate new plans if needed
    if (plans.length < this.config.maxPlans) {
      const newPlans = await this.generateNewPlans(goal, capabilities, context);
      plans.push(...newPlans);
      
      if (newPlans.length > 0 && !reused) {
        source = "search";
      }
    }

    // PHASE 3: Enhance plans with context
    if (this.config.enableContextEnhancement && episodes.length > 0) {
      for (const plan of plans) {
        this.enhanceWithContext(plan, episodes);
      }
    }

    console.log(`[INTEGRATED PLANNER] Generated ${plans.length} plans (reused: ${reused})`);

    return {
      plans,
      reused,
      source,
      episodeCount: episodes.length
    };
  }

  /**
   * Try to reuse plan from memory
   */
  async tryMemoryReuse(goal, episodes) {
    if (!this.memory) return null;

    try {
      // Use memory's findReusablePlan
      const reuseResult = await this.memory.findReusablePlan(goal);
      
      if (reuseResult && reuseResult.finalScore >= this.config.reuseThreshold) {
        console.log(`[INTEGRATED PLANNER] Found reusable plan with score: ${reuseResult.finalScore.toFixed(3)}`);
        
        return {
          id: `reused_${reuseResult.plan?.id || Date.now()}`,
          type: "reused",
          source: reuseResult.type,
          plan: reuseResult.plan,
          score: reuseResult.finalScore,
          similarity: reuseResult.similarity,
          confidence: reuseResult.weight || reuseResult.finalScore,
          fromMemory: true,
          capability: reuseResult.plan?.bestPath?.[0]?.capability
        };
      }
    } catch (error) {
      console.error("[INTEGRATED PLANNER] Memory reuse error:", error.message);
    }

    return null;
  }

  /**
   * Generate new plans using skill registry
   */
  async generateNewPlans(goal, capabilities, context) {
    const plans = [];
    const expectedCapability = this.extractCapability(goal);

    // Get skills from registry or use provided capabilities
    let skills = this.skillRegistry.list();
    
    if (capabilities.length > 0) {
      // Use provided capabilities
      skills = capabilities.map(c => ({
        capability: c,
        name: c
      }));
    }

    // Filter by expected capability if detected
    if (expectedCapability) {
      skills = skills.filter(s => s.capability === expectedCapability);
    }

    // Generate plan for each skill (if multiple capabilities available)
    for (const skill of skills.slice(0, this.config.maxPlans)) {
      try {
        const planResult = this.generateSkillPlan(goal, skill, context);
        
        if (planResult) {
          plans.push({
            id: `plan_${skill.capability}_${Date.now()}`,
            type: "generated",
            capability: skill.capability,
            skill: skill,
            plan: planResult,
            score: skill.score || 0.5,
            usage_count: skill.usage_count || 0,
            confidence: skill.confidence || 0.5,
            fromMemory: false
          });
        }
      } catch (error) {
        console.error(`[INTEGRATED PLANNER] Error generating plan for ${skill.capability}:`, error.message);
      }
    }

    // If no plans generated, create fallback
    if (plans.length === 0 && this.config.enableFallbackPlanning) {
      const fallbackPlan = this.createFallbackPlan(goal, skills);
      if (fallbackPlan) {
        plans.push(fallbackPlan);
      }
    }

    return plans;
  }

  /**
   * Generate plan using existing planner
   */
  generateSkillPlan(goal, skill, context) {
    const startState = { goal: goal.toString(), steps: 0, iteration: 0 };
    
    const result = createPlan(goal, startState, [skill], {
      maxDepth: 3,
      maxNodes: 50,
      expectedCapability: skill.capability
    });

    return result;
  }

  /**
   * Extract capability from goal text
   */
  extractCapability(goal) {
    const goalStr = goal.toString().toLowerCase();
    
    if (goalStr.includes("add") || goalStr.includes("sum") || goalStr.includes("plus")) {
      return "math.add";
    }
    if (goalStr.includes("multiply") || goalStr.includes("times") || goalStr.includes("product")) {
      return "math.multiply";
    }
    if (goalStr.includes("subtract") || goalStr.includes("minus")) {
      return "math.subtract";
    }
    if (goalStr.includes("divide") || goalStr.includes("divided")) {
      return "math.divide";
    }

    return null;
  }

  /**
   * Create fallback plan if no skills match
   */
  createFallbackPlan(goal, skills) {
    if (skills.length === 0) return null;

    const firstSkill = skills[0];
    
    return {
      id: `fallback_${Date.now()}`,
      type: "fallback",
      capability: firstSkill.capability,
      skill: firstSkill,
      plan: {
        bestPath: [{ capability: firstSkill.capability, skill: firstSkill }],
        status: "fallback"
      },
      score: 0.3,
      fromMemory: false
    };
  }

  /**
   * Enhance plan with context from episodes
   */
  enhanceWithContext(plan, episodes) {
    // Add relevant episode info to plan
    plan.context = {
      similarEpisodes: episodes.slice(0, 3).map(e => ({
        goal: e.episode?.goal,
        score: e.episode?.score,
        capability: e.episode?.plan?.bestPath?.[0]?.capability
      })),
      lessonCount: episodes.length
    };

    // Boost score based on successful similar episodes
    if (episodes.length > 0) {
      const avgScore = episodes.reduce((sum, e) => sum + (e.finalScore || 0), 0) / episodes.length;
      plan.score = Math.max(plan.score, avgScore);
    }
  }

  /**
   * Get available capabilities
   */
  getCapabilities() {
    return this.skillRegistry.list().map(s => s.capability);
  }

  /**
   * Set memory for reuse
   */
  setMemory(memory) {
    this.memory = memory;
  }

  /**
   * Add skill to registry
   */
  addSkill(skill) {
    this.skillRegistry.register(skill);
  }
}

/**
 * Factory function to create integrated planner
 */
export function createIntegratedPlanner(options = {}) {
  return new IntegratedPlanner(options);
}

export default IntegratedPlanner;