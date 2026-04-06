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

/**
 * Generate random test cases for a capability
 * Used for adversarial testing and discovering edge cases
 * 
 * @param {string} capability - e.g., "math.add"
 * @param {number} count - Number of random cases to generate
 * @returns {Array} Array of random test cases
 */
export function generateRandomTestCases(capability, count = 5) {
  const cases = [];
  
  for (let i = 0; i < count; i++) {
    const testCase = generateRandomCase(capability);
    if (testCase) {
      cases.push(testCase);
    }
  }
  
  return cases;
}

/**
 * Generate a single random test case based on capability type
 */
function generateRandomCase(capability) {
  // Generate random numbers in various ranges
  const ranges = [
    // Small integers
    { min: -100, max: 100 },
    // Large integers  
    { min: -1e6, max: 1e6 },
    // Small decimals
    { min: -10, max: 10, decimals: true },
    // Edge values
    { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }
  ];
  
  const range = ranges[Math.floor(Math.random() * ranges.length)];
  const a = randomInRange(range);
  const b = randomInRange(range);
  
  // Calculate expected result based on capability
  let expected = null;
  let input = { a, b };
  
  if (capability === "math.add") {
    expected = { result: a + b };
  } else if (capability === "math.multiply") {
    expected = { result: a * b };
  } else if (capability === "math.subtract") {
    expected = { result: a - b };
  } else if (capability === "math.divide") {
    if (b === 0) {
      // Division by zero - expect error handling
      expected = null;
    } else {
      expected = { result: a / b };
    }
  }
  
  // 10% chance of edge case (null or invalid input)
  if (Math.random() < 0.1) {
    const edgeTypes = [
      { a: null, b: Math.floor(Math.random() * 10) },
      { a: Math.floor(Math.random() * 10), b: null },
      { a: "string", b: Math.floor(Math.random() * 10) },
      { a: Math.floor(Math.random() * 10), b: "string" },
      { a: undefined, b: Math.floor(Math.random() * 10) },
      { a: {}, b: Math.floor(Math.random() * 10) },
      { a: [], b: Math.floor(Math.random() * 10) }
    ];
    const edge = edgeTypes[Math.floor(Math.random() * edgeTypes.length)];
    input = edge;
    expected = null; // Edge cases expect null (error handling)
  }
  
  return { input, expected };
}

function randomInRange(range) {
  if (range.decimals) {
    return Math.round((Math.random() * (range.max - range.min) + range.min) * 100) / 100;
  }
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

/**
 * Generate edge case test cases (null, empty, extreme values)
 * 
 * @param {string} capability
 * @returns {Array} Array of edge case test cases
 */
export function generateEdgeCases(capability) {
  const edgeCases = [
    // Null inputs
    { input: { a: null, b: null }, expected: null },
    { input: { a: null, b: 5 }, expected: null },
    { input: { a: 5, b: null }, expected: null },
    
    // Undefined inputs
    { input: { a: undefined, b: 5 }, expected: null },
    { input: { a: 5, b: undefined }, expected: null },
    
    // Empty values
    { input: { a: "", b: 5 }, expected: null },
    { input: { a: 5, b: "" }, expected: null },
    
    // Extreme values
    { input: { a: Number.MAX_VALUE, b: 2 }, expected: null }, // Overflow
    { input: { a: Number.MIN_VALUE, b: 2 }, expected: null }, // Underflow
    { input: { a: Number.MAX_SAFE_INTEGER, b: 2 }, expected: null },
    
    // NaN
    { input: { a: NaN, b: 5 }, expected: null },
    { input: { a: 5, b: NaN }, expected: null },
    
    // Infinity
    { input: { a: Infinity, b: 5 }, expected: null },
    { input: { a: 5, b: Infinity }, expected: null },
    { input: { a: -Infinity, b: 5 }, expected: null },
    
    // Objects and arrays (wrong types)
    { input: { a: {}, b: 5 }, expected: null },
    { input: { a: [], b: 5 }, expected: null },
    { input: { a: { x: 1 }, b: 5 }, expected: null },
    
    // Special characters
    { input: { a: "NaN", b: 5 }, expected: null },
    { input: { a: "Infinity", b: 5 }, expected: null },
    { input: { a: "true", b: 5 }, expected: null },
    { input: { a: "false", b: 5 }, expected: null }
  ];
  
  // Filter based on capability
  if (capability === "math.divide") {
    // Add division-specific edge cases
    edgeCases.push(
      { input: { a: 10, b: 0 }, expected: null }, // Division by zero
      { input: { a: 0, b: 0 }, expected: null }    // 0/0 = NaN
    );
  }
  
  return edgeCases;
}

/**
 * Get all test cases including generated ones
 * Combines static ground truth with random + edge cases
 * 
 * @param {string} capability
 * @param options - { includeRandom: boolean, includeEdge: boolean }
 * @returns {Array} Combined test cases
 */
export function getAllTestCases(capability, options = {}) {
  const { includeRandom = false, includeEdge = false } = options;
  
  let cases = [...groundTruth[capability] || []];
  
  if (includeRandom) {
    const randomCases = generateRandomTestCases(capability, 3);
    cases = [...cases, ...randomCases];
  }
  
  if (includeEdge) {
    const edgeCases = generateEdgeCases(capability);
    cases = [...cases, ...edgeCases];
  }
  
  return cases;
}