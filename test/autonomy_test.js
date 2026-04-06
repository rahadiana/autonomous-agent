import { createAgentCoordinator } from "../core/coordinator.js";
import { GoalValidator, BudgetController, ValueFunction, AutonomousGoalGenerator } from "../core/goalAutonomy.js";

console.log("=== SAFE GOAL AUTONOMY TEST ===\n");

console.log("--- Testing Goal Validator ---");
const validator = new GoalValidator({ minRelevance: 0.3, minNovelty: 0.2, maxCost: 0.9 });

const tests = ["add numbers", "multiply values", "calculate sum", "fetch data", "do random xyz"];
for (const goal of tests) {
  const result = validator.validate(goal);
  console.log(`  "${goal}": ${result.valid ? "VALID" : "INVALID"} (r:${result.relevance.toFixed(2)}, n:${result.novelty.toFixed(2)}, c:${result.cost.toFixed(2)})`);
}

console.log("\n--- Testing Autonomous Goal Generator ---");
const generator = new AutonomousGoalGenerator({
  validator: { minRelevance: 0.3, minNovelty: 0.2, maxCost: 0.9 },
  budget: { maxAutonomousGoals: 3, goalBudget: 10 }
});

const goal1 = generator.generate({ history: [] });
console.log("  Generated:", goal1?.goal, `(value: ${goal1?.value?.toFixed(2)})`);

console.log("\n--- Testing Full Coordinator ---");
const coordinator = createAgentCoordinator({
  maxIterations: 1,
  learningEnabled: true,
  autonomyEnabled: true,
  maxAutonomousGoals: 2,
  goalBudget: 5
});

coordinator.registerSkill({
  name: "add",
  capability: "math.add",
  logic: [{ op: "set", path: "output.result", value: "input.a + input.b" }]
});

const r1 = await coordinator.processGoal("add 2 and 3", { a: 2, b: 3 });
console.log("  User goal result:", r1?.evaluation?.score);

console.log("\n--- System Stats ---");
console.log("  Autonomy:", coordinator.getState().autonomy?.budget);

console.log("\n=== DONE ===");
