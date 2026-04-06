import test from "node:test";
import assert from "node:assert";
import { generateEmbedding, cosineSimilarity, VectorStore, createSkillEmbedding } from "../core/vectorStore.js";

test("generateEmbedding returns 128-dim vector", () => {
  const embedding = generateEmbedding("hello world");
  assert.strictEqual(embedding.length, 128);
});

test("generateEmbedding normalizes vector", () => {
  const embedding = generateEmbedding("test");
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  assert.ok(Math.abs(magnitude - 1) < 0.001, "Vector should be normalized");
});

test("generateEmbedding same text produces same embedding", () => {
  const e1 = generateEmbedding("hello world");
  const e2 = generateEmbedding("hello world");
  
  for (let i = 0; i < e1.length; i++) {
    assert.strictEqual(e1[i], e2[i]);
  }
});

test("generateEmbedding different texts produce different embeddings", () => {
  const e1 = generateEmbedding("hello");
  const e2 = generateEmbedding("world");
  
  let identical = true;
  for (let i = 0; i < e1.length; i++) {
    if (e1[i] !== e2[i]) {
      identical = false;
      break;
    }
  }
  assert.strictEqual(identical, false);
});

test("cosineSimilarity returns 1 for identical vectors", () => {
  const v = [1, 0, 0, 0];
  const similarity = cosineSimilarity(v, v);
  assert.strictEqual(similarity, 1);
});

test("cosineSimilarity returns 0 for orthogonal vectors", () => {
  const v1 = [1, 0, 0, 0];
  const v2 = [0, 1, 0, 0];
  const similarity = cosineSimilarity(v1, v2);
  assert.strictEqual(similarity, 0);
});

test("cosineSimilarity returns -1 for opposite vectors", () => {
  const v1 = [1, 0];
  const v2 = [-1, 0];
  const similarity = cosineSimilarity(v1, v2);
  assert.strictEqual(similarity, -1);
});

test("cosineSimilarity returns 0 for different length vectors", () => {
  const v1 = [1, 0, 0];
  const v2 = [1, 0];
  const similarity = cosineSimilarity(v1, v2);
  assert.strictEqual(similarity, 0);
});

test("VectorStore add and get", () => {
  const store = new VectorStore(4);
  store.add("id1", [1, 0, 0, 0], { name: "test" });
  
  const result = store.get("id1");
  assert.strictEqual(result.id, "id1");
  assert.strictEqual(result.metadata.name, "test");
});

test("VectorStore search returns top K results", () => {
  const store = new VectorStore(3);
  store.add("a", [1, 0, 0]);
  store.add("b", [0, 1, 0]);
  store.add("c", [0, 0, 1]);
  
  const results = store.search([1, 0, 0], 2, 0);
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].id, "a");
});

test("VectorStore search respects threshold", () => {
  const store = new VectorStore(3);
  store.add("a", [1, 0, 0]);
  store.add("b", [0.1, 0.1, 0.1]);
  
  const results = store.search([1, 0, 0], 5, 0.9);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, "a");
});

test("VectorStore remove deletes entry", () => {
  const store = new VectorStore(4);
  store.add("id1", [1, 0, 0, 0]);
  store.remove("id1");
  
  assert.strictEqual(store.get("id1"), undefined);
});

test("VectorStore size returns correct count", () => {
  const store = new VectorStore(4);
  store.add("a", [1, 0, 0, 0]);
  store.add("b", [0, 1, 0, 0]);
  
  assert.strictEqual(store.size(), 2);
});

test("VectorStore clear removes all entries", () => {
  const store = new VectorStore(4);
  store.add("a", [1, 0, 0, 0]);
  store.add("b", [0, 1, 0, 0]);
  store.clear();
  
  assert.strictEqual(store.size(), 0);
});

test("VectorStore throws on dimension mismatch", () => {
  const store = new VectorStore(4);
  
  assert.throws(
    () => store.add("id1", [1, 0, 0]),
    /Embedding dimension mismatch/
  );
});

test("createSkillEmbedding generates embedding from skill", () => {
  const skill = {
    name: "add_numbers",
    capability: "math.add",
    description: "Adds two numbers",
    input_schema: { type: "object" },
    output_schema: { type: "number" }
  };
  
  const embedding = createSkillEmbedding(skill);
  assert.strictEqual(embedding.length, 128);
});

test("createSkillEmbedding same skill produces same embedding", () => {
  const skill = {
    name: "test_skill",
    capability: "test.cap",
    description: "Test"
  };
  
  const e1 = createSkillEmbedding(skill);
  const e2 = createSkillEmbedding(skill);
  
  for (let i = 0; i < e1.length; i++) {
    assert.strictEqual(e1[i], e2[i]);
  }
});