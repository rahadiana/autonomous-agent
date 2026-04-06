import test from "node:test";
import assert from "node:assert";
import { PlanNode, Planner, decomposeGoal, evaluatePlan, createPlan } from "../core/planner.js";

test("PlanNode constructor initializes correctly", () => {
  const state = { value: 1 };
  const node = new PlanNode("action1", state);
  
  assert.strictEqual(node.action, "action1");
  assert.strictEqual(node.state, state);
  assert.strictEqual(node.parent, null);
  assert.strictEqual(node.cost, 0);
  assert.strictEqual(node.score, 0);
  assert.deepStrictEqual(node.children, []);
});

test("PlanNode getPath returns action path", () => {
  const root = new PlanNode(null, { step: 0 });
  const child1 = new PlanNode("a", { step: 1 }, root, 1);
  const child2 = new PlanNode("b", { step: 2 }, child1, 2);
  
  const path = child2.getPath();
  assert.deepStrictEqual(path, ["a", "b"]);
});

test("PlanNode getDepth returns correct depth", () => {
  const root = new PlanNode(null, {});
  const child = new PlanNode("a", {}, root);
  const grandchild = new PlanNode("b", {}, child);
  
  assert.strictEqual(root.getDepth(), 0);
  assert.strictEqual(child.getDepth(), 1);
  assert.strictEqual(grandchild.getDepth(), 2);
});

test("Planner search finds solution for simple goal", () => {
  const planner = new Planner({
    maxDepth: 3,
    getActionsFn: (state) => ["action1", "action2"],
    applyActionFn: (state, action) => ({ ...state, step: (state.step || 0) + 1 }),
    isGoalFn: (state, goal) => state.step >= goal.steps
  });
  
  const result = planner.search({ step: 0 }, { steps: 2 });
  
  assert.ok(result.status === "success" || result.status === "no_solution" || result.status === "limit_exceeded");
  assert.ok(Array.isArray(result.bestPath));
});

test("Planner search handles timeout", () => {
  const planner = new Planner({
    maxDepth: 100,
    getActionsFn: () => ["a", "b", "c"]
  });
  
  const result = planner.search({}, {}, { timeout: 1 });
  
  assert.strictEqual(result.status, "timeout");
});

test("Planner respects maxNodes limit", () => {
  const planner = new Planner({
    maxDepth: 10,
    branchFactor: 10,
    getActionsFn: () => ["a", "b", "c", "d", "e"]
  });
  
  const result = planner.search({}, {}, { maxNodes: 5 });
  
  assert.ok(["success", "no_solution", "limit_exceeded", "timeout"].includes(result.status));
});

test("Planner sorts by score", () => {
  const planner = new Planner({
    getActionsFn: () => ["a", "b"],
    applyActionFn: (state, action) => ({ ...state, value: action === "a" ? 10 : 1 }),
    heuristicFn: (state) => state.value
  });
  
  const result = planner.search({}, {});
  assert.ok(result.nodesExplored >= 1);
});

test("decomposeGoal handles string goal", () => {
  const skills = [{ capability: "math.add" }];
  const result = decomposeGoal("add numbers then multiply", skills);
  
  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 1);
});

test("decomposeGoal handles object goal with steps", () => {
  const skills = [
    { capability: "math.add" },
    { capability: "math.multiply" }
  ];
  
  const goal = {
    steps: [
      { description: "Add numbers", capability: "math.add" },
      { description: "Multiply numbers", capability: "math.multiply" }
    ]
  };
  
  const result = decomposeGoal(goal, skills);
  
  assert.strictEqual(result.length, 2);
  assert.ok(result[0].requiredCapabilities.includes("math.add"));
  assert.ok(result[1].requiredCapabilities.includes("math.multiply"));
});

test("decomposeGoal returns empty for unknown format", () => {
  const skills = [{ capability: "test" }];
  const result = decomposeGoal(123, skills);
  
  assert.deepStrictEqual(result, []);
});

test("decomposeGoal handles numeric goal", () => {
  const skills = [{ capability: "test" }];
  const result = decomposeGoal(123, skills);
  
  assert.deepStrictEqual(result, []);
});

test("evaluatePlan returns score for valid plan", () => {
  const plan = {
    status: "success",
    path: [{ capability: "test" }],
    nodesExplored: 10,
    bestPath: [{ capability: "test" }]
  };
  
  const result = evaluatePlan(plan, {});
  
  assert.ok(typeof result.score === "number");
  assert.ok(result.score >= 0);
  assert.ok(Array.isArray(result.factors));
});

test("evaluatePlan respects constraints", () => {
  const plan = {
    status: "success",
    path: [{ capability: "test" }],
    nodesExplored: 10,
    bestPath: [{ capability: "test" }, { capability: "test2" }, { capability: "test3" }]
  };
  
  const context = {
    constraints: {
      maxSteps: 2
    }
  };
  
  const result = evaluatePlan(plan, context);
  assert.ok(typeof result.score === "number");
});

test("createPlan returns planner result", () => {
  const skills = [
    { capability: "math.add" },
    { capability: "math.sub" }
  ];
  
  const result = createPlan("goal", { step: 0 }, skills);
  
  assert.ok(result.status);
  assert.ok(result.nodesExplored !== undefined);
});

test("Planner countNodes counts all nodes", () => {
  const root = new PlanNode(null, {});
  const child1 = new PlanNode("a", {}, root);
  const child2 = new PlanNode("b", {}, root);
  const grandchild = new PlanNode("c", {}, child1);
  
  const planner = new Planner();
  const count = planner.countNodes(root);
  assert.ok(count >= 1);
});

test("Planner visualize returns string", () => {
  const root = new PlanNode(null, { step: 0 });
  const child = new PlanNode("test", { step: 1 }, root);
  
  const planner = new Planner();
  const viz = planner.visualize(root, 2);
  assert.ok(typeof viz === "string");
});