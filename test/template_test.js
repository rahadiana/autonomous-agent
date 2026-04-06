import { createAgentCoordinator } from "../core/coordinator.js";

console.log("=== PLAN TEMPLATE ABSTRACTION TEST ===\n");

const coordinator = createAgentCoordinator({
  maxIterations: 1,
  learningEnabled: true
});

coordinator.registerSkill({
  name: "add",
  capability: "math.add",
  logic: [{ op: "set", path: "output.result", value: "input.a + input.b" }]
});

console.log("--- Goal 1: 'add 2 and 3' (create episode + template) ---");
const r1 = await coordinator.processGoal("add 2 and 3", { a: 2, b: 3 });
console.log("Result 1:", r1?.evaluation?.score, "reused:", r1?.reused);
console.log("Execution:", r1?.execution?.success);

console.log("\n--- Goal 2: 'add 5 and 7' (reuse template) ---");
const r2 = await coordinator.processGoal("add 5 and 7", { a: 5, b: 7 });
console.log("Result 2:", r2?.evaluation?.score, "reused:", r2?.reused);
console.log("Execution:", r2?.execution?.success);

console.log("\n--- Goal 3: 'add 100 and 200' (reuse template again) ---");
const r3 = await coordinator.processGoal("add 100 and 200", { a: 100, b: 200 });
console.log("Result 3:", r3?.evaluation?.score, "reused:", r3?.reused);
console.log("Execution:", r3?.execution?.success);

console.log("\n=== Final Memory Stats ===");
console.log(coordinator.getMemoryStats());

console.log("\n=== DONE ===");
