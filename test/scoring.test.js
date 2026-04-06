import test from "node:test";
import assert from "node:assert";
import { evaluate, scoreFromEvaluation } from "../core/scoring.js";

test("evaluate returns 1.0 for valid result", () => {
  const score = evaluate({ result: 42 }, true);
  assert.strictEqual(score, 1.0);
});

test("evaluate returns 0.0 for invalid result", () => {
  const score = evaluate({ result: 42 }, false);
  assert.strictEqual(score, 0.0);
});

test("scoreFromEvaluation extracts score from eval result", () => {
  const score = scoreFromEvaluation({ score: 0.85, accuracy: 0.75 });
  assert.strictEqual(score, 0.85);
});

test("scoreFromEvaluation handles null", () => {
  const score = scoreFromEvaluation(null);
  assert.strictEqual(score, 0);
});

test("scoreFromEvaluation handles missing score", () => {
  const score = scoreFromEvaluation({ accuracy: 0.75 });
  assert.strictEqual(score, 0);
});