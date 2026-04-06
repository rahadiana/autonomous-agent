import { createAgentCoordinator } from "./core/coordinator.js";
import { DeployablePlatform } from "./core/platform.js";
import { PlatformConfig, DeploymentManager } from "./core/deployment.js";

const config = PlatformConfig.fromEnv();

console.log("=== DEPLOYABLE PLATFORM STARTUP ===");
console.log("Config:", {
  env: config.env,
  port: config.port,
  auth: config.auth.enabled,
  features: config.features
});

const coordinator = createAgentCoordinator({
  maxIterations: 3,
  learningEnabled: config.features.metaReasoning,
  autonomyEnabled: false,
  reuseThreshold: 0.5, // Lower threshold for initial learning
  maxCost: 1000, // Much higher for sustained traffic
  maxLatency: 30000
});

coordinator.registerSkill({
  name: "add",
  capability: "math.add",
  logic: [
    { op: "set", path: "memory.result", value: "input.a + input.b" },
    { op: "set", path: "output.result", value: "memory.result" }
  ]
});

coordinator.registerSkill({
  name: "multiply",
  capability: "math.multiply",
  logic: [
    { op: "set", path: "memory.result", value: "input.a * input.b" },
    { op: "set", path: "output.result", value: "memory.result" }
  ]
});

console.log("Coordinator initialized with skills: math.add, math.multiply");

const deployment = new DeploymentManager(coordinator, config);
await deployment.initialize();

await deployment.start();

console.log("\n=== PLATFORM READY ===");
console.log("Endpoints:");
console.log("  POST /api/v1/agent/execute - Execute goal");
console.log("  GET  /api/v1/agent/status  - Get system status");
console.log("  GET  /api/v1/agent/health - Health check");
console.log("  GET  /api/v1/agent/metrics - Get metrics");
console.log("  POST /api/v1/agent/reset   - Reset agent");

process.on("SIGTERM", async () => {
  console.log("\nShutting down...");
  await deployment.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await deployment.stop();
  process.exit(0);
});
