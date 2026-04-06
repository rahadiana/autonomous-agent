import { GoalValidator, BudgetController, ValueFunction, AutonomousGoalGenerator } from "../core/goalAutonomy.js";

console.log("=== STEP BY STEP DEBUG ===\n");

const validator = new GoalValidator({ minRelevance: 0.3, minNovelty: 0.2, maxCost: 0.9 });
const budget = new BudgetController({ maxAutonomousGoals: 3, goalBudget: 10, maxCost: 0.8 });
const valueFn = new ValueFunction();

console.log("1. Can generate:", budget.canGenerateGoal());

const baseGoals = ["add numbers", "multiply values", "calculate sum", "fetch data"];
console.log("2. Base goals:", baseGoals);

const candidates = baseGoals.map(g => {
  const relevance = validator.computeRelevance(g);
  const novelty = validator.computeNovelty(g, []);
  const cost = validator.estimateCost(g);
  return { goal: g, relevance, novelty, cost };
});
console.log("3. Candidates:", JSON.stringify(candidates, null, 2));

const validGoals = candidates.filter(g => validator.isValidGoal(g));
console.log("4. Valid goals:", validGoals.length);

if (validGoals.length > 0) {
  console.log("5. Ranking...");
  const ranked = validGoals.map(g => {
    const valueResult = valueFn.compute(g, { budgetController: budget });
    return { ...g, value: valueResult.value };
  }).sort((a, b) => b.value - a.value);
  
  console.log("6. Ranked:", JSON.stringify(ranked, null, 2));
  
  const selected = ranked[0];
  console.log("7. Selected:", selected);
  console.log("8. Budget isWithinCost:", budget.isWithinCost(selected?.cost));
}

console.log("\n=== DONE ===");
