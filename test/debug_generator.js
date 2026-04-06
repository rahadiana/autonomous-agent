import { GoalValidator, BudgetController, ValueFunction, AutonomousGoalGenerator } from "../core/goalAutonomy.js";

console.log("=== DEBUG GOAL GENERATOR ===\n");

const validator = new GoalValidator({ minRelevance: 0.3, minNovelty: 0.2, maxCost: 0.9 });
const budget = new BudgetController({ maxAutonomousGoals: 3, goalBudget: 10 });
const valueFn = new ValueFunction();

console.log("Budget can generate:", budget.canGenerateGoal());

const baseGoals = ["add numbers", "multiply values", "calculate sum", "fetch data"];
const candidates = baseGoals.map(g => ({
  goal: g,
  relevance: validator.computeRelevance(g),
  novelty: validator.computeNovelty(g, []),
  cost: validator.estimateCost(g)
}));

console.log("Candidates:", JSON.stringify(candidates, null, 2));

const validGoals = candidates.filter(g => validator.isValidGoal(g));
console.log("Valid goals:", validGoals.length);

if (validGoals.length > 0) {
  const ranked = valueFn.rank(validGoals, { budgetController: budget });
  console.log("Ranked:", JSON.stringify(ranked.map(r => ({ goal: r.goal, value: r.value })), null, 2));
  
  const selected = ranked[0];
  console.log("Selected:", selected);
  console.log("Within cost:", budget.isWithinCost(selected?.cost));
}

console.log("\n=== DONE ===");
