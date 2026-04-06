import test from "node:test";
import assert from "node:assert";
import { Reasoner, createCritic } from "../core/reasoner.js";

test("Reasoner evaluate returns score for valid plan", () => {
  const reasoner = new Reasoner();
  const plan = { status: "success", bestPath: [{ capability: "test" }] };
  
  const result = reasoner.evaluate(plan);
  
  assert.ok(typeof result.score === "number");
  assert.ok(result.score >= 0);
  assert.ok(typeof result.confidence === "number");
  assert.ok(Array.isArray(result.reasons));
});

test("Reasoner evaluate handles timeout status", () => {
  const reasoner = new Reasoner();
  const plan = { status: "timeout" };
  
  const result = reasoner.evaluate(plan);
  
  assert.strictEqual(result.status, undefined);
  assert.ok(result.reasons.includes("Search timed out"));
  assert.ok(result.suggestions.length > 0);
});

test("Reasoner evaluate handles limit_exceeded status", () => {
  const reasoner = new Reasoner();
  const plan = { status: "limit_exceeded", nodesExplored: 1000 };
  
  const result = reasoner.evaluate(plan);
  
  assert.ok(result.reasons.includes("Node limit exceeded"));
});

test("Reasoner evaluate handles no_solution status", () => {
  const reasoner = new Reasoner();
  const plan = { status: "no_solution" };
  
  const result = reasoner.evaluate(plan);
  
  assert.strictEqual(result.score, 0);
  assert.ok(result.reasons.includes("No solution found"));
});

test("Reasoner evaluate handles invalid plan", () => {
  const reasoner = new Reasoner();
  
  const result1 = reasoner.evaluate(null);
  assert.strictEqual(result1.confidence, 0);
  
  const result2 = reasoner.evaluate({});
  assert.strictEqual(result2.confidence, 0);
});

test("Reasoner evaluate applies constraints", () => {
  const reasoner = new Reasoner();
  const plan = { 
    status: "success", 
    bestPath: [{ capability: "test" }, { capability: "test2" }, { capability: "test3" }]
  };
  const context = { constraints: { maxSteps: 2 } };
  
  const result = reasoner.evaluate(plan, context);
  
  assert.ok(result.suggestions.includes("Plan exceeds max steps constraint"));
});

test("Reasoner critique identifies issues", () => {
  const reasoner = new Reasoner();
  const plan = { 
    status: "success", 
    bestPath: [{ capability: "test" }, { capability: "test" }, { capability: "test" }]
  };
  
  const result = reasoner.critique(plan);
  
  assert.ok(result.issues.length > 0);
  assert.ok(result.issues.includes("Plan uses only one action type - may be suboptimal"));
});

test("Reasoner critique identifies strengths for diverse actions", () => {
  const reasoner = new Reasoner();
  const plan = { 
    status: "success", 
    bestPath: [
      { capability: "add" }, 
      { capability: "multiply" }, 
      { capability: "divide" }
    ]
  };
  
  const result = reasoner.critique(plan);
  
  assert.ok(result.strengths.some(s => s.includes("Diverse")));
});

test("Reasoner critique handles long plans", () => {
  const reasoner = new Reasoner();
  const plan = { 
    status: "success", 
    bestPath: new Array(25).fill({ capability: "test" })
  };
  
  const result = reasoner.critique(plan);
  
  assert.ok(result.issues.includes("Plan is very long - may be inefficient"));
  assert.ok(result.improvements.includes("Consider decomposing into subtasks"));
});

test("Reasoner critique handles short plans", () => {
  const reasoner = new Reasoner();
  const plan = { 
    status: "success", 
    bestPath: [{ capability: "test" }]
  };
  
  const result = reasoner.critique(plan);
  
  assert.ok(result.strengths.includes("Concise plan"));
});

test("Reasoner critique considers history", () => {
  const reasoner = new Reasoner();
  const plan = { 
    status: "success", 
    goal: "test_goal",
    bestPath: [{ capability: "test" }]
  };
  const history = [
    { goal: "test_goal", evaluation: { score: 0.9 } },
    { goal: "test_goal", evaluation: { score: 0.85 } }
  ];
  
  const result = reasoner.critique(plan, history);
  
  assert.ok(result.strengths.some(s => s.includes("Consistent")));
});

test("Reasoner reflect on successful execution", () => {
  const reasoner = new Reasoner();
  const plan = { bestPath: [{ capability: "test" }] };
  const result = { success: true };
  
  const reflection = reasoner.reflect(plan, result);
  
  assert.ok(reflection.learned.includes("Execution successful - strategy validated"));
  assert.strictEqual(reflection.adapted, false);
});

test("Reasoner reflect on failed execution", () => {
  const reasoner = new Reasoner();
  const plan = { bestPath: [{ capability: "test" }] };
  const result = { success: false, error: "Test error" };
  
  const reflection = reasoner.reflect(plan, result);
  
  assert.ok(reflection.learned.includes("Execution failed - strategy invalidated"));
  assert.strictEqual(reflection.adapted, true);
  assert.ok(reflection.recommendations.length > 0);
});

test("Reasoner reflect considers execution time", () => {
  const reasoner = new Reasoner();
  const plan = { bestPath: [] };
  const result = { success: true, time: 6000 };
  
  const reflection = reasoner.reflect(plan, result);
  
  assert.ok(reflection.learned.some(l => l.includes("took longer")));
});

test("Reasoner selectBest chooses highest score", () => {
  const reasoner = new Reasoner();
  const plans = [
    { status: "no_solution" },
    { status: "timeout" },
    { status: "success", bestPath: [{ capability: "test" }] }
  ];
  
  const best = reasoner.selectBest(plans);
  
  assert.strictEqual(best.status, "success");
});

test("Reasoner selectBest handles empty array", () => {
  const reasoner = new Reasoner();
  
  const best = reasoner.selectBest([]);
  assert.strictEqual(best, null);
  
  const bestNull = reasoner.selectBest(null);
  assert.strictEqual(bestNull, null);
});

test("createCritic returns review and suggest functions", () => {
  const critic = createCritic();
  
  assert.ok(typeof critic.review === "function");
  assert.ok(typeof critic.suggest === "function");
});

test("createCritic review works", async () => {
  const critic = createCritic();
  const plan = { status: "success", bestPath: [] };
  
  const result = await critic.review(plan, {});
  
  assert.ok(typeof result.score === "number");
});

test("createCritic suggest works", async () => {
  const critic = createCritic();
  const plan = { status: "success", bestPath: [] };
  
  const result = await critic.suggest(plan, []);
  
  assert.ok(Array.isArray(result.issues));
  assert.ok(Array.isArray(result.strengths));
  assert.ok(Array.isArray(result.suggestions));
});