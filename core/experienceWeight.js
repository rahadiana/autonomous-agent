export function daysSince(timestamp) {
  if (!timestamp) return 0;
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

export function normalize(value, min = 0, max = 100) {
  return Math.min(1, Math.max(0, value / max));
}

export function computeEpisodeWeight(episode) {
  const recency = Math.exp(-0.05 * daysSince(episode.last_used_at));
  const usageNorm = normalize(episode.usage_count, 0, 50);
  const scoreWeight = episode.score * 0.5;
  const confidenceWeight = episode.confidence * 0.2;
  const usageWeight = usageNorm * 0.2;
  const recencyWeight = recency * 0.1;

  return scoreWeight + confidenceWeight + usageWeight + recencyWeight;
}

export function computeTemplateWeight(template) {
  const recency = Math.exp(-0.05 * daysSince(template.lastUsedAt));
  const usageNorm = normalize(template.usageCount, 0, 50);
  const scoreWeight = template.score * 0.5;
  const confidenceWeight = template.confidence * 0.2;
  const usageWeight = usageNorm * 0.2;
  const recencyWeight = recency * 0.1;

  return scoreWeight + confidenceWeight + usageWeight + recencyWeight;
}

export function computeFinalScore(similarity, weight, options = {}) {
  const {
    similarityWeight = 0.5,
    weightWeight = 0.5
  } = options;

  return similarity * similarityWeight + weight * weightWeight;
}

export function updateConfidence(item, success, options = {}) {
  const {
    successBonus = 0.05,
    failPenalty = 0.1,
    minConfidence = 0.1,
    maxConfidence = 1.0
  } = options;

  if (success) {
    item.confidence = Math.min(maxConfidence, item.confidence + successBonus);
  } else {
    item.confidence = Math.max(minConfidence, item.confidence - failPenalty);
  }

  return item.confidence;
}

export function applyDecay(item, options = {}) {
  const {
    decayRate = 0.03,
    minScore = 0.1
  } = options;

  const days = daysSince(item.last_used_at || item.lastUsedAt);
  const decay = Math.exp(-decayRate * days);

  item.score = Math.max(minScore, item.score * decay);

  return item.score;
}

export function shouldPrune(item, options = {}) {
  const {
    minScore = 0.4,
    minUsage = 3,
    minConfidence = 0.3
  } = options;

  const itemScore = item.score || 0;
  const itemUsage = item.usage_count || item.usageCount || 0;
  const itemConfidence = item.confidence || 0;

  return (
    itemScore < minScore &&
    itemUsage < minUsage &&
    itemConfidence < minConfidence
  );
}

export function pruneItem(item) {
  return {
    id: item.id,
    reason: "pruned",
    score: item.score,
    confidence: item.confidence,
    usage: item.usage_count || item.usageCount
  };
}

export class ExperienceWeightManager {
  constructor(options = {}) {
    this.decayRate = options.decayRate || 0.03;
    this.pruneThreshold = options.pruneThreshold || { minScore: 0.4, minUsage: 3, minConfidence: 0.3 };
    this.similarityWeight = options.similarityWeight || 0.5;
    this.weightWeight = options.weightWeight || 0.5;
    this.decayEnabled = options.decayEnabled !== false;
    this.pruneEnabled = options.pruneEnabled !== false;
    this.stats = { pruned: 0, decayed: 0, updated: 0 };
  }

  computeEpisodeScore(episode, similarity) {
    const weight = computeEpisodeWeight(episode);
    return computeFinalScore(similarity, weight, {
      similarityWeight: this.similarityWeight,
      weightWeight: this.weightWeight
    });
  }

  computeTemplateScore(template, similarity) {
    const weight = computeTemplateWeight(template);
    return computeFinalScore(similarity, weight, {
      similarityWeight: this.similarityWeight,
      weightWeight: this.weightWeight
    });
  }

  updateOnResult(item, success) {
    updateConfidence(item, success);
    this.stats.updated++;
    return item;
  }

  decay(item) {
    if (!this.decayEnabled) return item;
    applyDecay(item, { decayRate: this.decayRate });
    this.stats.decayed++;
    return item;
  }

  shouldPrune(item) {
    if (!this.pruneEnabled) return false;
    return shouldPrune(item, this.pruneThreshold);
  }

  prune(item) {
    const pruned = pruneItem(item);
    this.stats.pruned++;
    return pruned;
  }

  getStats() {
    return { ...this.stats };
  }

  resetStats() {
    this.stats = { pruned: 0, decayed: 0, updated: 0 };
  }
}
