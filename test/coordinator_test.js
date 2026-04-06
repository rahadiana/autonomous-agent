import { createAgentCoordinator } from "../core/coordinator.js";

console.log("=== COORDINATOR WITH EPISODIC MEMORY ===\n");

const coordinator = createAgentCoordinator({
  maxIterations: 1,
  learningEnabled: true,
  reuseThreshold: 0.7
});

coordinator.registerSkill({
  name: "test_skill",
  capability: "test.do",
  logic: [{ op: "set", path: "output.done", value: true }]
});

console.log("1. Coordinator initialized");
console.log("2. Memory stats:", coordinator.getMemoryStats());
console.log("3. Testing goal processing...");

const result = await coordinator.processGoal("test.do", {});

console.log("\n4. Result:", result ? "got result" : "none");
console.log("5. Memory stats:", coordinator.getMemoryStats());

console.log("\n=== DONE ===");
