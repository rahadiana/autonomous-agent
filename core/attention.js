export class AttentionController {
  constructor(options = {}) {
    this.focusWeight = options.focusWeight || 0.6;
    this.relevanceWeight = options.relevanceWeight || 0.3;
    this.recencyWeight = options.recencyWeight || 0.1;
    this.maxFocusItems = options.maxFocusItems || 5;
    this.relevanceThreshold = options.relevanceThreshold || 0.3;
  }

  calculateAttentionScores(agentType, blackboardState, currentTask) {
    const scores = {};

    for (const [zoneName, zoneData] of Object.entries(blackboardState)) {
      scores[zoneName] = this.calculateZoneScore(
        zoneName,
        zoneData,
        agentType,
        currentTask
      );
    }

    return scores;
  }

  calculateZoneScore(zoneName, zoneData, agentType, currentTask) {
    let focusScore = this.getFocusScore(zoneName, agentType);
    let relevanceScore = this.getRelevanceScore(zoneName, currentTask);
    let recencyScore = this.getRecencyScore(zoneData.version);

    return (
      focusScore * this.focusWeight +
      relevanceScore * this.relevanceWeight +
      recencyScore * this.recencyWeight
    );
  }

  getFocusScore(zoneName, agentType) {
    const focusMap = {
      planner: { goal: 1.0, context: 0.8, memory: 0.6, skills: 0.9 },
      executor: { execution: 1.0, plan: 0.9, context: 0.7, skills: 0.5 },
      reasoner: { result: 1.0, context: 0.9, execution: 0.7, plan: 0.6 }
    };

    return focusMap[agentType]?.[zoneName] || 0.3;
  }

  getRelevanceScore(zoneName, currentTask) {
    if (!currentTask) return 0.5;

    const taskKeywords = this.extractKeywords(currentTask);
    const zoneKeywords = this.getZoneKeywords(zoneName);

    let matches = 0;
    for (const keyword of taskKeywords) {
      if (zoneKeywords.includes(keyword)) matches++;
    }

    return matches / Math.max(taskKeywords.length, 1);
  }

  extractKeywords(task) {
    if (typeof task === "string") {
      return task.toLowerCase().split(/\s+/);
    }
    if (typeof task === "object" && task.goal) {
      return this.extractKeywords(task.goal);
    }
    return [];
  }

  getZoneKeywords(zoneName) {
    const keywordMap = {
      goal: ["goal", "target", "objective", "aim", "目的"],
      plan: ["plan", "action", "step", "sequence", "计划"],
      execution: ["execute", "run", "perform", "action", "执行"],
      result: ["result", "output", "outcome", "success", "结果"],
      context: ["context", "state", "environment", "上下文"],
      memory: ["memory", "history", "past", "记忆"],
      skills: ["skill", "capability", "tool", "能力"]
    };

    return keywordMap[zoneName] || [];
  }

  getRecencyScore(version) {
    return Math.min(version / 10, 1.0);
  }

  selectAttentionZones(agentType, blackboardState, currentTask, limit) {
    const scores = this.calculateAttentionScores(
      agentType,
      blackboardState,
      currentTask
    );

    const sorted = Object.entries(scores)
      .filter(([_, score]) => score >= this.relevanceThreshold)
      .sort((a, b) => b[1] - a[1]);

    return sorted.slice(0, limit || this.maxFocusItems).map(([zone]) => zone);
  }

  createAttentionMask(agentType, blackboardState, currentTask) {
    const selectedZones = this.selectAttentionZones(
      agentType,
      blackboardState,
      currentTask,
      this.maxFocusItems
    );

    return new Set(selectedZones);
  }

  adaptAttention(agentType, feedback) {
    if (feedback.success) {
      this.focusWeight = Math.min(1.0, this.focusWeight + 0.05);
    } else if (feedback.retry) {
      this.focusWeight = Math.max(0.3, this.focusWeight - 0.05);
    }

    if (feedback.relevance) {
      this.relevanceWeight = Math.min(0.5, this.relevanceWeight + 0.02);
    }
  }

  getAttentionConfig() {
    return {
      focusWeight: this.focusWeight,
      relevanceWeight: this.relevanceWeight,
      recencyWeight: this.recencyWeight,
      maxFocusItems: this.maxFocusItems,
      relevanceThreshold: this.relevanceThreshold
    };
  }

  setAttentionConfig(config) {
    if (config.focusWeight !== undefined) this.focusWeight = config.focusWeight;
    if (config.relevanceWeight !== undefined) this.relevanceWeight = config.relevanceWeight;
    if (config.recencyWeight !== undefined) this.recencyWeight = config.recencyWeight;
    if (config.maxFocusItems !== undefined) this.maxFocusItems = config.maxFocusItems;
    if (config.relevanceThreshold !== undefined) this.relevanceThreshold = config.relevanceThreshold;
  }
}
