import { GoalValidator, BudgetController, ValueFunction, AutonomousGoalGenerator } from "../core/goalAutonomy.js";

console.log("=== FULL AUTONOMY TEST ===\n");

const generator = new AutonomousGoalGenerator({
  validator: { minRelevance: 0.3, minNovelty: 0.2, maxCost: 0.9 },
  budget: { maxAutonomousGoals: 3, goalBudget: 10, maxCost: 0.8 }
});

console.log("Can generate:", generator.canGenerate());
const goal = generator.generate({ history: [] });
console.log("Generated:", goal);

console.log("\n=== DONE ===");
