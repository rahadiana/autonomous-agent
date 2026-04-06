import { createAgentCoordinator } from "../core/coordinator.js";

const RESULTS = {
  total: 0,
  success: 0,
  failed: 0,
  latencies: [],
  errors: []
};

async function runLoadTest(concurrency, durationSeconds, goal) {
  const startTime = Date.now();
  const endTime = startTime + durationSeconds * 1000;
  const coordinator = createAgentCoordinator({ maxIterations: 2, maxCost: 5, maxLatency: 10000 });
  
  coordinator.registerSkill({
    name: "add",
    capability: "math.add",
    logic: [
      { op: "set", path: "memory.result", value: "input.a + input.b" },
      { op: "set", path: "output.result", value: "memory.result" }
    ]
  });

  async function runRequest() {
    if (Date.now() > endTime) return;
    
    RESULTS.total++;
    const reqStart = Date.now();
    
    try {
      const result = await coordinator.processGoal(goal, { a: Math.floor(Math.random() * 100), b: Math.floor(Math.random() * 100) });
      RESULTS.success++;
      RESULTS.latencies.push(Date.now() - reqStart);
    } catch (error) {
      RESULTS.failed++;
      RESULTS.errors.push(error.message);
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      while (Date.now() < endTime) {
        await runRequest();
        await new Promise(r => setTimeout(r, 100));
      }
    })());
  }

  await Promise.all(workers);
}

async function main() {
  const concurrency = parseInt(process.argv[2] || "10");
  const duration = parseInt(process.argv[3] || "10");
  const goal = process.argv[4] || "add two numbers";
  
  console.log(`\n=== LOAD TEST ===`);
  console.log(`Concurrency: ${concurrency} req/sec (approx)`);
  console.log(`Duration: ${duration}s`);
  console.log(`Goal: ${goal}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  await runLoadTest(concurrency, duration, goal);

  const avgLatency = RESULTS.latencies.length > 0 
    ? (RESULTS.latencies.reduce((a, b) => a + b, 0) / RESULTS.latencies.length).toFixed(2)
    : 0;
  const p95 = RESULTS.latencies.sort((a, b) => a - b)[Math.floor(RESULTS.latencies.length * 0.95)] || 0;
  const rps = (RESULTS.total / duration).toFixed(2);

  console.log(`\n=== RESULTS ===`);
  console.log(`Total requests: ${RESULTS.total}`);
  console.log(`Success: ${RESULTS.success} (${((RESULTS.success / RESULTS.total) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${RESULTS.failed} (${((RESULTS.failed / RESULTS.total) * 100).toFixed(1)}%)`);
  console.log(`RPS: ${rps}`);
  console.log(`Avg latency: ${avgLatency}ms`);
  console.log(`P95 latency: ${p95}ms`);
  
  if (RESULTS.errors.length > 0) {
    console.log(`\nErrors: ${RESULTS.errors.slice(0, 5).join(", ")}`);
  }

  process.exit(RESULTS.failed > 0 ? 1 : 0);
}

main();