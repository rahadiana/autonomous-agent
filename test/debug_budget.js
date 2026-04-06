import { BudgetController } from "../core/goalAutonomy.js";

console.log("=== DEBUG BUDGET ===\n");

const budget = new BudgetController({ maxAutonomousGoals: 3, goalBudget: 10, maxCost: 0.8 });

console.log("maxCost:", budget.maxCost);
console.log("isWithinCost(0.3):", budget.isWithinCost(0.3));
console.log("isWithinCost(0.5):", budget.isWithinCost(0.5));
console.log("isWithinCost(0.8):", budget.isWithinCost(0.8));
console.log("isWithinCost(0.9):", budget.isWithinCost(0.9));

console.log("\n=== DONE ===");
