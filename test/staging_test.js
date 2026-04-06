import fetch from "node-fetch";

const BASE = "http://localhost:3000";
const GOALS = [
  { goal: "add 2 and 3", expected: "math.add" },
  { goal: "calculate sum of 100 and 250", expected: "math.add" },
  { goal: "multiply 12 and 8", expected: "math.multiply" },
  { goal: "calculate 50 times 20", expected: "math.multiply" },
  { goal: "what is 10 plus 15", expected: "math.add" },
  { goal: "multiply 7 and 6", expected: "math.multiply" },
  { goal: "add 1 and 1", expected: "math.add" },
  { goal: "multiply 3 and 5", expected: "math.multiply" },
  { goal: "sum of 200 and 300", expected: "math.add" },
  { goal: "multiply 25 by 4", expected: "math.multiply" }
];

const RESULTS = {
  total: 0,
  success: 0,
  failed: 0,
  latencies: [],
  reuseCount: 0,
  autonomyGoals: 0,
  errors: [],
  scores: []
};

async function executeGoal(testCase) {
  const start = Date.now();
  const res = await fetch(`${BASE}/api/v1/agent/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal: testCase.goal, context: { a: 10, b: 20 } })
  });
  const latency = Date.now() - start;
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
  return { latency, data };
}

async function runTrafficTest(iterations = 50) {
  console.log("=== STAGING TRAFFIC TEST ===");
  console.log(`Running ${iterations} requests...\n`);

  for (let i = 0; i < iterations; i++) {
    const testCase = GOALS[i % GOALS.length];
    RESULTS.total++;

    try {
      const { latency, data } = await executeGoal(testCase);
      RESULTS.latencies.push(latency);

      if (data.success === true) {
        RESULTS.success++;
      } else {
        RESULTS.failed++;
        RESULTS.errors.push({ goal: testCase.goal, success: data.success, error: data.result?.error || "unknown" });
      }

      if (data.reused) RESULTS.reuseCount++;
      if (data.evaluation?.score) RESULTS.scores.push(data.evaluation.score);

    } catch (e) {
      RESULTS.failed++;
      RESULTS.errors.push({ goal: testCase.goal, error: e.message });
    }

    if ((i + 1) % 10 === 0) {
      console.log(`Progress: ${i + 1}/${iterations}`);
    }
  }

  const metrics = await fetch(`${BASE}/api/v1/agent/metrics`).then(r => r.json());
  
  return metrics;
}

function analyzeResults(metrics) {
  console.log("\n=== RESULTS ===\n");

  const sorted = [...RESULTS.latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const avg = RESULTS.latencies.reduce((a, b) => a + b, 0) / RESULTS.latencies.length || 0;

  console.log(`Total Requests: ${RESULTS.total}`);
  console.log(`Success: ${RESULTS.success} (${((RESULTS.success / RESULTS.total) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${RESULTS.failed} (${((RESULTS.failed / RESULTS.total) * 100).toFixed(1)}%)`);

  console.log(`\n--- Latency ---`);
  console.log(`Avg: ${avg.toFixed(0)}ms`);
  console.log(`p50: ${p50}ms`);
  console.log(`p95: ${p95}ms`);
  console.log(`p99: ${p99}ms`);

  console.log(`\n--- Reuse Rate ---`);
  const reuseRate = (RESULTS.reuseCount / RESULTS.total) * 100;
  console.log(`Reused: ${RESULTS.reuseCount}/${RESULTS.total} (${reuseRate.toFixed(1)}%)`);
  console.log(reuseRate > 30 ? "✅ Good (>30%)" : "⚠️ Low (<30%)");

  console.log(`\n--- Score Distribution ---`);
  if (RESULTS.scores.length > 0) {
    const avgScore = RESULTS.scores.reduce((a, b) => a + b, 0) / RESULTS.scores.length;
    console.log(`Avg Score: ${avgScore.toFixed(3)}`);
  }

  console.log(`\n--- Budget ---`);
  const budget = metrics.production?.budget;
  if (budget) {
    console.log(`Cost: ${budget.cost?.used || 0}/${budget.cost?.max || 10}`);
    console.log(`Latency: ${budget.latency?.used || 0}/${budget.latency?.max || 30000}`);
  }

  console.log(`\n--- Autonomy ---`);
  if (metrics.autonomy) {
    console.log(`Goals Generated: ${metrics.autonomy.goalsGenerated || 0}`);
    console.log(`Autonomy Active: ${metrics.autonomy.enabled ? "Yes" : "No"}`);
  }

  if (RESULTS.errors.length > 0) {
    console.log(`\n--- Errors (${RESULTS.errors.length}) ---`);
    RESULTS.errors.slice(0, 5).forEach(e => console.log(`  - ${e.goal}: ${e.error}`));
  }

  console.log("\n=== VALIDATION ===");
  const errorRate = (RESULTS.failed / RESULTS.total) * 100;
  const checks = [
    { name: "Error rate <1%", pass: errorRate < 1, value: `${errorRate.toFixed(1)}%` },
    { name: "Latency p95 <1s", pass: p95 < 1000, value: `${p95}ms` },
    { name: "Reuse rate >30%", pass: reuseRate > 30, value: `${reuseRate.toFixed(1)}%` }
  ];
  
  checks.forEach(c => {
    console.log(`${c.pass ? "✅" : "❌"} ${c.name} (${c.value})`);
  });
}

async function main() {
  const iterations = parseInt(process.argv[2] || "30");
  const metrics = await runTrafficTest(iterations);
  analyzeResults(metrics);
}

main().catch(e => console.error("Error:", e.message));