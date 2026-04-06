import { createAgentCoordinator } from "../core/coordinator.js";
import { EconomicScoring, MetaStability, SafeMode, DecisionLogger } from "../core/resilience.js";

console.log("=== RESILIENCE LAYER TEST ===\n");

console.log("--- Testing Economic Scoring ---");
const eco = new EconomicScoring();

const options = [
  { name: "Plan A (high quality)", quality: 0.9, cost: 0.8, speed: 0.3 },
  { name: "Plan B (balanced)", quality: 0.7, cost: 0.5, speed: 0.6 },
  { name: "Plan C (fast cheap)", quality: 0.5, cost: 0.2, speed: 0.9 }
];

const ranked = eco.compareOptions(options);
console.log("Ranked by economic score:");
ranked.forEach((r, i) => {
  console.log(`  ${i+1}. ${r.name}: ${r.raw.toFixed(3)} (viable: ${r.isViable})`);
});

console.log("\n--- Testing Meta Stability ---");
const meta = new MetaStability({ smoothingFactor: 0.8, maxChange: 0.1 });

let value = 0.5;
for (let i = 0; i < 5; i++) {
  const adjustment = (Math.random() - 0.5) * 0.2;
  value = meta.adjustParameter("testParam", adjustment, value);
  console.log(`  Step ${i+1}: adjustment=${adjustment.toFixed(3)}, new value=${value.toFixed(3)}`);
}

console.log("\nStability report:", meta.getStabilityReport());

console.log("\n--- Testing Safe Mode ---");
const safe = new SafeMode({ maxConsecutiveFailures: 3 });

safe.registerFallback({ name: "fallback_add", capability: "math.add" });

console.log("Initial status:", safe.getStatus());

safe.trigger("high_failure", { rate: 0.6 });
console.log("After trigger:", safe.getStatus());

const fallbackResult = safe.executeFallback("add 1 and 1", {});
console.log("Fallback result:", fallbackResult);

console.log("\n--- Testing Decision Logger ---");
const logger = new DecisionLogger();

logger.logDecision("planning_reuse", {
  reasons: { similarity: 0.82, weight: 0.74 },
  context: { goal: "add numbers", iteration: 1 }
});

logger.logDecision("planning_new", {
  reasons: { no_existing: true },
  context: { goal: "multiply values", iteration: 1 }
});

console.log("Why 'add':", logger.why("add"));
console.log("Why 'multiply':", logger.why("multiply"));

console.log("\n--- Testing Full Coordinator ---");
const coordinator = createAgentCoordinator({
  maxIterations: 1,
  learningEnabled: false,
  autonomyEnabled: false,
  metaReasoningEnabled: false
});

coordinator.registerSkill({
  name: "add",
  capability: "math.add",
  logic: [{ op: "set", path: "output.result", value: "input.a + input.b" }]
});

await coordinator.processGoal("add 10 and 20", { a: 10, b: 20 });

const state = coordinator.getState();
console.log("\nResilience Status:");
console.log("  Isolation:", state.resilience.isolation);
console.log("  Decisions:", state.resilience.decisions.total);
console.log("  Safe mode:", state.resilience.safeMode.isActive);

console.log("\n=== DONE ===");
