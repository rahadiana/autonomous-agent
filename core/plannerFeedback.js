import { createCritic } from './reasoner.js';

export class PlannerFeedbackLoop {
  constructor(options = {}) {
    this.planner = options.planner;
    this.critic = createCritic();
    this.history = [];
    this.maxHistory = options.maxHistory || 100;
    this.improvementThreshold = options.improvementThreshold || 0.05;
  }

  async executeWithFeedback(goal, input, executionFn) {
    const startTime = Date.now();
    
    const plan = await this.planner.search(input, goal);
    
    const result = await executionFn(plan);
    
    const critique = await this.critic.review({
      goal,
      plan,
      result
    });

    this.history.push({
      goal,
      plan,
      result,
      critique,
      timestamp: Date.now(),
      duration: Date.now() - startTime
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return {
      plan,
      result,
      critique,
      feedback: critique.suggestions
    };
  }

  async improvePlan(goal, currentPlan, input, executionFn) {
    let bestScore = currentPlan.score || 0;
    let improvedPlan = currentPlan;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const executionResult = await this.executeWithFeedback(goal, input, executionFn);
      
      if (executionResult.critique.score > bestScore + this.improvementThreshold) {
        bestScore = executionResult.critique.score;
        improvedPlan = executionResult.plan;
      } else {
        break;
      }
      
      attempts++;
    }

    return {
      plan: improvedPlan,
      score: bestScore,
      attempts,
      converged: attempts < maxAttempts
    };
  }

  getHistory() {
    return [...this.history];
  }

  getRecentFeedback(count = 5) {
    return this.history.slice(-count);
  }

  clearHistory() {
    this.history = [];
  }
}

export function createFeedbackLoop(planner, options = {}) {
  return new PlannerFeedbackLoop({ planner, ...options });
}
