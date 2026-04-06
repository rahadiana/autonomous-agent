import { createAgentCoordinator } from "../core/coordinator.js";

console.log("=== META-REASONING LAYER TEST ===\n");

const coordinator = createAgentCoordinator({
  maxIterations: 1,
  learningEnabled: true,
  autonomyEnabled: false,
  metaReasoningEnabled: true
});

coordinator.registerSkill({
  name: "add",
  capability: "math.add",
  logic: [{ op: "set", path: "output.result", value: "input.a + input.b" }]
});

console.log("--- Goal 1: add 2 and 3 ---");
await coordinator.processGoal("add 2 and 3", { a: 2, b: 3 });

console.log("\n--- Goal 2: add 5 and 7 ---");
await coordinator.processGoal("add 5 and 7", { a: 5, b: 7 });

console.log("\n--- Goal 3: add 10 and 20 ---");
await coordinator.processGoal("add 10 and 20", { a: 10, b: 20 });

console.log("\n--- System State ---");
const state = coordinator.getState();

console.log("Meta cycle:", state.meta?.cycleCount);
console.log("Current config:", state.meta?.currentConfig);
console.log("Evaluator history:", state.meta?.evaluatorHistory?.length, "entries");

console.log("\n--- Running meta analysis ---");
const improvement = coordinator.metaReasoning.analyzeAndImprove(state);
console.log("Analysis:", JSON.stringify(improvement.analysis, null, 2));
console.log("Recommendations:", improvement.recommendations);

console.log("\n=== DONE ===");
