import { createAgentCoordinator } from "../core/coordinator.js";

console.log("=== DEBUG EPISODIC MEMORY ===\n");

const coordinator = createAgentCoordinator({
  maxIterations: 1,
  learningEnabled: true
});

coordinator.registerSkill({
  name: "add",
  capability: "math.add",
  logic: [
    { op: "set", path: "output.result", value: "input.a + input.b" }
  ]
});

console.log("--- Processing Goal ---");
const r1 = await coordinator.processGoal("math.add", { a: 5, b: 3 });
console.log("\nFull result:", JSON.stringify(r1, null, 2));
console.log("\nMemory:", coordinator.getMemoryStats());
