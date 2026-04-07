export function isRelevantGoal(goal, currentContext = "") {
  if (!goal || !currentContext) return true;
  
  const goalStr = typeof goal === "string" ? goal : goal.goal || goal.description || "";
  const contextStr = typeof currentContext === "string" ? currentContext : JSON.stringify(currentContext);
  
  const validator = new GoalValidator();
  return validator.stringSimilarity(goalStr, contextStr) > 0.5;
}

export class GoalValidator {
  constructor(options = {}) {
    this.minRelevance = options.minRelevance || 0.6;
    this.minNovelty = options.minNovelty || 0.4;
    this.maxCost = options.maxCost || 0.8;
  }

  isValidGoal(goal) {
    if (!goal) return false;
    if (typeof goal === "string" && goal.trim().length === 0) return false;
    if (typeof goal === "object" && !goal.goal) return false;

    const relevance = goal.relevance ?? this.computeRelevance(goal);
    const novelty = goal.novelty ?? this.computeNovelty(goal);
    const cost = goal.cost ?? this.estimateCost(goal);

    return (
      relevance >= this.minRelevance &&
      novelty >= this.minNovelty &&
      cost <= this.maxCost
    );
  }

  computeRelevance(goal) {
    const goalStr = typeof goal === "string" ? goal : goal.goal;
    if (!goalStr) return 0;

    const relevantKeywords = [
      "add", "sum", "multiply", "divide", "calculate",
      "fetch", "get", "create", "update", "delete",
      "search", "find", "list", "analyze", "process"
    ];

    const matches = relevantKeywords.filter(kw => 
      goalStr.toLowerCase().includes(kw)
    );

    return Math.min(1, matches.length / 3);
  }

  computeNovelty(goal, memory = null) {
    if (!memory) return 0.5;

    const goalStr = typeof goal === "string" ? goal : goal.goal;
    const recentGoals = memory.slice(-10).map(h => h.goal);

    for (const recent of recentGoals) {
      if (this.stringSimilarity(goalStr, recent) > 0.8) {
        return 0.2;
      }
    }

    return 0.6;
  }

  stringSimilarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;

    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    if (aLower.includes(bLower) || bLower.includes(aLower)) {
      return Math.min(1, Math.max(aLower.length, bLower.length) / 
        Math.min(aLower.length, bLower.length)) * 0.5;
    }

    let matches = 0;
    const aWords = aLower.split(/\s+/);
    const bWords = bLower.split(/\s+/);

    for (const aw of aWords) {
      if (bWords.includes(aw)) matches++;
    }

    return matches / Math.max(aWords.length, bWords.length);
  }

  estimateCost(goal) {
    const goalStr = typeof goal === "string" ? goal : goal.goal;
    if (!goalStr) return 0.5;

    let cost = 0.3;

    if (goalStr.includes("all") || goalStr.includes("list")) {
      cost += 0.2;
    }
    if (goalStr.includes("analyze") || goalStr.includes("complex")) {
      cost += 0.3;
    }
    if (goalStr.match(/\d+.*\d+/)) {
      cost += 0.1;
    }

    return Math.min(1, cost);
  }

  validate(goal, memory = null) {
    const relevance = goal.relevance ?? this.computeRelevance(goal);
    const novelty = goal.novelty ?? this.computeNovelty(goal, memory);
    const cost = goal.cost ?? this.estimateCost(goal);

    const valid = this.isValidGoal(goal);

    return {
      valid,
      relevance,
      novelty,
      cost,
      reasons: valid ? [] : this.getRejectionReasons(relevance, novelty, cost)
    };
  }

  getRejectionReasons(relevance, novelty, cost) {
    const reasons = [];
    if (relevance < this.minRelevance) {
      reasons.push(`relevance too low: ${relevance.toFixed(2)} < ${this.minRelevance}`);
    }
    if (novelty < this.minNovelty) {
      reasons.push(`novelty too low: ${novelty.toFixed(2)} < ${this.minNovelty}`);
    }
    if (cost > this.maxCost) {
      reasons.push(`cost too high: ${cost.toFixed(2)} > ${this.maxCost}`);
    }
    return reasons;
  }
}

export class BudgetController {
  constructor(options = {}) {
    this.maxAutonomousGoals = options.maxAutonomousGoals || 3;
    this.maxDepth = options.maxDepth || 2;
    this.maxCost = options.maxCost || 0.8;
    this.goalBudget = options.goalBudget || 10;
    this.usedBudget = 0;
    this.autonomousGoalCount = 0;
    this.goalHistory = [];
    this.penaltyTracker = new Map();
  }

  canGenerateGoal() {
    return (
      this.autonomousGoalCount < this.maxAutonomousGoals &&
      this.usedBudget < this.goalBudget
    );
  }

  consumeBudget(cost = 1) {
    this.usedBudget += cost;
  }

  incrementAutonomousGoals() {
    this.autonomousGoalCount++;
  }

  resetForCycle() {
    this.autonomousGoalCount = 0;
  }

  getRemainingBudget() {
    return this.goalBudget - this.usedBudget;
  }

  isWithinCost(cost) {
    return cost <= this.maxCost;
  }

  isWithinDepth(depth) {
    return depth <= this.maxDepth;
  }

  recordGoal(goal, value, success) {
    this.goalHistory.push({
      goal,
      value,
      success,
      timestamp: Date.now()
    });

    if (!success) {
      const key = this.extractGoalType(goal);
      const currentPenalty = this.penaltyTracker.get(key) || 0;
      this.penaltyTracker.set(key, currentPenalty + 0.1);
    }

    if (this.goalHistory.length > 50) {
      this.goalHistory.shift();
    }
  }

  extractGoalType(goal) {
    const goalStr = typeof goal === "string" ? goal : goal.goal;
    const words = goalStr?.toLowerCase().split(/\s+/) || [];
    return words[0] || "unknown";
  }

  getPenalty(goalType) {
    return this.penaltyTracker.get(goalType) || 0;
  }

  getStats() {
    return {
      autonomousGoals: this.autonomousGoalCount,
      budgetUsed: this.usedBudget,
      budgetRemaining: this.getRemainingBudget(),
      historySize: this.goalHistory.length,
      penalties: Object.fromEntries(this.penaltyTracker)
    };
  }

  reset() {
    this.usedBudget = 0;
    this.autonomousGoalCount = 0;
    this.goalHistory = [];
  }
}

export class ValueFunction {
  constructor(options = {}) {
    this.improvementWeight = options.improvementWeight || 0.5;
    this.noveltyWeight = options.noveltyWeight || 0.3;
    this.costWeight = options.costWeight || 0.2;
    this.penaltyWeight = options.penaltyWeight || 0.15;
  }

  compute(goal, context) {
    const relevance = goal.relevance ?? 0.5;
    const novelty = goal.novelty ?? 0.5;
    const cost = goal.cost ?? 0.5;

    const penalty = this.getPenalty(goal, context);

    const value =
      (relevance * this.improvementWeight) +
      (novelty * this.noveltyWeight) -
      (cost * this.costWeight) -
      (penalty * this.penaltyWeight);

    return {
      value: Math.max(0, Math.min(1, value)),
      breakdown: {
        relevance: relevance * this.improvementWeight,
        novelty: novelty * this.noveltyWeight,
        costPenalty: cost * this.costWeight,
        penalty: penalty * this.penaltyWeight
      }
    };
  }

  getPenalty(goal, context) {
    if (!context?.budgetController) return 0;

    const goalType = this.extractGoalType(goal);
    return context.budgetController.getPenalty(goalType);
  }

  extractGoalType(goal) {
    const goalStr = typeof goal === "string" ? goal : goal.goal;
    const words = goalStr?.toLowerCase().split(/\s+/) || [];
    return words[0] || "unknown";
  }

  rank(goals, context) {
    return goals
      .map(goal => {
        const computed = this.compute(goal, context);
        return {
          ...goal,
          value: computed.value,
          breakdown: computed.breakdown
        };
      })
      .sort((a, b) => b.value - a.value);
  }
}

export class AutonomousGoalGenerator {
  constructor(options = {}) {
    this.validator = new GoalValidator(options.validator || {});
    this.budget = new BudgetController(options.budget || {});
    this.valueFunction = new ValueFunction(options.valueFunction || {});

    this.baseGoals = options.baseGoals || [
      "add numbers",
      "multiply values",
      "calculate sum",
      "fetch data",
      "list items"
    ];

    this.goalTemplates = options.goalTemplates || [
      "{action} {target}",
      "compute {operation} on {values}",
      "{verb} {object} with {params}"
    ];

    this.knowledge = options.knowledge || {
      actions: ["add", "subtract", "multiply", "divide", "fetch", "create"],
      targets: ["numbers", "values", "data", "items", "users"],
      operations: ["sum", "average", "count", "filter"]
    };
  }

  canGenerate() {
    return this.budget.canGenerateGoal();
  }

  generate(context = {}) {
    if (!this.canGenerate()) {
      return null;
    }

    const candidateGoals = this.generateCandidates(context);
    const validGoals = candidateGoals.filter(g => 
      this.validator.isValidGoal(g)
    );

    if (validGoals.length === 0) {
      return null;
    }

    const ranked = this.valueFunction.rank(validGoals, { 
      ...context, 
      budgetController: this.budget 
    });

    const selected = ranked[0];
    
    if (selected && this.budget.isWithinCost(selected.cost)) {
      this.budget.incrementAutonomousGoals();
      this.budget.consumeBudget(selected.cost);

      return [{
        goal: selected.goal,
        value: selected.value,
        relevance: selected.relevance,
        novelty: selected.novelty,
        cost: selected.cost
      }];
    }

    return [];
  }

  generateCandidates(context = {}) {
    const candidates = [];

    candidates.push(...this.baseGoals.map(g => ({
      goal: g,
      relevance: this.validator.computeRelevance(g),
      novelty: this.validator.computeNovelty(g, context.history),
      cost: this.validator.estimateCost(g)
    })));

    for (const action of this.knowledge.actions) {
      for (const target of this.knowledge.targets) {
        const goal = `${action} ${target}`;
        candidates.push({
          goal,
          relevance: this.validator.computeRelevance(goal),
          novelty: this.validator.computeNovelty(goal, context.history),
          cost: this.validator.estimateCost(goal)
        });
      }
    }

    return candidates;
  }

  recordResult(goal, success) {
    this.budget.recordGoal(goal, null, success);
  }

  reset() {
    this.budget.reset();
  }

  getStats() {
    return {
      budget: this.budget.getStats(),
      validator: {
        minRelevance: this.validator.minRelevance,
        minNovelty: this.validator.minNovelty,
        maxCost: this.validator.maxCost
      },
      valueWeights: {
        improvement: this.valueFunction.improvementWeight,
        novelty: this.valueFunction.noveltyWeight,
        cost: this.valueFunction.costWeight
      }
    };
  }
}
