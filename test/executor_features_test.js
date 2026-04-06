/**
 * Executor Feature Test - Verify new features work
 */

import { runSkill, getPath, setPath, resolveValue, validateStep } from "../core/executor.js";

console.log("=== EXECUTOR FEATURE TEST ===\n");

// Test 1: Path-based memory
console.log("1. Path-based memory (getPath/setPath)");
const obj = {};
setPath(obj, "a.b.c", 42);
setPath(obj, "x", 100);
console.log("  setPath({...}, 'a.b.c', 42) ->", obj);
console.log("  getPath(obj, 'a.b.c') =", getPath(obj, "a.b.c"));  // 42
console.log("  getPath(obj, 'x') =", getPath(obj, "x"));  // 100
console.log("  getPath(obj, 'a.b') =", getPath(obj, "a.b"));  // { c: 42 }

// Test 2: $ reference system
console.log("\n2. $ reference system");
const ctx = {
  input: { a: 5, b: 3 },
  memory: { x: 10, y: 20 }
};
console.log("  resolveValue('$input.a', ctx) =", resolveValue("$input.a", ctx));  // 5
console.log("  resolveValue('$memory.x', ctx) =", resolveValue("$memory.x", ctx));  // 10

// Test 3: Step validator
console.log("\n3. Step validator");
try {
  validateStep({ op: "add", a: 1, b: 2 });
  console.log("  Valid step 'add' -> OK");
} catch (e) {
  console.log("  Valid step 'add' -> ERROR:", e.message);
}

try {
  validateStep({ op: "invalid_op", a: 1 });
  console.log("  Invalid step 'invalid_op' -> ERROR: NOT CAUGHT!");
} catch (e) {
  console.log("  Invalid step 'invalid_op' -> CAUGHT:", e.message);
}

// Test 4: Complex skill execution
console.log("\n4. Complex skill with multi-step");
const complexSkill = {
  id: "complex_math",
  name: "complex_math",
  capability: "math.complex",
  logic: [
    // Step 1: Add a + b -> temp
    { op: "add", a: "$input.a", b: "$input.b", to: "temp" },
    // Step 2: Multiply temp * 2 -> result
    { op: "multiply", a: "$memory.temp", b: 2, to: "result" }
  ]
};

runSkill(complexSkill, { a: 5, b: 3 })
  .then(result => {
    console.log("  Input: a=5, b=3");
    console.log("  Expected: (5+3)*2 = 16");
    console.log("  Result:", result);
    console.log("  temp =", result.temp);  // 8
    console.log("  result =", result.result);  // 16
    console.log("  meta:", result._meta);
    
    console.log("\n=== ALL FEATURE TESTS COMPLETE ===");
  })
  .catch(err => {
    console.error("Error:", err);
  });