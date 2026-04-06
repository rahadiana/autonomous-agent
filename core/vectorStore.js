export function generateEmbedding(text) {
  const words = text.toLowerCase().split(/\s+/);
  const vector = new Array(128).fill(0);
  
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash = hash & hash;
    }
    const idx = Math.abs(hash) % 128;
    vector[idx] += 1 / (words.length || 1);
  }

  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

export function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

export class VectorStore {
  constructor(dimension = 128) {
    this.dimension = dimension;
    this.vectors = [];
  }

  add(id, embedding, metadata = {}) {
    if (embedding.length !== this.dimension) {
      throw new Error(`Embedding dimension mismatch: expected ${this.dimension}, got ${embedding.length}`);
    }

    this.vectors.push({
      id,
      embedding,
      metadata
    });
  }

  search(queryEmbedding, topK = 5, threshold = 0.1) {
    const similarities = this.vectors.map(entry => ({
      id: entry.id,
      score: cosineSimilarity(queryEmbedding, entry.embedding),
      metadata: entry.metadata
    }));

    similarities.sort((a, b) => b.score - a.score);

    return similarities
      .filter(s => s.score >= threshold)
      .slice(0, topK);
  }

  get(id) {
    return this.vectors.find(v => v.id === id);
  }

  remove(id) {
    this.vectors = this.vectors.filter(v => v.id !== id);
  }

  size() {
    return this.vectors.length;
  }

  clear() {
    this.vectors = [];
  }
}

export function createSkillEmbedding(skill) {
  const text = [
    skill.name || "",
    skill.capability || "",
    skill.description || "",
    JSON.stringify(skill.input_schema || {}),
    JSON.stringify(skill.output_schema || {})
  ].join(" ");

  return generateEmbedding(text);
}