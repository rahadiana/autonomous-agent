/**
 * Direct Executor Test - Correct Step Format
 */

import { runSkill } from "../core/executor.js";

console.log("=== DIRECT EXECUTOR TEST ===\n");

// Create a simple add skill - correct format
const addSkill = {
  id: "test_add",
  name: "math.add",
  capability: "math.add",
  // Correct DSL format: use 'a', 'b', 'to_output'
  logic: [{ 
    op: "add", 
    a: "input.a", 
    b: "input.b", 
    to_output: "result" 
  }]
};

console.log("Testing add skill with correct DSL format:", JSON.stringify(addSkill.logic));

// Test add 5 + 3
runSkill(addSkill, { a: 5, b: 3 })
  .then(result => {
    console.log("\nResult for 5 + 3:", result);
    
    // Test multiply - correct format
    const multiplySkill = {
      id: "test_multiply",
      name: "math.multiply", 
      capability: "math.multiply",
      logic: [{ 
        op: "multiply", 
        a: "input.a", 
        b: "input.b", 
        to_output: "result" 
      }]
    };
    
    console.log("\nTesting multiply skill:", JSON.stringify(multiplySkill.logic));
    return runSkill(multiplySkill, { a: 4, b: 6 });
  })
  .then(result => {
    console.log("\nResult for 4 * 6:", result);
    console.log("\n=== DONE ===");
  })
  .catch(err => {
    console.error("Error:", err);
  });