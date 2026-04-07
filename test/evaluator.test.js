import { describe, it } from "node:test";
import assert from "node:assert";
import { Evaluator } from "../services/evaluator.js";

describe("Evaluator", () => {
  const evaluator = new Evaluator();

  it("should evaluate valid result", () => {
    const result = { result: 5 };
    const validation = { valid: true };
    const skill = { name: "test", capability: "math.add", logic: "..." };
    
    const score = evaluator.evaluate(result, validation, skill);
    
    assert.ok(score.score >= 0.8);
    assert.strictEqual(score.passed, true);
  });

  it("should reject invalid schema", () => {
    const result = { result: 5 };
    const validation = { valid: false, errors: ["error"] };
    const skill = { name: "test", capability: "math.add", logic: "..." };
    
    const score = evaluator.evaluate(result, validation, skill);
    
    assert.strictEqual(score.passed, false);
  });

  it("should check threshold", () => {
    assert.strictEqual(evaluator.shouldAccept(0.9), true);
    assert.strictEqual(evaluator.shouldAccept(0.7), false);
  });

  it("should check retry condition", () => {
    assert.strictEqual(evaluator.canRetry(0), true);
    assert.strictEqual(evaluator.canRetry(2), true);
    assert.strictEqual(evaluator.canRetry(3), false);
  });
});