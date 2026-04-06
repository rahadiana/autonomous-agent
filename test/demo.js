import { createAgentCoordinator } from "../core/coordinator.js";

console.log("=== EPISODIC MEMORY INTEGRATION TEST ===\n");

const coordinator = createAgentCoordinator({
  maxIterations: 2,
  learningEnabled: true,
  reuseThreshold: 0.7
});

coordinator.registerSkill({
  name: "add",
  capability: "math.add",
  logic: [
    { op: "set", path: "memory.sum", value: "input.a + input.b" },
    { op: "set", path: "output.result", value: "memory.sum" }
  ]
});

console.log("--- Goal 1: math.add (no prior memory) ---");
const r1 = await coordinator.processGoal("math.add", { a: 5, b: 3 });
console.log("Result 1:", r1?.evaluation?.score, "reused:", r1?.reused);
console.log("Memory:", coordinator.getMemoryStats());

console.log("\n--- Goal 2: math.add (should reuse) ---");
const r2 = await coordinator.processGoal("math.add", { a: 10, b: 7 });
console.log("Result 2:", r2?.evaluation?.score, "reused:", r2?.reused);
console.log("Memory:", coordinator.getMemoryStats());

console.log("\n--- Goal 3: different goal ---");
coordinator.registerSkill({
  name: "multiply",
  capability: "math.multiply",
  logic: [
    { op: "set", path: "memory.product", value: "input.a * input.b" },
    { op: "set", path: "output.result", value: "memory.product" }
  ]
});

const r3 = await coordinator.processGoal("math.multiply", { a: 4, b: 2 });
console.log("Result 3:", r3?.evaluation?.score, "reused:", r3?.reused);
console.log("Memory:", coordinator.getMemoryStats());

console.log("\n=== DONE ===");
