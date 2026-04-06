import { generateEmbedding, cosineSimilarity, VectorStore } from "./vectorStore.js";
import { TemplateStore, generalizeGoal, extractVariables, injectVariables } from "./templateAbstraction.js";
import { 
  ExperienceWeightManager,
  computeEpisodeWeight, 
  computeTemplateWeight,
  computeFinalScore,
  updateConfidence,
  applyDecay,
  shouldPrune
} from "./experienceWeight.js";

export class Episode {
  constructor(config) {
    this.id = config.id || `ep_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.goal = config.goal;
    this.plan = config.plan;
    this.result = config.result;
    this.score = config.score || 0;
    this.embedding = config.embedding || null;
    this.created_at = config.created_at || Date.now();
    this.last_used_at = config.last_used_at || Date.now();
    this.usage_count = config.usage_count || 0;
    this.confidence = config.confidence || 0.5;
    this.decay_rate = config.decay_rate || 0.95;
    this.adaptation = config.adaptation || null;
    this.templateId = config.templateId || null;
  }

  getWeight() {
    return computeEpisodeWeight(this);
  }

  getCompressed() {
    return {
      goal: this.goal,
      plan: this.plan,
      score: this.score,
      created_at: this.created_at
    };
  }

  toJSON() {
    return {
      id: this.id,
      goal: this.goal,
      plan: this.plan,
      result: this.result,
      score: this.score,
      embedding: this.embedding,
      created_at: this.created_at,
      last_used_at: this.last_used_at,
      usage_count: this.usage_count,
      confidence: this.confidence,
      adaptation: this.adaptation,
      templateId: this.templateId
    };
  }

  static fromJSON(json) {
    return new Episode(json);
  }
}

export class EpisodicMemory {
  constructor(options = {}) {
    this.store = new VectorStore(options.dimension || 128);
    this.episodes = new Map();
    this.maxEpisodes = options.maxEpisodes || 1000;
    this.minScoreThreshold = options.minScoreThreshold || 0.3;
    this.reuseThreshold = options.reuseThreshold || 0.7;
    this.maxAge = options.maxAge || 7 * 24 * 60 * 60 * 1000;
    this.enableTemplates = options.enableTemplates !== false;
    
    this.weightManager = new ExperienceWeightManager({
      decayRate: options.decayRate || 0.03,
      pruneThreshold: options.pruneThreshold || { minScore: 0.4, minUsage: 3, minConfidence: 0.3 },
      similarityWeight: options.similarityWeight || 0.5,
      weightWeight: options.weightWeight || 0.5,
      decayEnabled: options.decayEnabled !== false,
      pruneEnabled: options.pruneEnabled !== false
    });

    this.templateStore = new TemplateStore({
      maxTemplates: options.maxTemplates || 200,
      matchThreshold: options.templateMatchThreshold || 0.5,
      minScore: options.templateMinScore || 0.6
    });

    this.stats = {
      totalEpisodes: 0,
      totalTemplates: 0,
      reuseCount: 0,
      templateReuseCount: 0,
      successReuse: 0,
      failedReuse: 0,
      pruned: 0,
      decayed: 0
    };
  }

  async createEpisode(goal, plan, result) {
    const embedding = generateEmbedding(JSON.stringify(goal));
    const score = this.calculateScore(plan, result);

    const episode = new Episode({
      goal,
      plan,
      result,
      score,
      embedding
    });

    this.episodes.set(episode.id, episode);
    this.store.add(episode.id, embedding, { score, goal });

    this.stats.totalEpisodes++;

    if (this.enableTemplates && score >= 0.7) {
      const template = await this.templateStore.createTemplate(episode);
      episode.templateId = template.id;
      this.stats.totalTemplates++;
    }

    await this.cleanup();

    return episode;
  }

  calculateScore(plan, result) {
    let score = 0;

    if (result?.success) {
      score += 0.5;
    }

    if (result?.results && Array.isArray(result.results)) {
      const successRate = result.results.filter(r => r.success).length / result.results.length;
      score += successRate * 0.3;
    }

    if (plan?.bestPath && plan.bestPath.length > 0) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  async findRelevantEpisodes(goal, topK = 5) {
    const embedding = generateEmbedding(JSON.stringify(goal));
    const results = this.store.search(embedding, topK, this.minScoreThreshold);

    const episodes = [];
    for (const r of results) {
      const episode = this.episodes.get(r.id);
      if (episode && !this.isExpired(episode)) {
        const weight = computeEpisodeWeight(episode);
        const finalScore = this.weightManager.computeEpisodeScore(episode, r.score);
        
        episodes.push({
          episode,
          similarity: r.score,
          weight,
          finalScore
        });
      }
    }

    episodes.sort((a, b) => b.finalScore - a.finalScore);
    return episodes;
  }

  async findReusablePlan(goal) {
    const relevant = await this.findRelevantEpisodes(goal, 3);

    if (relevant.length > 0) {
      const best = relevant[0];

      if (best.finalScore >= this.reuseThreshold * 0.8 && best.episode.score >= 0.5) {
        this.stats.reuseCount++;
        best.episode.last_used_at = Date.now();
        best.episode.usage_count++;

        return {
          plan: best.episode.plan,
          episode: best.episode,
          similarity: best.similarity,
          weight: best.weight,
          finalScore: best.finalScore,
          reused: true,
          type: "episode"
        };
      }
    }

    if (this.enableTemplates) {
      const templateResult = await this.templateStore.findMatchingTemplate(goal);
      
      if (templateResult) {
        const template = templateResult.template;
        const weight = computeTemplateWeight(template);
        const finalScore = this.weightManager.computeTemplateScore(template, templateResult.similarity);
        
        if (finalScore >= 0.5) {
          this.stats.templateReuseCount++;
          
          const instantiatedPlan = this.templateStore.instantiate(
            template,
            goal
          );

          return {
            plan: instantiatedPlan,
            template: template,
            similarity: templateResult.similarity,
            weight,
            finalScore,
            reused: true,
            type: "template"
          };
        }
      }
    }

    return null;
  }

  async recordReuseResult(result, success) {
    if (result?.episode) {
      updateConfidence(result.episode, success);
      result.episode.last_used_at = Date.now();
      
      if (success) {
        this.stats.successReuse++;
      } else {
        this.stats.failedReuse++;
      }
    }

    if (result?.template) {
      updateConfidence(result.template, success);
      result.template.lastUsedAt = Date.now();
      
      if (success) {
        this.stats.successReuse++;
      } else {
        this.stats.failedReuse++;
      }
    }
  }

  async applyDecay() {
    for (const episode of this.episodes.values()) {
      applyDecay(episode, { decayRate: this.weightManager.decayRate });
      this.stats.decayed++;
    }
  }

  async cleanup() {
    if (this.episodes.size <= this.maxEpisodes) return;

    const sorted = Array.from(this.episodes.values())
      .sort((a, b) => a.getWeight() - b.getWeight());

    const toRemove = sorted.slice(0, this.episodes.size - this.maxEpisodes);
    for (const ep of toRemove) {
      this.episodes.delete(ep.id);
      this.store.remove(ep.id);
    }
  }

  async pruneLowQuality() {
    const toPrune = [];
    
    for (const episode of this.episodes.values()) {
      if (shouldPrune(episode, this.weightManager.pruneThreshold)) {
        toPrune.push(episode.id);
        this.stats.pruned++;
      }
    }

    for (const id of toPrune) {
      const episode = this.episodes.get(id);
      this.episodes.delete(id);
      this.store.remove(id);
    }

    return toPrune;
  }

  isExpired(episode) {
    return (Date.now() - episode.created_at) > this.maxAge;
  }

  getStats() {
    return {
      ...this.stats,
      stored: this.episodes.size,
      templates: this.templateStore.getStats(),
      avgConfidence: this.getAverageConfidence(),
      weightStats: this.weightManager.getStats()
    };
  }

  getAverageConfidence() {
    if (this.episodes.size === 0) return 0;
    const sum = Array.from(this.episodes.values()).reduce((s, e) => s + e.confidence, 0);
    return sum / this.episodes.size;
  }

  async saveEpisode(goal, plan, result) {
    const score = this.calculateScore(plan, result);

    if (score < 0.5) return null;

    return this.createEpisode(goal, plan, result);
  }

  getRecentEpisodes(limit = 10) {
    return Array.from(this.episodes.values())
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit)
      .map(e => e.toJSON());
  }

  async getTemplates(limit = 10) {
    return this.templateStore.getTemplates(limit);
  }

  clear() {
    this.episodes.clear();
    this.store.clear();
    this.stats = {
      totalEpisodes: 0,
      totalTemplates: 0,
      reuseCount: 0,
      templateReuseCount: 0,
      successReuse: 0,
      failedReuse: 0,
      pruned: 0,
      decayed: 0
    };
  }
}

export function extractPlanTemplate(plan) {
  if (!plan?.bestPath || plan.bestPath.length === 0) return null;

  const template = {
    actionSequence: plan.bestPath.map(a => a.capability),
    stepCount: plan.bestPath.length,
    abstract: true
  };

  return template;
}

export function matchTemplate(template, goal) {
  if (!template?.actionSequence) return 0;

  const goalText = JSON.stringify(goal).toLowerCase();
  let matches = 0;

  for (const action of template.actionSequence) {
    if (goalText.includes(action.split(".")[0])) {
      matches++;
    }
  }

  return matches / template.actionSequence.length;
}

/**
 * Adapt a plan to new input by overriding parameters
 * Used when reusing plans with different inputs
 * 
 * @param {Object} plan - Original plan with bestPath
 * @param {Object} newInput - New input parameters to override
 * @returns {Object} Adapted plan
 */
export function adaptPlan(plan, newInput) {
  if (!plan?.bestPath) return plan;
  
  const adaptedSteps = plan.bestPath.map(step => {
    // Clone the step
    const adaptedStep = { ...step };
    
    // If step has input, merge with newInput
    if (step.input) {
      adaptedStep.input = { ...step.input, ...newInput };
    }
    
    return adaptedStep;
  });
  
  return {
    ...plan,
    bestPath: adaptedSteps,
    adapted: true,
    originalInput: plan.input
  };
}

/**
 * Extract context from episode for matching
 * Stores input/output schema for better reuse matching
 * 
 * @param {Object} episode - Episode to extract context from
 * @returns {Object} Context with schema info
 */
export function extractEpisodeContext(episode) {
  return {
    inputSchema: extractSchema(episode.plan?.bestPath?.[0]?.input),
    outputSchema: extractSchema(episode.result),
    capability: episode.plan?.bestPath?.[0]?.capability
  };
}

function extractSchema(obj) {
  if (!obj) return null;
  
  const schema = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    schema[key] = {
      type: typeof val,
      value: val !== null ? val : "null"
    };
  }
  return schema;
}
