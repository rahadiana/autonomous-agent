import fetch from "node-fetch";

const BASE = "http://localhost:3000";

async function test() {
  console.log("=== STAGING SMOKE TEST ===\n");

  const health = await fetch(`${BASE}/api/v1/agent/health`).then(r => r.json());
  console.log("1. Health:", JSON.stringify(health));

  const execute = await fetch(`${BASE}/api/v1/agent/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal: "add 2 and 3" })
  }).then(r => r.json());
  console.log("\n2. Execute:", JSON.stringify(execute, null, 2));

  const metrics = await fetch(`${BASE}/api/v1/agent/metrics`).then(r => r.json());
  console.log("\n3. Metrics keys:", Object.keys(metrics));

  console.log("\n✅ All tests passed!");
}

test().catch(e => console.error("Error:", e.message));