/**
 * Ground truth test cases for math capabilities
 * Used by evaluator to determine if skill is correct or not
 */

export const groundTruth = {
  "math.add": [
    // Normal cases
    { input: { a: 5, b: 3 }, expected: { result: 8 } },
    { input: { a: 0, b: 10 }, expected: { result: 10 } },
    { input: { a: 100, b: 200 }, expected: { result: 300 } },
    { input: { a: 1, b: 1 }, expected: { result: 2 } },
    // Negative numbers
    { input: { a: -5, b: 5 }, expected: { result: 0 } },
    { input: { a: -10, b: -20 }, expected: { result: -30 } },
    // Edge cases
    { input: { a: 0, b: 0 }, expected: { result: 0 } },
    { input: { a: 0.5, b: 0.5 }, expected: { result: 1 } },
    // Adversarial - large numbers, edge cases
    { input: { a: 1e9, b: 1e9 }, expected: { result: 2e9 } },
    { input: { a: 1e-9, b: 1e-9 }, expected: { result: 2e-9 } },
    { input: { a: 0.1, b: 0.2 }, expected: { result: 0.3 } }, // floating point edge
    // Error cases - should handle gracefully
    { input: { a: null, b: 3 }, expected: null },
    { input: { a: "abc", b: 3 }, expected: null }
  ],

  "math.multiply": [
    // Normal cases
    { input: { a: 2, b: 3 }, expected: { result: 6 } },
    { input: { a: 5, b: 4 }, expected: { result: 20 } },
    { input: { a: 10, b: 10 }, expected: { result: 100 } },
    // Zero and one
    { input: { a: 0, b: 100 }, expected: { result: 0 } },
    { input: { a: 1, b: 999 }, expected: { result: 999 } },
    // Negative numbers
    { input: { a: -2, b: 4 }, expected: { result: -8 } },
    { input: { a: -3, b: -3 }, expected: { result: 9 } },
    // Edge cases
    { input: { a: 0, b: 0 }, expected: { result: 0 } },
    // Adversarial - large numbers, edge cases
    { input: { a: 1e5, b: 1e5 }, expected: { result: 1e10 } },
    { input: { a: 1e-5, b: 1e-5 }, expected: { result: 1e-10 } },
    // Error cases - should handle gracefully
    { input: { a: null, b: 3 }, expected: null },
    { input: { a: "abc", b: 2 }, expected: null }
  ],

  "math.subtract": [
    // Normal cases
    { input: { a: 10, b: 3 }, expected: { result: 7 } },
    { input: { a: 5, b: 5 }, expected: { result: 0 } },
    { input: { a: 100, b: 50 }, expected: { result: 50 } },
    // Negative results
    { input: { a: 3, b: 10 }, expected: { result: -7 } },
    // Edge cases
    { input: { a: 0, b: 0 }, expected: { result: 0 } },
    // Error cases
    { input: { a: null, b: 3 }, expected: null },
    { input: { a: "abc", b: 2 }, expected: null }
  ],

  "math.divide": [
    // Normal cases
    { input: { a: 10, b: 2 }, expected: { result: 5 } },
    { input: { a: 20, b: 4 }, expected: { result: 5 } },
    { input: { a: 15, b: 3 }, expected: { result: 5 } },
    // Edge cases - division by zero should be handled (return NaN or throw)
    { input: { a: 10, b: 0 }, expected: null }, // Division by zero
    // Error cases
    { input: { a: null, b: 3 }, expected: null },
    { input: { a: "abc", b: 2 }, expected: null }
  ]
};

/**
 * Get test cases for a specific capability
 * @param {string} capability - e.g., "math.add"
 * @returns {Array} test cases with ground truth
 */
export function getTestCases(capability) {
  return groundTruth[capability] || [];
}

/**
 * Get normal test cases only (exclude edge case/error cases)
 * @param {string} capability
 * @returns {Array}
 */
export function getNormalTestCases(capability) {
  const cases = groundTruth[capability] || [];
  return cases.filter(c => c.expected !== null);
}

/**
 * Get edge case test cases only
 * @param {string} capability
 * @returns {Array}
 */
export function getEdgeCases(capability) {
  const cases = groundTruth[capability] || [];
  return cases.filter(c => c.expected === null);
}