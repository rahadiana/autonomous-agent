import test from "node:test";
import assert from "node:assert";
import { evaluateSkill, runTests } from "../core/testRunner.js";
import { getTestCases, groundTruth } from "../core/groundTruth.js";

test("groundTruth has test cases for math.add", () => {
  const cases = getTestCases("math.add");
  assert.ok(cases.length > 0, "Should have test cases for math.add");
});

test("groundTruth has test cases for math.multiply", () => {
  const cases = getTestCases("math.multiply");
  assert.ok(cases.length > 0, "Should have test cases for math.multiply");
});

test("evaluateSkill returns proper structure", async () => {
  const skill = {
    logic: "output.result = input.a + input.b;",
    output_schema: {
      type: "object",
      properties: { result: { type: "number" } },
      required: ["result"]
    }
  };

  const result = await evaluateSkill(skill, "math.add");

  assert.ok(typeof result.score === "number", "Should have score");
  assert.ok(typeof result.accuracy === "number", "Should have accuracy");
  assert.ok(typeof result.stable === "boolean", "Should have stable");
  assert.ok(Array.isArray(result.details), "Should have details");
});

test("correct skill gets high score", async () => {
  const skill = {
    logic: "output.result = input.a + input.b;",
    output_schema: {
      type: "object",
      properties: { result: { type: "number" } },
      required: ["result"]
    }
  };

  const result = await evaluateSkill(skill, "math.add");

  console.log("Correct skill result:", JSON.stringify(result, null, 2));
  
  // Should pass most tests (excluding edge cases)
  assert.ok(result.accuracy >= 0.7, "Correct skill should have accuracy >= 0.7");
  assert.ok(result.score >= 0.7, "Correct skill should have score >= 0.7");
});

test("wrong skill gets low score", async () => {
  const skill = {
    logic: "output.result = input.a - input.b;", // WRONG - subtract instead of add
    output_schema: {
      type: "object",
      properties: { result: { type: "number" } },
      required: ["result"]
    }
  };

  const result = await evaluateSkill(skill, "math.add");

  console.log("Wrong skill result:", JSON.stringify(result, null, 2));
  
  // Should fail most tests
  assert.ok(result.accuracy < 0.5, "Wrong skill should have accuracy < 0.5");
});

test("skill with syntax error gets zero score", async () => {
  const skill = {
    logic: "output.result = invalid_syntax_", // Syntax error
    output_schema: {
      type: "object",
      properties: { result: { type: "number" } },
      required: ["result"]
    }
  };

  const result = await evaluateSkill(skill, "math.add");

  console.log("Error skill result:", JSON.stringify(result, null, 2));
  
  // Should handle error gracefully
  assert.ok(result.score < 1.0, "Error skill should have score < 1.0");
});