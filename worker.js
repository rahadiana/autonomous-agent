import { createAgentCoordinator } from "./core/coordinator.js";
import { PlatformConfig } from "./core/deployment.js";

const config = PlatformConfig.fromEnv();

console.log("=== WORKER STARTUP ===");

const coordinator = createAgentCoordinator({
  maxIterations: 3,
  learningEnabled: config.features.metaReasoning,
  autonomyEnabled: config.features.autonomy,
  maxCost: 10,
  maxLatency: 30000
});

console.log("Worker coordinator initialized");

async function processJob(job) {
  const { id, goal, context } = job;
  console.log(`[Worker] Processing job ${id}: ${goal}`);
  
  try {
    const result = await coordinator.execute(goal, context);
    return { success: true, result };
  } catch (error) {
    console.error(`[Worker] Job ${id} failed:`, error.message);
    return { success: false, error: error.message };
  }
}

console.log("[Worker] Ready for jobs...");
console.log("[Worker] Press Ctrl+C to stop");

process.on("SIGTERM", () => {
  console.log("\n[Worker] Shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n[Worker] Shutting down...");
  process.exit(0);
});