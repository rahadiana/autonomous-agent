export class Reasoner {
  constructor(options = {}) {
    this.maxIterations = options.maxIterations || 100;
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
  }

  evaluate(plan, context = {}) {
    const evaluation = {
      score: 0,
      confidence: 0,
      reasons: [],
      suggestions: []
    };

    if (!plan || !plan.status) {
      evaluation.reasons.push("Invalid plan");
      evaluation.confidence = 0;
      return evaluation;
    }

    switch (plan.status) {
      case "success":
        evaluation.score = 1.0;
        evaluation.confidence = 0.95;
        evaluation.reasons.push("Goal achieved successfully");
        break;

      case "timeout":
        evaluation.score = 0.3;
        evaluation.confidence = 0.5;
        evaluation.reasons.push("Search timed out");
        evaluation.suggestions.push("Increase timeout or reduce search space");
        break;

      case "limit_exceeded":
        evaluation.score = 0.4;
        evaluation.confidence = 0.6;
        evaluation.reasons.push("Node limit exceeded");
        evaluation.suggestions.push("Consider narrowing action space or reducing depth");
        break;

      case "no_solution":
        evaluation.score = 0;
        evaluation.confidence = 0.8;
        evaluation.reasons.push("No solution found");
        evaluation.suggestions.push("Check if goal is achievable with available skills");
        break;

      default:
        evaluation.reasons.push("Unknown status");
    }

    if (plan.bestPath && plan.bestPath.length > 0) {
      const pathEfficiency = 1 / (plan.bestPath.length + 1);
      evaluation.score = evaluation.score * 0.7 + pathEfficiency * 0.3;
      evaluation.reasons.push(`Generated ${plan.bestPath.length} actions`);
    }

    if (plan.nodesExplored !== undefined) {
      const explorationEfficiency = Math.max(0, 1 - (plan.nodesExplored / 1000));
      evaluation.score = evaluation.score * 0.8 + explorationEfficiency * 0.2;
    }

    if (context.constraints) {
      if (context.constraints.maxSteps && plan.bestPath) {
        if (plan.bestPath.length > context.constraints.maxSteps) {
          evaluation.score *= 0.5;
          evaluation.suggestions.push("Plan exceeds max steps constraint");
        }
      }
    }

    return evaluation;
  }

  critique(plan, history = []) {
    const critique = {
      issues: [],
      strengths: [],
      improvements: []
    };

    if (!plan.bestPath || plan.bestPath.length === 0) {
      critique.issues.push("No actions in plan");
      return critique;
    }

    if (plan.status !== "success" && plan.status !== "no_solution") {
      critique.issues.push(`Plan ended with status: ${plan.status}`);
    }

    const actionTypes = new Set(plan.bestPath.map(a => a.capability));
    if (actionTypes.size === 1) {
      critique.issues.push("Plan uses only one action type - may be suboptimal");
    } else {
      critique.strengths.push(`Diverse action selection (${actionTypes.size} types)`);
    }

    if (plan.bestPath.length > 20) {
      critique.issues.push("Plan is very long - may be inefficient");
      critique.improvements.push("Consider decomposing into subtasks");
    } else if (plan.bestPath.length <= 5) {
      critique.strengths.push("Concise plan");
    }

    if (history.length > 0) {
      const recentSimilar = history.slice(-5).filter(h => 
        h.goal === plan.goal
      );
      
      if (recentSimilar.length > 0) {
        const avgScore = recentSimilar.reduce((sum, h) => sum + (h.evaluation?.score || 0), 0) / recentSimilar.length;
        
        if (avgScore > 0.8) {
          critique.strengths.push("Consistent high performance on similar goals");
        } else if (avgScore < 0.5) {
          critique.improvements.push("Struggled with similar goals before");
        }
      }
    }

    return critique;
  }

  reflect(plan, executionResult) {
    const reflection = {
      learned: [],
      adapted: false,
      recommendations: []
    };

    if (executionResult.success) {
      reflection.learned.push("Execution successful - strategy validated");
      
      if (plan.bestPath && plan.bestPath.length > 0) {
        reflection.learned.push(`Effective actions: ${plan.bestPath.map(a => a.capability).join(", ")}`);
      }
    } else {
      reflection.learned.push("Execution failed - strategy invalidated");
      
      if (executionResult.error) {
        reflection.learned.push(`Error: ${executionResult.error}`);
      }

      reflection.adapted = true;
      reflection.recommendations.push("Consider alternative action sequences");
      reflection.recommendations.push("May need to acquire new skills");
    }

    if (executionResult.time && executionResult.time > 5000) {
      reflection.learned.push("Execution took longer than expected");
      reflection.recommendations.push("Consider optimizing action sequence");
    }

    return reflection;
  }

  selectBest(plans) {
    if (!plans || plans.length === 0) return null;
    
    return plans.reduce((best, current) => {
      const currentEval = this.evaluate(current);
      const bestEval = this.evaluate(best);
      
      return currentEval.score > bestEval.score ? current : best;
    });
  }
}

export function createCritic() {
  return {
    async review(plan, context) {
      const reasoner = new Reasoner();
      return reasoner.evaluate(plan, context);
    },
    
    async suggest(plan, history) {
      const reasoner = new Reasoner();
      const critique = reasoner.critique(plan, history);
      
      return {
        issues: critique.issues,
        strengths: critique.strengths,
        suggestions: critique.improvements
      };
    }
  };
}