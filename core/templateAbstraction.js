import { generateEmbedding, cosineSimilarity, VectorStore } from "./vectorStore.js";

export class PlanTemplate {
  constructor(config) {
    this.id = config.id || `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.pattern = config.pattern;
    this.slots = config.slots || [];
    this.plan = config.plan;
    this.usageCount = config.usageCount || 0;
    this.score = config.score || 0;
    this.confidence = config.confidence || 0.5;
    this.createdAt = config.createdAt || Date.now();
    this.lastUsedAt = config.lastUsedAt || Date.now();
    this.abstractionLevel = config.abstractionLevel || 1;
  }

  getWeight() {
    const usageBonus = Math.min(1 + (this.usageCount * 0.05), 2);
    const scoreBonus = this.score * 0.5;
    return (this.confidence * 0.5 + scoreBonus * 0.3 + 0.2) * usageBonus;
  }

  incrementUsage() {
    this.usageCount++;
    this.lastUsedAt = Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      pattern: this.pattern,
      slots: this.slots,
      plan: this.plan,
      usageCount: this.usageCount,
      score: this.score,
      confidence: this.confidence,
      abstractionLevel: this.abstractionLevel
    };
  }

  static fromJSON(json) {
    return new PlanTemplate(json);
  }
}

export function generalizeGoal(goal) {
  if (typeof goal !== "string") {
    goal = JSON.stringify(goal);
  }

  const patterns = [
    [/(\d+)/g, "<NUM>"],
    [/"([^"]+)"/g, "<VAL>"],
    [/\b(add|sum|plus|calculate)\b/i, "add_numbers"],
    [/\b(subtract|minus|minus)\b/i, "subtract_numbers"],
    [/\b(multiply|times|product)\b/i, "multiply_numbers"],
    [/\b(divide|quotient)\b/i, "divide_numbers"],
    [/\b(get|fetch|retrieve|load)\b/i, "fetch"],
    [/\b(create|make|new)\b/i, "create"],
    [/\b(update|edit|modify)\b/i, "update"],
    [/\b(delete|remove)\b/i, "delete"],
    [/\b(user|profile|account)\b/i, "entity"],
    [/\b(list|all|browse)\b/i, "list"],
    [/\b(search|find|query)\b/i, "search"]
  ];

  let generalized = goal.toLowerCase();

  for (const [regex, replacement] of patterns) {
    generalized = generalized.replace(regex, replacement);
  }

  generalized = generalized.replace(/\s+/g, " ").trim();

  return generalized;
}

export function extractVariables(goal) {
  const slots = [];
  const regex = /<(\w+)>/g;
  let match;

  while ((match = regex.exec(goal)) !== null) {
    slots.push(match[1]);
  }

  if (slots.length === 0) {
    const wordPattern = /\b(\w+)\b/g;
    let wordMatch;
    const seen = new Set();
    
    while ((wordMatch = wordPattern.exec(goal)) !== null) {
      const word = wordMatch[1].toLowerCase();
      if (word.length > 3 && !["with", "from", "that", "this", "then", "than", "user", "item"].includes(word)) {
        if (!seen.has(word)) {
          slots.push(word);
          seen.add(word);
        }
      }
    }
  }

  return slots;
}

export function mapGoalToSlots(goal, templateSlots) {
  const mapping = {};
  const goalWords = goal.toLowerCase().split(/\s+/);
  
  for (const slot of templateSlots) {
    const slotVariants = getSlotVariants(slot);
    
    for (const variant of slotVariants) {
      const idx = goalWords.indexOf(variant);
      if (idx !== -1) {
        mapping[slot] = goalWords[idx + 1] || goalWords[idx - 1] || "unknown";
        break;
      }
    }
    
    if (!mapping[slot]) {
      mapping[slot] = `var_${slot}`;
    }
  }

  return mapping;
}

function getSlotVariants(slot) {
  const variants = [slot];
  
  if (slot === "entity") {
    variants.push("user", "profile", "account", "item", "data");
  } else if (slot === "action") {
    variants.push("get", "create", "update", "delete", "fetch");
  } else if (slot === "operation") {
    variants.push("add", "subtract", "multiply", "divide");
  }
  
  return variants;
}

export function injectVariables(plan, variables) {
  if (!plan) return plan;
  
  if (typeof plan === "string") {
    let result = plan;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`<${key}>`, "g"), value);
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
      result = result.replace(new RegExp(`\\$\\{?${key}\\}?`, "g"), value);
    }
    return result;
  }

  if (Array.isArray(plan)) {
    return plan.map(p => injectVariables(p, variables));
  }

  if (typeof plan === "object" && plan !== null) {
    const result = {};
    for (const [key, value] of Object.entries(plan)) {
      result[key] = injectVariables(value, variables);
    }
    return result;
  }

  return plan;
}

export class TemplateStore {
  constructor(options = {}) {
    this.templates = new Map();
    this.vectorStore = new VectorStore(options.dimension || 128);
    this.maxTemplates = options.maxTemplates || 200;
    this.matchThreshold = options.matchThreshold || 0.5;
    this.minScore = options.minScore || 0.6;
  }

  async createTemplate(episode) {
    const pattern = generalizeGoal(episode.goal);
    const slots = extractVariables(episode.goal);
    
    const abstractionLevel = slots.length > 2 ? 2 : slots.length > 0 ? 1 : 0;

    const template = new PlanTemplate({
      pattern,
      slots,
      plan: this.simplifyPlan(episode.plan),
      score: episode.score,
      confidence: episode.score,
      abstractionLevel
    });

    const embedding = generateEmbedding(pattern);
    this.vectorStore.add(template.id, embedding, { pattern });
    this.templates.set(template.id, template);

    await this.cleanup();

    return template;
  }

  simplifyPlan(plan) {
    if (!plan) return null;
    if (!plan.bestPath) return plan;

    const simplified = {
      bestPath: plan.bestPath.map(action => ({
        capability: action.capability,
        skill: { capability: action.capability },
        params: action.params || {}
      })),
      steps: plan.bestPath.length,
      abstract: true
    };

    return simplified;
  }

  async findMatchingTemplate(goal) {
    const pattern = generalizeGoal(goal);
    const slots = extractVariables(goal);
    const embedding = generateEmbedding(pattern);

    const results = this.vectorStore.search(embedding, 5, this.matchThreshold);

    for (const r of results) {
      const template = this.templates.get(r.id);
      if (!template || template.score < this.minScore) continue;

      const slotMatch = this.checkSlotCompatibility(slots, template.slots);
      
      if (slotMatch) {
        template.incrementUsage();
        return {
          template,
          similarity: r.score,
          slotMatch
        };
      }
    }

    return null;
  }

  checkSlotCompatibility(goalSlots, templateSlots) {
    if (templateSlots.length === 0) return true;
    if (goalSlots.length === 0) return templateSlots.length <= 1;

    let matches = 0;
    for (const slot of goalSlots) {
      if (templateSlots.includes(slot)) {
        matches++;
      }
    }

    return matches >= Math.min(goalSlots.length, templateSlots.length) * 0.5;
  }

  instantiate(template, goal) {
    console.log("[TEMPLATE] template.plan type:", typeof template.plan, Array.isArray(template.plan));
    const variables = mapGoalToSlots(goal, template.slots);
    
    // template.plan can be either an array or an object with bestPath property
    const planArray = Array.isArray(template.plan) ? template.plan : (template.plan?.bestPath || []);
    
    const instantiatedPlan = {
      bestPath: planArray.map(action => ({
        capability: action.capability,
        params: injectVariables(action.params || {}, variables)
      })),
      abstract: false,
      instantiatedFrom: template.id
    };
    console.log("[TEMPLATE] instantiated plan:", JSON.stringify(instantiatedPlan).slice(0, 200));

    return instantiatedPlan;
  }

  async getTemplates(limit = 10) {
    return Array.from(this.templates.values())
      .sort((a, b) => b.getWeight() - a.getWeight())
      .slice(0, limit)
      .map(t => t.toJSON());
  }

  async cleanup() {
    if (this.templates.size <= this.maxTemplates) return;

    const sorted = Array.from(this.templates.values())
      .sort((a, b) => a.getWeight() - b.getWeight());

    const toRemove = sorted.slice(0, this.templates.size - this.maxTemplates);
    for (const tpl of toRemove) {
      this.templates.delete(tpl.id);
      this.vectorStore.remove(tpl.id);
    }
  }

  getStats() {
    return {
      total: this.templates.size,
      avgScore: this.getAverageScore(),
      totalUsage: this.getTotalUsage()
    };
  }

  getAverageScore() {
    if (this.templates.size === 0) return 0;
    const sum = Array.from(this.templates.values()).reduce((s, t) => s + t.score, 0);
    return sum / this.templates.size;
  }

  getTotalUsage() {
    return Array.from(this.templates.values()).reduce((s, t) => s + t.usageCount, 0);
  }
}
