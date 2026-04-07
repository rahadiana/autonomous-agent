export class MetaEvaluator {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 20;
    this.metricsHistory = [];
  }

  analyzeSystemPerformance(stats) {
    const memoryStats = stats.memory || {};
    const autonomyStats = stats.autonomy?.budget || {};

    const planningEfficiency = this.calculatePlanningEfficiency(stats);
    const reuseRate = this.calculateReuseRate(memoryStats);
    const failureRate = this.calculateFailureRate(memoryStats);
    const successRate = this.calculateSuccessRate(memoryStats);
    const adaptationSpeed = this.calculateAdaptationSpeed(memoryStats);
    const resourceEfficiency = this.calculateResourceEfficiency(autonomyStats);

    const overallScore = (
      planningEfficiency * 0.25 +
      reuseRate * 0.20 +
      successRate * 0.25 +
      adaptationSpeed * 0.15 +
      resourceEfficiency * 0.15
    );

    const analysis = {
      planningEfficiency,
      reuseRate,
      failureRate,
      successRate,
      adaptationSpeed,
      resourceEfficiency,
      overallScore,
      timestamp: Date.now()
    };

    this.metricsHistory.push(analysis);
    if (this.metricsHistory.length > this.windowSize) {
      this.metricsHistory.shift();
    }

    return analysis;
  }

  calculatePlanningEfficiency(stats) {
    if (!stats.history || stats.history.length === 0) return 0.5;

    const recent = stats.history.slice(-10);
    const avgIterations = recent.reduce((sum, h) => sum + (h.iteration || 1), 0) / recent.length;
    
    return Math.min(1, 1 / (avgIterations + 0.1));
  }

  calculateReuseRate(memoryStats) {
    const total = memoryStats.totalEpisodes || 0;
    const reuse = memoryStats.reuseCount || 0;
    const templateReuse = memoryStats.templateReuseCount || 0;

    if (total === 0) return 0;

    return Math.min(1, (reuse + templateReuse) / total);
  }

  calculateFailureRate(memoryStats) {
    const failed = memoryStats.failedReuse || 0;
    const total = memoryStats.reuseCount || 0;

    if (total === 0) return 0;

    return failed / total;
  }

  calculateSuccessRate(memoryStats) {
    const success = memoryStats.successReuse || 0;
    const total = memoryStats.reuseCount || 0;

    if (total === 0) return 0.5;

    return success / total;
  }

  calculateAdaptationSpeed(memoryStats) {
    const avgConfidence = memoryStats.avgConfidence || 0.5;
    return avgConfidence;
  }

  calculateResourceEfficiency(autonomyStats) {
    const used = autonomyStats.budgetUsed || 0;
    const total = autonomyStats.budgetUsed + autonomyStats.budgetRemaining || 1;
    
    return Math.min(1, 1 - (used / total));
  }

  getTrends() {
    if (this.metricsHistory.length < 2) return null;

    const recent = this.metricsHistory.slice(-5);
    const older = this.metricsHistory.slice(0, Math.min(5, this.metricsHistory.length - 5));

    const avgRecent = this.averageMetrics(recent);
    const avgOlder = this.averageMetrics(older);

    return {
      planningEfficiency: this.compareTrend(avgRecent.planningEfficiency, avgOlder.planningEfficiency),
      reuseRate: this.compareTrend(avgRecent.reuseRate, avgOlder.reuseRate),
      successRate: this.compareTrend(avgRecent.successRate, avgOlder.successRate),
      overallScore: this.compareTrend(avgRecent.overallScore, avgOlder.overallScore)
    };
  }

  averageMetrics(metrics) {
    if (metrics.length === 0) return {};
    
    return {
      planningEfficiency: metrics.reduce((s, m) => s + m.planningEfficiency, 0) / metrics.length,
      reuseRate: metrics.reduce((s, m) => s + m.reuseRate, 0) / metrics.length,
      successRate: metrics.reduce((s, m) => s + m.successRate, 0) / metrics.length,
      overallScore: metrics.reduce((s, m) => s + m.overallScore, 0) / metrics.length
    };
  }

  compareTrend(recent, older) {
    const diff = recent - older;
    if (diff > 0.1) return "improving";
    if (diff < -0.1) return "declining";
    return "stable";
  }

  getHistory(limit = 10) {
    return this.metricsHistory.slice(-limit);
  }

  reset() {
    this.metricsHistory = [];
  }
}

export class StrategyController {
  constructor(options = {}) {
    this.adjustmentRate = options.adjustmentRate || 0.05;
    this.minThreshold = options.minThreshold || 0.3;
    this.maxThreshold = options.maxThreshold || 0.9;
  }

  determineStrategyAdjustments(analysis, trends) {
    const adjustments = [];

    if (analysis.reuseRate < 0.4 && trends?.reuseRate === "declining") {
      adjustments.push({
        type: "increase_template_weight",
        reason: "reuse rate declining",
        amount: this.adjustmentRate
      });
    }

    if (analysis.failureRate > 0.3) {
      adjustments.push({
        type: "decrease_exploration",
        reason: "high failure rate",
        amount: this.adjustmentRate * 2
      });
    }

    if (analysis.planningEfficiency < 0.5) {
      adjustments.push({
        type: "optimize_planning",
        reason: "planning inefficient",
        amount: this.adjustmentRate
      });
    }

    if (analysis.adaptationSpeed < 0.4) {
      adjustments.push({
        type: "increase_learning_rate",
        reason: "adaptation too slow",
        amount: this.adjustmentRate
      });
    }

    if (analysis.resourceEfficiency < 0.3) {
      adjustments.push({
        type: "reduce_autonomy_budget",
        reason: "resource waste",
        amount: this.adjustmentRate
      });
    }

    if (analysis.successRate > 0.8 && analysis.reuseRate > 0.6) {
      adjustments.push({
        type: "increase_exploration",
        reason: "system performing well",
        amount: this.adjustmentRate
      });
    }

    return adjustments;
  }

  getDefaultStrategy() {
    return {
      templateWeight: 0.5,
      explorationRate: 0.3,
      learningRate: 0.5,
      autonomyBudget: 5,
      reuseThreshold: 0.7,
      decayRate: 0.03
    };
  }
}

export class DynamicParameterTuner {
  constructor(options = {}) {
    this.baseConfig = options.baseConfig || {
      reuseThreshold: { min: 0.5, max: 0.9, current: 0.7 },
      similarityWeight: { min: 0.3, max: 0.7, current: 0.5 },
      weightWeight: { min: 0.3, max: 0.7, current: 0.5 },
      decayRate: { min: 0.01, max: 0.1, current: 0.03 },
      autonomyBudget: { min: 3, max: 10, current: 5 }
    };
    this.tuningHistory = [];
  }

  adaptConfig(adjustments, currentConfig) {
    const newConfig = { ...currentConfig };

    for (const adj of adjustments) {
      switch (adj.type) {
        case "increase_template_weight":
          newConfig.similarityWeight = this.adjustParameter(
            newConfig.similarityWeight, -adj.amount
          );
          newConfig.weightWeight = this.adjustParameter(
            newConfig.weightWeight, adj.amount
          );
          break;

        case "decrease_exploration":
          newConfig.reuseThreshold = this.adjustParameter(
            newConfig.reuseThreshold, adj.amount
          );
          break;

        case "increase_learning_rate":
          newConfig.decayRate = this.adjustParameter(
            newConfig.decayRate, -adj.amount
          );
          break;

        case "reduce_autonomy_budget":
          newConfig.autonomyBudget = Math.max(
            this.baseConfig.autonomyBudget.min,
            newConfig.autonomyBudget - Math.floor(adj.amount * 10)
          );
          break;

        case "increase_exploration":
          newConfig.reuseThreshold = this.adjustParameter(
            newConfig.reuseThreshold, -adj.amount
          );
          break;
      }
    }

    this.tuningHistory.push({
      adjustments,
      oldConfig: currentConfig,
      newConfig,
      timestamp: Date.now()
    });

    return newConfig;
  }

  adjustParameter(param, delta) {
    if (typeof param === "object") {
      return Math.max(param.min, Math.min(param.max, param.current + delta));
    }
    return param;
  }

  getCurrentConfig() {
    const config = {};
    for (const [key, param] of Object.entries(this.baseConfig)) {
      config[key] = typeof param === "object" ? param.current : param;
    }
    return config;
  }

  getTuningHistory(limit = 10) {
    return this.tuningHistory.slice(-limit);
  }

  reset() {
    this.tuningHistory = [];
    for (const param of Object.values(this.baseConfig)) {
      if (typeof param === "object") {
        param.current = param.current;
      }
    }
  }
}

export class FailurePatternLearner {
  constructor(options = {}) {
    this.patterns = new Map();
    this.observationWindow = options.observationWindow || 50;
  }

  recordFailure(failure) {
    const key = this.extractPatternKey(failure);
    const current = this.patterns.get(key) || {
      count: 0,
      lastSeen: null,
      suggestions: []
    };

    current.count++;
    current.lastSeen = Date.now();
    current.suggestions = failure.suggestions || [];

    this.patterns.set(key, current);
    this.cleanup();
  }

  extractPatternKey(failure) {
    const goalType = failure.goalType || "unknown";
    const failureType = failure.failureType || "unknown";
    return `${goalType}:${failureType}`;
  }

  getFrequentPatterns(minCount = 3) {
    const frequent = [];
    for (const [key, pattern] of this.patterns) {
      if (pattern.count >= minCount) {
        frequent.push({
          pattern: key,
          count: pattern.count,
          suggestions: pattern.suggestions
        });
      }
    }
    return frequent.sort((a, b) => b.count - a.count);
  }

  getSuggestions(goalType) {
    const suggestions = [];
    
    for (const [key, pattern] of this.patterns) {
      if (key.startsWith(goalType + ":") && pattern.count > 0) {
        suggestions.push(...pattern.suggestions);
      }
    }

    return [...new Set(suggestions)];
  }

  cleanup() {
    if (this.patterns.size > this.observationWindow) {
      const sorted = Array.from(this.patterns.entries())
        .sort((a, b) => {
          if (!a[1].lastSeen) return 1;
          if (!b[1].lastSeen) return -1;
          return b[1].lastSeen - a[1].lastSeen;
        });

      const toRemove = sorted.slice(this.observationWindow);
      for (const [key] of toRemove) {
        this.patterns.delete(key);
      }
    }
  }

  getStats() {
    return {
      totalPatterns: this.patterns.size,
      patterns: Object.fromEntries(this.patterns)
    };
  }

  reset() {
    this.patterns.clear();
  }
}

export class MetaReasoningLayer {
  constructor(options = {}) {
    this.evaluator = new MetaEvaluator(options.evaluator || {});
    this.strategyController = new StrategyController(options.strategy || {});
    this.parameterTuner = new DynamicParameterTuner(options.tuner || {});
    this.failureLearner = new FailurePatternLearner(options.failureLearner || {});
    
    this.currentStrategy = this.strategyController.getDefaultStrategy();
    this.cycleCount = 0;
    this.improvementHistory = [];
    
    this.forbiddenTargets = new Set(["executor", "scheduler", "blackboard", "security", "auth"]);
    this.auditLog = [];
    this.maxAuditEntries = 1000;
  }

  async auditModification(mod) {
    if (mod.target && this.forbiddenTargets.has(mod.target)) {
      this.addAuditEntry({ modification: mod, result: "rejected", reason: "Forbidden target" });
      return { accepted: false, reason: "Forbidden modification target" };
    }
    
    if (mod.action === "delete" && mod.target === "skill") {
      this.addAuditEntry({ modification: mod, result: "rejected", reason: "Cannot delete skills" });
      return { accepted: false, reason: "Cannot delete skills directly" };
    }
    
    this.addAuditEntry({ modification: mod, result: "accepted", scoreDiff: 0 });
    return { accepted: true };
  }

  addAuditEntry(entry) {
    this.auditLog.push({ ...entry, timestamp: Date.now() });
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog.shift();
    }
  }

  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit);
  }

  analyzeAndImprove(coordinatorState) {
    const analysis = this.evaluator.analyzeSystemPerformance(coordinatorState);
    const trends = this.evaluator.getTrends();
    
    const adjustments = this.strategyController.determineStrategyAdjustments(
      analysis, 
      trends
    );

    const newConfig = this.parameterTuner.adaptConfig(
      adjustments,
      this.parameterTuner.getCurrentConfig()
    );

    this.cycleCount++;
    this.improvementHistory.push({
      cycle: this.cycleCount,
      analysis,
      adjustments,
      config: newConfig,
      timestamp: Date.now()
    });

    return {
      analysis,
      trends,
      adjustments,
      newConfig,
      recommendations: this.generateRecommendations(analysis, trends)
    };
  }

  generateRecommendations(analysis, trends) {
    const recommendations = [];

    if (analysis.overallScore < 0.5) {
      recommendations.push("System underperforming - consider reducing autonomy");
    }

    if (trends?.reuseRate === "declining") {
      recommendations.push("Template reuse declining - adjust similarity threshold");
    }

    if (analysis.failureRate > 0.3) {
      recommendations.push("High failure rate - increase validation strictness");
    }

    if (analysis.planningEfficiency < 0.5) {
      recommendations.push("Planning inefficient - reduce max iterations");
    }

    if (analysis.adaptationSpeed < 0.4) {
      recommendations.push("Learning too slow - increase learning rate");
    }

    if (recommendations.length === 0) {
      recommendations.push("System performing well - maintain current strategy");
    }

    return recommendations;
  }

  recordFailure(failure) {
    this.failureLearner.recordFailure(failure);
  }

  getFailureSuggestions(goalType) {
    return this.failureLearner.getSuggestions(goalType);
  }

  getStatus() {
    return {
      cycleCount: this.cycleCount,
      currentStrategy: this.currentStrategy,
      currentConfig: this.parameterTuner.getCurrentConfig(),
      evaluatorHistory: this.evaluator.getHistory(5),
      recentImprovements: this.improvementHistory.slice(-5)
    };
  }

  reset() {
    this.evaluator.reset();
    this.parameterTuner.reset();
    this.failureLearner.reset();
    this.cycleCount = 0;
    this.improvementHistory = [];
    this.currentStrategy = this.strategyController.getDefaultStrategy();
  }
}
