import { createAgentCoordinator } from "../core/coordinator.js";

console.log("=== PRODUCTION HARDENING TEST ===\n");

const coordinator = createAgentCoordinator({
  maxIterations: 1,
  learningEnabled: false,
  autonomyEnabled: false,
  metaReasoningEnabled: false,
  maxLatency: 10000,
  maxApiCalls: 50,
  maxCost: 5,
  maxWorkers: 3
});

coordinator.registerSkill({
  name: "add",
  capability: "math.add",
  logic: [{ op: "set", path: "output.result", value: "input.a + input.b" }]
});

console.log("--- Running 3 goals ---");
for (let i = 1; i <= 3; i++) {
  console.log(`\nGoal ${i}:`);
  const result = await coordinator.processGoal(`add ${i}0 and ${i}0`, { a: i * 10, b: i * 10 });
  console.log(`  Result: success=${result?.execution?.success}, score=${result?.evaluation?.score}`);
}

console.log("\n--- Production Metrics ---");
const state = coordinator.getState();

console.log("Cost Tracker:");
console.log(`  Total latency: ${state.production.cost.totalLatency}ms`);
console.log(`  Operations: ${state.production.cost.operationsCount}`);
console.log(`  Avg latency: ${state.production.cost.avgLatency}ms`);

console.log("\nBudget Usage:");
console.log(`  Cost: ${state.production.budget.cost.toFixed(1)} (${(state.production.budget.utilization.cost * 100).toFixed(0)}%)`);
console.log(`  Latency: ${state.production.budget.latency.toFixed(0)}ms (${(state.production.budget.utilization.latency * 100).toFixed(0)}%)`);

console.log("\nWorker Pool:");
const workerStats = state.production.workers;
console.log(`  Total: ${workerStats.workers}, Busy: ${workerStats.busyWorkers}, Queued: ${workerStats.queuedTasks}`);

console.log("\nObservability:");
console.log(`  Traces: ${state.production.observability.totalTraces}`);
console.log(`  Active spans: ${state.production.observability.activeSpans}`);
console.log(`  Audit entries: ${state.production.observability.auditEntries}`);

console.log("\n--- Testing Budget Exhaustion ---");
console.log("Setting very low budget...");
coordinator.executionBudget.maxCost = 1;
coordinator.executionBudget.used.cost = 1;

const result = await coordinator.processGoal("add 1 and 1", { a: 1, b: 1 });
console.log("Result with exhausted budget:", result?.error || "success");

console.log("\n=== DONE ===");
