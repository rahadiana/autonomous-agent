import { createAgentCoordinator } from "../core/coordinator.js";

console.log("=== SELF-IMPROVING SYSTEM TEST ===\n");

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

for (let i = 1; i <= 6; i++) {
  console.log(`\n--- Goal ${i}: add ${i}0 and ${i}0 ---`);
  const result = await coordinator.processGoal(`add ${i}0 and ${i}0`, { a: i * 10, b: i * 10 });
  console.log(`  Score: ${result?.evaluation?.score}, Reused: ${result?.reused}`);
}

console.log("\n--- Meta Analysis ---");
const state = coordinator.getState();
const improvement = coordinator.metaReasoning.analyzeAndImprove(state);

console.log("Overall Score:", improvement.analysis.overallScore.toFixed(3));
console.log("Trends:", improvement.trends);
console.log("Adjustments:", improvement.adjustments.length);
console.log("Recommendations:", improvement.recommendations);

console.log("\n--- Config Evolution ---");
const history = coordinator.metaReasoning.parameterTuner.getTuningHistory();
console.log("Tuning history:", history.length, "entries");

console.log("\n=== DONE ===");
