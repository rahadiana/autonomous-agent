import test from "node:test";
import assert from "node:assert";
import { runTests, runEvaluation } from "../core/testRunner.js";

test("runTests returns correct passed count for valid skills", async () => {
  const skill = {
    logic: "output.result = input.a + input.b;",
    output_schema: {
      type: "object",
      properties: {
        result: { type: "number" }
      },
      required: ["result"]
    }
  };

  const testCases = [
    { input: { a: 1, b: 2 } },
    { input: { a: 5, b: 3 } },
    { input: { a: -1, b: 1 } }
  ];

  const result = await runTests(skill, testCases);

  assert.strictEqual(result.passed, 3);
  assert.strictEqual(result.total, 3);
  assert.strictEqual(result.score, 1.0);
});

test("runTests returns zero for invalid schema", async () => {
  const skill = {
    logic: "output.wrong = 42;",
    output_schema: {
      type: "object",
      properties: {
        result: { type: "number" }
      },
      required: ["result"]
    }
  };

  const testCases = [
    { input: {} }
  ];

  const result = await runTests(skill, testCases);

  assert.strictEqual(result.passed, 0);
  assert.strictEqual(result.total, 1);
});

test("runTests handles runtime errors gracefully", async () => {
  const skill = {
    logic: "output.result = nonexistentVariable;",
    output_schema: {
      type: "object",
      properties: { result: { type: "number" } },
      required: ["result"]
    }
  };

  const testCases = [{ input: {} }];
  const result = await runTests(skill, testCases);

  assert.strictEqual(result.total, 1);
  assert.ok(result.results[0].error !== undefined);
});

test("runTests handles empty test cases", async () => {
  const skill = { logic: "output.x = 1;", output_schema: {} };
  const result = await runTests(skill, []);

  assert.strictEqual(result.passed, 0);
  assert.strictEqual(result.total, 0);
  assert.strictEqual(result.score, 0);
});

test("runEvaluation returns testScore and avgScore", async () => {
  const skill = {
    logic: "output.result = input.x * 2;",
    output_schema: {
      type: "object",
      properties: { result: { type: "number" } },
      required: ["result"]
    }
  };

  const testCases = [
    { input: { x: 5 } },
    { input: { x: 10 } }
  ];

  const result = await runEvaluation(skill, testCases);

  assert.ok(typeof result.testScore === "number");
  assert.ok(typeof result.avgScore === "number");
  assert.strictEqual(result.totalTests, 2);
  assert.strictEqual(result.passedTests, 2);
});

test("runTests records each test result", async () => {
  const skill = {
    logic: "output.result = input.value + 1;",
    output_schema: {
      type: "object",
      properties: { result: { type: "number" } },
      required: ["result"]
    }
  };

  const testCases = [
    { input: { value: 1 } },
    { input: { value: 2 } }
  ];

  const result = await runTests(skill, testCases);

  assert.strictEqual(result.results.length, 2);
  assert.strictEqual(result.results[0].input.value, 1);
  assert.strictEqual(result.results[1].input.value, 2);
});