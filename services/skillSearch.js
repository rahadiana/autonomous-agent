import { VectorStore, generateEmbedding, createSkillEmbedding, cosineSimilarity } from "../core/vectorStore.js";

export class SkillSearch {
  constructor() {
    this.vectorStore = new VectorStore();
    this.skillIndex = new Map();
  }

  indexSkill(skill) {
    const embedding = createSkillEmbedding(skill);
    const id = skill.id || skill.name;
    
    this.vectorStore.add(id, embedding, {
      name: skill.name,
      capability: skill.capability,
      skill: skill
    });
    
    this.skillIndex.set(id, skill);
    
    return id;
  }

  searchByText(query, topK = 5, threshold = 0.1) {
    const queryEmbedding = generateEmbedding(query);
    const results = this.vectorStore.search(queryEmbedding, topK, threshold);
    
    return results.map(r => ({
      skill: this.skillIndex.get(r.id),
      score: r.score
    }));
  }

  searchByCapability(capability, threshold = 0.3) {
    return this.searchByText(capability, 10, threshold)
      .filter(r => r.skill && r.skill.capability === capability);
  }

  findSimilar(skillId, topK = 5) {
    const skill = this.skillIndex.get(skillId);
    if (!skill) return [];

    const embedding = createSkillEmbedding(skill);
    const results = this.vectorStore.search(embedding, topK + 1, 0);

    return results
      .filter(r => r.id !== skillId)
      .slice(0, topK)
      .map(r => ({
        skill: this.skillIndex.get(r.id),
        score: r.score
      }));
  }

  getSkill(id) {
    return this.skillIndex.get(id);
  }

  hasSkill(id) {
    return this.skillIndex.has(id);
  }

  removeSkill(id) {
    this.vectorStore.remove(id);
    this.skillIndex.delete(id);
  }

  count() {
    return this.skillIndex.size;
  }

  clear() {
    this.vectorStore.clear();
    this.skillIndex.clear();
  }

  listAll() {
    return Array.from(this.skillIndex.values());
  }

  // FIX: Implement capability index retrieval
  // Returns skills sorted by score for a given capability
  retrieveByCapability(capability, options = {}) {
    const { topK = 5, minScore = 0 } = options;
    
    const allSkills = this.listAll();
    
    // Filter by capability
    let filtered = allSkills.filter(s => 
      s.capability && s.capability.includes(capability)
    );
    
    // Sort by score (descending)
    filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Filter by minimum score
    filtered = filtered.filter(s => (s.score || 0) >= minScore);
    
    // Return top K
    return filtered.slice(0, topK);
  }
}

export function createSkillSearch() {
  return new SkillSearch();
}