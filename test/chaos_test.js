import { createAgentCoordinator } from "../core/coordinator.js";

const RESULTS = {
  testName: "",
  passed: 0,
  failed: 0,
  details: []
};

async function test(name, fn) {
  RESULTS.testName = name;
  console.log(`\n--- ${name} ---`);
  try {
    await fn();
    RESULTS.passed++;
    RESULTS.details.push({ name, status: "PASS" });
    console.log(`✅ PASS`);
  } catch (error) {
    RESULTS.failed++;
    RESULTS.details.push({ name, status: "FAIL", error: error.message });
    console.log(`❌ FAIL: ${error.message}`);
  }
}

async function main() {
  console.log("=== CHAOS TEST SUITE ===\n");

  await test("1. Simulasi delay MCP (slow API)", async () => {
    const coordinator = createAgentCoordinator({ maxIterations: 2, maxCost: 5, maxLatency: 5000 });
    coordinator.registerSkill({
      name: "slowAdd",
      capability: "math.slowAdd",
      logic: [
        { op: "set", path: "memory.start", value: "Date.now()" },
        { op: "set", path: "memory.delayed", value: "await new Promise(r => setTimeout(r, 2000))" },
        { op: "set", path: "memory.end", value: "Date.now()" },
        { op: "set", path: "memory.duration", value: "memory.end - memory.start" },
        { op: "set", path: "output.result", value: "memory.duration" }
      ]
    });

    const start = Date.now();
    const result = await coordinator.processGoal("slow add numbers", { a: 1, b: 2 });
    const elapsed = Date.now() - start;

    console.log(`  Elapsed: ${elapsed}ms, result: ${JSON.stringify(result?.execution?.output)}`);
    if (elapsed > 5000) throw new Error("Timeout not enforced");
  });

  await test("2. Simulasi skill error (graceful degradation)", async () => {
    const coordinator = createAgentCoordinator({ maxIterations: 2, maxCost: 5, maxLatency: 5000 });
    coordinator.registerSkill({
      name: "failingSkill",
      capability: "math.fail",
      logic: [
        { op: "set", path: "memory.error", value: "throw new Error('Intentional failure')" }
      ]
    });

    const result = await coordinator.processGoal("test failing skill", { a: 1 });
    console.log(`  Result: success=${result?.execution?.success}`);
    if (result?.execution?.success !== false) {
      throw new Error("Should handle skill failure gracefully");
    }
  });

  await test("3. Simulasi invalid goal (validation)", async () => {
    const coordinator = createAgentCoordinator({ maxIterations: 2, maxCost: 5, maxLatency: 5000 });
    
    const result = await coordinator.processGoal("", {});
    console.log(`  Result: success=${result?.execution?.success}`);
  });

  await test("4. Simulasi missing context (default handling)", async () => {
    const coordinator = createAgentCoordinator({ maxIterations: 2, maxCost: 5, maxLatency: 5000 });
    coordinator.registerSkill({
      name: "add",
      capability: "math.add",
      logic: [
        { op: "set", path: "memory.result", value: "input.a + (input.b || 0)" },
        { op: "set", path: "output.result", value: "memory.result" }
      ]
    });

    const result = await coordinator.processGoal("add numbers", { a: 5 });
    console.log(`  Result: ${JSON.stringify(result?.execution?.output)}`);
    if (result?.execution?.output?.result !== 5) {
      throw new Error("Should handle missing context gracefully");
    }
  });

  await test("5. Memory limit (episodic memory cleanup)", async () => {
    const coordinator = createAgentCoordinator({ maxIterations: 2, maxCost: 5, maxLatency: 5000 });
    coordinator.registerSkill({
      name: "add",
      capability: "math.add",
      logic: [
        { op: "set", path: "output.result", value: "input.a + input.b" }
      ]
    });

    for (let i = 0; i < 100; i++) {
      await coordinator.processGoal("add numbers", { a: i, b: i });
    }

    const state = coordinator.getState();
    const memoryCount = state.memory?.episodic?.length || 0;
    console.log(`  Memory episodes: ${memoryCount}`);
  });

  await test("6. Concurrent execution (race condition)", async () => {
    const coordinator = createAgentCoordinator({ maxIterations: 2, maxCost: 50, maxLatency: 5000 });
    coordinator.registerSkill({
      name: "add",
      capability: "math.add",
      logic: [
        { op: "set", path: "memory.result", value: "input.a + input.b" },
        { op: "set", path: "output.result", value: "memory.result" }
      ]
    });

    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(coordinator.processGoal("add numbers", { a: i, b: 10 }));
    }

    const results = await Promise.all(promises);
    const failures = results.filter(r => !r?.execution?.success).length;
    const details = results.map((r, i) => ({ idx: i, hasExecution: !!r?.execution, success: r?.execution?.success, output: r?.execution?.output?.result }));
    console.log(`  Concurrent: ${results.length}, failures: ${failures}`);
    console.log(`  Results:`, JSON.stringify(details.slice(0, 10)));
    console.log(`  Failed indices:`, results.map((r, i) => !r?.execution?.success ? i : -1).filter(i => i >= 0));
    
    if (failures > 0) throw new Error("Race conditions detected");
  });

  await test("7. Reset state (clean state)", async () => {
    const coordinator = createAgentCoordinator({ maxIterations: 2, maxCost: 5, maxLatency: 5000 });
    coordinator.registerSkill({
      name: "add",
      capability: "math.add",
      logic: [
        { op: "set", path: "output.result", value: "input.a + input.b" }
      ]
    });

    await coordinator.processGoal("add numbers", { a: 1, b: 2 });
    coordinator.reset();
    const state = coordinator.getState();
    
    console.log(`  After reset: history=${state.history?.length}, memory=${state.memory?.episodic?.length}`);
    if (state.history?.length > 0 || state.memory?.episodic?.length > 0) {
      throw new Error("Reset did not clear state");
    }
  });

  console.log(`\n=== CHAOS TEST SUMMARY ===`);
  console.log(`Passed: ${RESULTS.passed}/${RESULTS.passed + RESULTS.failed}`);
  console.log(`Failed: ${RESULTS.failed}/${RESULTS.passed + RESULTS.failed}`);
  
  process.exit(RESULTS.failed > 0 ? 1 : 0);
}

main();