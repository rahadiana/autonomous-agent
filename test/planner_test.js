import { createPlan } from "../core/planner.js";

const skills = [
  { name: "add", capability: "math.add" },
  { name: "multiply", capability: "math.multiply" }
];

const state = { goal: "math.add", steps: 0 };

console.log("Testing createPlan...");
console.log("Goal:", "math.add");
console.log("Skills:", skills.map(s => s.capability));
console.log("State:", state);

const result = createPlan("math.add", state, skills, {
  maxDepth: 3,
  maxNodes: 50,
  timeout: 2000
});

console.log("\nResult:", JSON.stringify(result, null, 2));
