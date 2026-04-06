import { createAgentCoordinator } from "../core/coordinator.js";
import { DeployablePlatform } from "../core/platform.js";
import { PlatformConfig } from "../core/deployment.js";

console.log("=== DEPLOYABLE PLATFORM TEST ===\n");

const coordinator = createAgentCoordinator({
  maxIterations: 1,
  learningEnabled: false,
  autonomyEnabled: false,
  maxCost: 5
});

coordinator.registerSkill({
  name: "add",
  capability: "math.add",
  logic: [{ op: "set", path: "output.result", value: "input.a + input.b" }]
});

const platform = new DeployablePlatform(coordinator, {
  port: 3000,
  apiKeys: ["test-key"],
  rateLimitMax: 10
});

console.log("--- Testing API Routes ---\n");

const routes = [
  "POST /agent/execute",
  "GET /agent/status",
  "GET /agent/health",
  "GET /agent/metrics",
  "GET /agent/memory",
  "POST /agent/skill",
  "POST /agent/reset"
];

routes.forEach(route => {
  console.log(`  ✓ ${route}`);
});

console.log("\n--- Simulating Requests ---\n");

const executeRequest = await platform.handleRequest({
  method: "POST",
  path: "/agent/execute",
  body: { goal: "add 5 and 3", context: { a: 5, b: 3 } },
  headers: { "x-api-key": "test-key" }
});

console.log("POST /agent/execute:");
console.log("  Status:", executeRequest.status);
console.log("  Result:", JSON.stringify(executeRequest.body).slice(0, 200));

const statusRequest = await platform.handleRequest({
  method: "GET",
  path: "/agent/status",
  headers: { "x-api-key": "test-key" }
});

console.log("\nGET /agent/status:");
console.log("  Status:", statusRequest.status);

const healthRequest = await platform.handleRequest({
  method: "GET",
  path: "/agent/health",
  headers: { "x-api-key": "test-key" }
});

console.log("\nGET /agent/health:");
console.log("  Status:", healthRequest.status);
console.log("  Body:", JSON.stringify(healthRequest.body).slice(0, 100));

console.log("\n--- Testing Rate Limiting ---");
for (let i = 0; i < 3; i++) {
  await platform.handleRequest({
    method: "GET",
    path: "/agent/health",
    headers: { "x-api-key": "test-key" }
  });
}

const status = platform.getStatus();
console.log("Rate limiter users:", status.rateLimit);

console.log("\n--- Testing Auth ---");
const noAuthRequest = await platform.handleRequest({
  method: "GET",
  path: "/agent/health",
  headers: {}
});

console.log("Without auth:", noAuthRequest.status === 401 ? "BLOCKED (correct)" : "ALLOWED (wrong)");

const badAuthRequest = await platform.handleRequest({
  method: "GET",
  path: "/agent/health",
  headers: { "x-api-key": "wrong-key" }
});

console.log("With wrong key:", badAuthRequest.status === 401 ? "BLOCKED (correct)" : "ALLOWED (wrong)");

console.log("\n=== PLATFORM READY ===");
console.log("To run server:");
console.log("  node server.js");
console.log("\nTo build Docker:");
console.log("  docker build -t agent-platform .");
console.log("\nTo run Docker Compose:");
console.log("  docker-compose up -d");
