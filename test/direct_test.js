import { createAgentCoordinator } from "../core/coordinator.js";
import { AutonomousGoalGenerator } from "../core/goalAutonomy.js";

console.log("=== DIRECT TEST ===\n");

const generator = new AutonomousGoalGenerator({
  validator: { minRelevance: 0.3, minNovelty: 0.2, maxCost: 0.9 },
  budget: { maxAutonomousGoals: 3, goalBudget: 10, maxCost: 0.8 }
});

console.log("Can generate:", generator.canGenerate());

const context = { history: [] };
const candidates = generator.generateCandidates(context);
console.log("Candidates generated:", candidates.length);

const validGoals = candidates.filter(g => generator.validator.isValidGoal(g));
console.log("Valid goals:", validGoals.length);

const ranked = generator.valueFunction.rank(validGoals, { budgetController: generator.budget });
console.log("Top ranked:", ranked[0]?.goal);

if (ranked[0] && generator.budget.isWithinCost(ranked[0].cost)) {
  console.log("PASS: Goal should be generated");
  console.log("Cost check:", ranked[0].cost, "<=", generator.budget.maxCost);
} else {
  console.log("FAIL: Goal generation blocked");
  console.log("Cost:", ranked[0]?.cost, "Max:", generator.budget.maxCost);
}

console.log("\n=== DONE ===");
