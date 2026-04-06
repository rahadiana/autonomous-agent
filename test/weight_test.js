import { createAgentCoordinator } from "../core/coordinator.js";
import { computeEpisodeWeight, computeTemplateWeight, applyDecay } from "../core/experienceWeight.js";

console.log("=== EXPERIENCE WEIGHTING TEST ===\n");

const coordinator = createAgentCoordinator({
  maxIterations: 1,
  learningEnabled: true,
  similarityWeight: 0.5,
  weightWeight: 0.5
});

coordinator.registerSkill({
  name: "add",
  capability: "math.add",
  logic: [{ op: "set", path: "output.result", value: "input.a + input.b" }]
});

console.log("--- Goal 1: create new episode ---");
const r1 = await coordinator.processGoal("add 2 and 3", { a: 2, b: 3 });
console.log("  Result:", r1?.evaluation?.score, "reused:", r1?.reused);
console.log("  Memory:", coordinator.getMemoryStats());

console.log("\n--- Goal 2: reuse with weighting ---");
const r2 = await coordinator.processGoal("add 5 and 7", { a: 5, b: 7 });
console.log("  Result:", r2?.evaluation?.score, "reused:", r2?.reused);
console.log("  Memory:", coordinator.getMemoryStats());

console.log("\n--- Goal 3: another reuse ---");
const r3 = await coordinator.processGoal("add 10 and 20", { a: 10, b: 20 });
console.log("  Result:", r3?.evaluation?.score, "reused:", r3?.reused);
console.log("  Memory:", coordinator.getMemoryStats());

console.log("\n=== Weight Calculation Test ===");
const weight1 = computeEpisodeWeight({
  score: 0.9,
  confidence: 0.7,
  usage_count: 5,
  last_used_at: Date.now()
});
console.log("  Fresh high-quality weight:", weight1.toFixed(3));

const weight2 = computeEpisodeWeight({
  score: 0.3,
  confidence: 0.2,
  usage_count: 1,
  last_used_at: Date.now() - 7 * 24 * 60 * 60 * 1000
});
console.log("  Old low-quality weight:", weight2.toFixed(3));

console.log("\n=== DONE ===");
