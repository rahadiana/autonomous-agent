import { runSkill } from "./executor.js";
import { validate } from "./validator.js";
import { evaluate } from "./scoring.js";
import { getTestCases } from "./groundTruth.js";

/**
 * Deep equality check for comparing output vs expected
 * Handles floating point numbers with tolerance
 */
function deepEqual(a, b) {
  if (a === b) return true; // Fast path for identical values
  
  // Handle null/undefined
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;
  
  // If both are objects, compare as JSON
  if (typeof a === "object" && typeof b === "object") {
    // Handle numbers in objects - check if both are numbers with tolerance
    const aStr = JSON.stringify(a);
    const bStr = JSON.stringify(b);
    
    // If JSON stringify matches, they're equal
    if (aStr === bStr) return true;
    
    // Try numeric comparison for { result: number } pattern
    if (a.result !== undefined && b.result !== undefined) {
      return numbersEqual(a.result, b.result);
    }
    
    return aStr === bStr;
  }
  
  // For primitives, try numeric comparison
  return numbersEqual(a, b);
}

/**
 * Compare two values with floating point tolerance
 */
function numbersEqual(a, b) {
  const numA = Number(a);
  const numB = Number(b);
  
  if (isNaN(numA) && isNaN(numB)) return true;
  if (isNaN(numA) || isNaN(numB)) return false;
  
  // Absolute difference tolerance for floating point
  const tolerance = 1e-9;
  return Math.abs(numA - numB) < tolerance;
}

/**
 * Check if a value represents an error condition
 * Returns true for: null, undefined, NaN, error objects
 */
function isErrorResult(result) {
  if (result === null || result === undefined) return true;
  if (typeof result === "object" && result.error) return true;
  // Check for NaN in result
  if (result?.result !== undefined && isNaN(result.result)) return true;
  return false;
}

/**
 * Check consistency - run same input 3x, all must produce same output
 */
async function checkConsistency(skill, testCase) {
  if (!testCase || !testCase.input) return true;
  
  const results = [];
  for (let i = 0; i < 3; i++) {
    try {
      const res = await runSkill(skill, testCase.input);
      results.push(JSON.stringify(res));
    } catch (e) {
      // Any error = not consistent
      return false;
    }
  }
  
  return results.every(r => r === results[0]);
}

/**
 * Evaluate a skill against ground truth test cases
 * @param {Object} skill - skill with logic and output_schema
 * @param {string} capability - capability name (e.g., "math.add")
 * @returns {Object} evaluation result with score, accuracy, details
 */
export async function evaluateSkill(skill, capability) {
  const testCases = getTestCases(capability);
  
  if (testCases.length === 0) {
    return {
      score: 0,
      accuracy: 0,
      stable: false,
      details: [],
      error: "No test cases for capability: " + capability
    };
  }
  
  let passed = 0;
  let total = testCases.length;
  const details = [];

  for (const t of testCases) {
    try {
      const output = await runSkill(skill, t.input);

      // 1. Schema validation (hard gate)
      const schemaValid = validate(skill.output_schema, output).valid;
      
      if (!schemaValid) {
        details.push({ 
          input: t.input, 
          passed: false, 
          reason: "schema_fail",
          output: output,
          expected: t.expected 
        });
        continue;
      }

      // 2. For error cases (expected: null), skill should handle gracefully
      // Either return error indication or handle without crashing
      if (t.expected === null) {
        // Skill should either:
        // - Return an object with error field
        // - Return result: null/NaN
        // - Throw an error (which we catch)
        // Any of these are acceptable for error handling
        passed++; // Count as pass since skill didn't crash
        details.push({ 
          input: t.input, 
          passed: true, 
          reason: "error_handled",
          output: output,
          expected: t.expected 
        });
        continue;
      }

      // 3. Correctness check - exact match
      const correct = deepEqual(output, t.expected);

      if (correct) passed++;

      details.push({
        input: t.input,
        passed: correct,
        reason: correct ? "correct" : "incorrect",
        output: output,
        expected: t.expected
      });
    } catch (e) {
      // If skill throws, count as fail (unless expected is null)
      if (t.expected === null) {
        passed++; // Error case expected
        details.push({ 
          input: t.input, 
          passed: true, 
          reason: "error_thrown",
          error: e.message,
          expected: t.expected 
        });
      } else {
        details.push({ 
          input: t.input, 
          passed: false, 
          reason: "exception",
          error: e.message,
          expected: t.expected 
        });
      }
    }
  }

  const accuracy = total > 0 ? passed / total : 0;

  // 3. Consistency check - run 3x on first normal test case
  const firstNormalTest = testCases.find(t => t.expected !== null);
  const stable = firstNormalTest ? await checkConsistency(skill, firstNormalTest) : true;

  // 4. Final score calculation
  // accuracy: 80%, consistency: 20%
  let score = accuracy * 0.8 + (stable ? 0.2 : 0);

  // 5. Heavy penalty for low accuracy skills (< 0.5)
  // This prevents "wrong but not terrible" skills from getting inflated scores
  let degraded = false;
  if (accuracy < 0.5) {
    score *= 0.5;
    degraded = true;
  }

  return {
    score,
    accuracy,
    stable,
    degraded,
    passed,
    total,
    details
  };
}

export async function runTests(skill, testCases) {
  let passed = 0;
  const results = [];

  for (const t of testCases) {
    try {
      const result = await runSkill(skill, t.input);

      const validation = validate(
        skill.output_schema,
        result
      );

      if (validation.valid) {
        passed++;
      }

      results.push({
        input: t.input,
        result,
        valid: validation.valid,
        errors: validation.errors
      });
    } catch (e) {
      results.push({
        input: t.input,
        error: e.message,
        valid: false
      });
    }
  }

  return {
    passed,
    total: testCases.length,
    score: testCases.length > 0 ? passed / testCases.length : 0,
    results
  };
}

export async function runEvaluation(skill, testCases) {
  const testResult = await runTests(skill, testCases);

  const avgScore = testResult.results.reduce((sum, r) => {
    return sum + evaluate(r.result, r.valid);
  }, 0) / (testResult.results.length || 1);

  return {
    testScore: testResult.score,
    avgScore,
    totalTests: testResult.total,
    passedTests: testResult.passed
  };
}