import { test, describe } from "node:test";
import assert from "node:assert";
import { TestRunner } from "../services/testRunner.js";

describe("TestRunner", () => {
  test("should generate test cases for math.add", () => {
    const runner = new TestRunner();
    const skill = { capability: "math.add" };
    const cases = runner.generateTestCases(skill);
    assert.ok(cases.length > 0, "generates cases");
    console.log("TEST: Generate test cases OK");
  });

  test("should evaluate results", () => {
    const runner = new TestRunner();
    const results = [
      { passed: true },
      { passed: true },
      { passed: false }
    ];
    const evalResult = runner.evaluate(results);
    assert.strictEqual(evalResult.score, 2/3);
    assert.strictEqual(evalResult.passed, 2);
    assert.strictEqual(evalResult.valid, false);
    console.log("TEST: Evaluate results OK");
  });

  test("should generate random cases", () => {
    const runner = new TestRunner();
    const cases = runner.generateRandomCases("unknown.capability", 5);
    assert.strictEqual(cases.length, 5);
    console.log("TEST: Random case generation OK");
  });
});