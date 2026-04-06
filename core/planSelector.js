/**
 * Plan Selector - Bandit-Based Plan Selection
 * 
 * 选择最好的 plan menggunakan UCB (Upper Confidence Bound):
 * - exploitation: plan dengan score tinggi
 * - exploration: plan yang jarang dipakai
 * 
 * Ini mencegah sistem stuck di local optimum.
 */

import { banditScore } from "./bandit.js";

/**
 * Plan Selector Configuration
 */
export const PLAN_SELECTOR_CONFIG = {
  explorationConstant: 1.2,    // C parameter for UCB
  minUsageForSelection: 0,    // Minimum usage before considered
  enableDiversityCheck: true, // Check for diversity in selection
  diversityThreshold: 0.3,    // Minimum diversity score
  enableSoftmax: false,       // Use softmax instead of UCB
  softmaxTemperature: 1.0,    // Temperature for softmax
  enableEpsilonGreedy: false,  // Use epsilon-greedy
  epsilon: 0.1                // Probability of random selection
};

/**
 * Plan Selector Class
 */
export class PlanSelector {
  constructor(options = {}) {
    this.config = { ...PLAN_SELECTOR_CONFIG, ...options };
    this.totalSelections = 0;
    this.selectionHistory = [];  // Track what was selected
  }

  /**
   * Select best plan using bandit (UCB)
   * 
   * @param {Array} plans - Array of plan objects
   * @param {Object} state - Current state (for context)
   * @returns {Object} Selected plan
   */
  select(plans, state = {}) {
    if (!plans || plans.length === 0) {
      console.warn("[PLAN SELECTOR] No plans to select from");
      return null;
    }

    if (plans.length === 1) {
      console.log("[PLAN SELECTOR] Only one plan available, selecting it");
      this.recordSelection(plans[0]);
      return plans[0];
    }

    console.log(`[PLAN SELECTOR] Selecting from ${plans.length} plans`);

    // Check for epsilon-greedy
    if (this.config.enableEpsilonGreedy && Math.random() < this.config.epsilon) {
      const randomPlan = plans[Math.floor(Math.random() * plans.length)];
      console.log("[PLAN SELECTOR] Epsilon-greedy: random selection");
      this.recordSelection(randomPlan);
      return randomPlan;
    }

    // Check for softmax
    if (this.config.enableSoftmax) {
      return this.selectSoftmax(plans);
    }

    // Use UCB (default)
    return this.selectUCB(plans, state);
  }

  /**
   * Select using Upper Confidence Bound
   */
  selectUCB(plans, state = {}) {
    let bestPlan = null;
    let bestScore = -Infinity;

    // Calculate total selections for exploration term
    const totalSelections = plans.reduce((sum, p) => 
      sum + (p.usage_count || 0), 0
    ) + this.totalSelections;

    for (const plan of plans) {
      const score = this.calculateUCBScore(plan, totalSelections);
      
      console.log(`[PLAN SELECTOR] Plan ${plan.id || plan.capability}: score=${score.toFixed(3)}, base=${(plan.score || 0.5).toFixed(3)}, usage=${plan.usage_count || 0}`);

      if (score > bestScore) {
        bestScore = score;
        bestPlan = plan;
      }
    }

    if (bestPlan) {
      this.recordSelection(bestPlan);
      console.log(`[PLAN SELECTOR] Selected: ${bestPlan.id || bestPlan.capability} (UCB score: ${bestScore.toFixed(3)})`);
    }

    return bestPlan;
  }

  /**
   * Calculate UCB score for a plan
   */
  calculateUCBScore(plan, totalSelections) {
    const c = this.config.explorationConstant;
    const usage = plan.usage_count || 0;
    
    // Exploitation: base score
    const exploit = plan.score || 0.5;
    
    // Exploration: UCB term
    const explore = c * Math.sqrt(
      Math.log(totalSelections + 1) / (usage + 1)
    );

    return exploit + explore;
  }

  /**
   * Select using Softmax
   */
  selectSoftmax(plans) {
    // Calculate softmax probabilities
    const scores = plans.map(p => p.score || 0.5);
    const temperature = this.config.softmaxTemperature;
    
    // Calculate exp scores
    const expScores = scores.map(s => Math.exp(s / temperature));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    
    // Calculate probabilities
    const probs = expScores.map(e => e / sumExp);
    
    // Random selection based on probabilities
    const rand = Math.random();
    let cumProb = 0;
    
    for (let i = 0; i < plans.length; i++) {
      cumProb += probs[i];
      if (rand <= cumProb) {
        this.recordSelection(plans[i]);
        console.log(`[PLAN SELECTOR] Selected (softmax): ${plans[i].id || plans[i].capability}`);
        return plans[i];
      }
    }

    // Fallback to last plan
    const lastPlan = plans[plans.length - 1];
    this.recordSelection(lastPlan);
    return lastPlan;
  }

  /**
   * Record selection for tracking
   */
  recordSelection(plan) {
    this.totalSelections++;
    this.selectionHistory.push({
      planId: plan.id,
      capability: plan.capability,
      timestamp: Date.now()
    });
  }

  /**
   * Get selection statistics
   */
  getStats() {
    const capabilityCounts = {};
    
    for (const selection of this.selectionHistory) {
      const cap = selection.capability || "unknown";
      capabilityCounts[cap] = (capabilityCounts[cap] || 0) + 1;
    }

    return {
      totalSelections: this.totalSelections,
      uniquePlans: new Set(this.selectionHistory.map(s => s.planId)).size,
      capabilityDistribution: capabilityCounts,
      history: this.selectionHistory.slice(-10)  // Last 10
    };
  }

  /**
   * Reset selector state
   */
  reset() {
    this.totalSelections = 0;
    this.selectionHistory = [];
  }

  /**
   * Check diversity of plans
   */
  checkDiversity(plans) {
    if (!this.config.enableDiversityCheck || plans.length < 2) {
      return { diverse: true, score: 1 };
    }

    // Count unique capabilities
    const capabilities = new Set(plans.map(p => p.capability));
    const diversity = capabilities.size / plans.length;

    return {
      diverse: diversity >= this.config.diversityThreshold,
      score: diversity,
      uniqueCapabilities: capabilities.size,
      totalPlans: plans.length
    };
  }

  /**
   * Select multiple plans (for parallel execution)
   */
  selectMultiple(plans, count = 2, state = {}) {
    if (!plans || plans.length === 0) return [];
    if (plans.length <= count) return plans;

    // Sort by UCB score
    const scored = plans.map(p => ({
      plan: p,
      score: this.calculateUCBScore(p, this.totalSelections + plans.length)
    }));

    scored.sort((a, b) => b.score - a.score);

    // Return top N
    const selected = scored.slice(0, count).map(s => {
      this.recordSelection(s.plan);
      return s.plan;
    });

    console.log(`[PLAN SELECTOR] Selected ${count} plans for parallel execution`);
    return selected;
  }
}

/**
 * Factory function
 */
export function createPlanSelector(options = {}) {
  return new PlanSelector(options);
}

export default PlanSelector;