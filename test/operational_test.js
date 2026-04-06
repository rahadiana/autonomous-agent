import { 
  RetryPolicy, CircuitBreaker, ReliabilityLayer,
  LoadControl, AlertingSystem, ProgressiveDegradation, StateValidator,
  OperationalLayer, DegradationLevel
} from "../core/operational.js";

console.log("=== OPERATIONAL LAYER TEST ===\n");

console.log("--- Testing Retry Policy ---");
const retry = new RetryPolicy({ maxRetries: 3, baseDelay: 100, exponential: true, jitter: false });
for (let i = 0; i < 4; i++) {
  console.log(`  Attempt ${i}: delay=${retry.getDelay(i)}ms`);
}

console.log("\n--- Testing Circuit Breaker ---");
const cb = new CircuitBreaker({ failureThreshold: 3, timeout: 5000 });
console.log("  Initial:", cb.getState().state);
cb.recordFailure();
cb.recordFailure();
cb.recordFailure();
console.log("  After 3 failures:", cb.getState().state);
console.log("  Can execute:", cb.canExecute());

console.log("\n--- Testing Load Control ---");
const load = new LoadControl({ maxQueueSize: 10, maxConcurrent: 2 });
for (let i = 0; i < 15; i++) {
  const result = load.canAccept();
  if (!result.accepted) {
    console.log(`  Task ${i}: REJECTED (${result.reason})`);
  }
}
console.log("  Stats:", load.getStats());

console.log("\n--- Testing Alerting System ---");
const alerts = new AlertingSystem({ failureRateThreshold: 0.2 });
alerts.registerCallback((alert) => console.log(`  ALERT: [${alert.severity}] ${alert.message}`));

alerts.check({ failureRate: 0.25, latency: 100, errorRate: 0.05, queueSize: 50, budgetUsage: 0.5 });
alerts.check({ failureRate: 0.1, latency: 3000, errorRate: 0.05, queueSize: 50, budgetUsage: 0.5 });
console.log("  Active alerts:", alerts.getStats().active);

console.log("\n--- Testing Progressive Degradation ---");
const degr = new ProgressiveDegradation({ latencyThreshold: 1000, failureThreshold: 0.3 });

console.log("  Normal state:", degr.getStatus().currentLevel);
degr.assess({ latency: 1500, failureRate: 0.1, successiveFailures: 2, circuitState: "CLOSED" });
console.log("  After high latency:", degr.getStatus().currentLevel);
degr.assess({ latency: 500, failureRate: 0.4, successiveFailures: 6, circuitState: "OPEN" });
console.log("  After failures:", degr.getStatus().currentLevel);

console.log("\n--- Testing State Validator ---");
const validator = new StateValidator();
validator.registerZone("goal", { required: ["goal"], types: { goal: "string" } });

console.log("  Valid data:", validator.validateZone("goal", { goal: "test", context: {} }));
console.log("  Invalid data:", validator.validateZone("goal", { context: {} }));

validator.saveSnapshot("goal", { goal: "test", context: {} });
console.log("  Snapshot saved:", validator.getSnapshot("goal")?.checksum);

console.log("\n--- Testing Full Operational Layer ---");
const ops = new OperationalLayer({
  reliability: { retry: { maxRetries: 2 }, circuit: { failureThreshold: 2 } },
  loadControl: { maxQueueSize: 50, maxConcurrent: 3 },
  alerting: { failureRateThreshold: 0.15 }
});

let successCount = 0;
for (let i = 0; i < 5; i++) {
  try {
    await ops.executeTask(async () => {
      if (i === 2) throw new Error("timeout");
      successCount++;
      return "ok";
    });
  } catch (e) {
    console.log(`  Task ${i} failed: ${e.message}`);
  }
}

console.log("  Success:", successCount);
console.log("  Health:", ops.getStatus().health);
console.log("  Alerts:", ops.getStatus().alerts.active);

console.log("\n=== DONE ===");
