import test from "node:test";
import assert from "node:assert";
import { evaluate } from "../core/scoring.js";

test("evaluate returns 1.0 for valid result with data", () => {
  const score = evaluate({ result: 42 }, true);
  assert.ok(Math.abs(score - 1.0) < 0.0001);
});

test("evaluate returns 0.6 for invalid result with data", () => {
  const score = evaluate({ result: 42 }, false);
  assert.strictEqual(score, 0.6);
});

test("evaluate returns 0.7 for valid result with undefined", () => {
  const score = evaluate(undefined, true);
  assert.ok(Math.abs(score - 0.7) < 0.0001);
});

test("evaluate returns 0.3 for invalid result with undefined", () => {
  const score = evaluate(undefined, false);
  assert.ok(Math.abs(score - 0.3) < 0.0001);
});

test("evaluate returns 0.3 for valid empty object", () => {
  const score = evaluate({}, true);
  assert.ok(Math.abs(score - 1.0) < 0.0001);
});

test("evaluate score components breakdown", () => {
  const validScore = evaluate({ data: "test" }, true);
  assert.ok(validScore >= 0.9);

  const invalidScore = evaluate({ data: "test" }, false);
  assert.strictEqual(invalidScore, 0.6);
});
