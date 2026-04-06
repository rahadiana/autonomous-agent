import test from "node:test";
import assert from "node:assert";
import { banditScore, selectSkill } from "../core/bandit.js";

test("banditScore returns higher score for unexplored skills", () => {
  const skillA = { score: 0.5, usage_count: 0 };
  const skillB = { score: 0.5, usage_count: 100 };
  const total = 100;

  const scoreA = banditScore(skillA, total);
  const scoreB = banditScore(skillB, total);

  assert.ok(scoreA > scoreB, "Unexplored skill should have higher bandit score");
});

test("banditScore returns higher score for higher base score when usage is equal", () => {
  const skillA = { score: 0.8, usage_count: 10 };
  const skillB = { score: 0.3, usage_count: 10 };
  const total = 20;

  const scoreA = banditScore(skillA, total);
  const scoreB = banditScore(skillB, total);

  assert.ok(scoreA > scoreB, "Higher base score should win when usage is equal");
});

test("banditScore exploration decreases as usage increases", () => {
  const skill1 = { score: 0.5, usage_count: 0 };
  const skill2 = { score: 0.5, usage_count: 100 };
  const skill3 = { score: 0.5, usage_count: 10000 };

  const total = 10000;

  const score0 = banditScore(skill1, total);
  const score100 = banditScore(skill2, total);
  const score10000 = banditScore(skill3, total);

  assert.ok(score0 > score100, "Exploration term decreases with usage");
  assert.ok(score100 > score10000, "Exploration term approaches zero with high usage");
});

test("banditScore balances exploit vs explore based on c parameter", () => {
  const highScoreUnexplored = { score: 0.9, usage_count: 0 };
  const lowScoreExplored = { score: 0.3, usage_count: 100 };
  const total = 100;

  const s1 = banditScore(highScoreUnexplored, total);
  const s2 = banditScore(lowScoreExplored, total);

  assert.ok(s1 > s2, "High score with zero usage beats low score with high usage");
});

test("selectSkill picks the skill with highest bandit score", () => {
  const skills = [
    { score: 0.5, usage_count: 0 },
    { score: 0.7, usage_count: 0 },
    { score: 0.3, usage_count: 0 }
  ];

  const selected = selectSkill(skills);

  assert.strictEqual(selected.score, 0.7);
});

test("selectSkill prefers unexplored skills when scores are equal", () => {
  const skills = [
    { score: 0.5, usage_count: 0 },
    { score: 0.5, usage_count: 50 },
    { score: 0.5, usage_count: 100 }
  ];

  const selected = selectSkill(skills);

  assert.strictEqual(selected.usage_count, 0);
});

test("selectSkill returns null for empty array", () => {
  const selected = selectSkill([]);
  assert.strictEqual(selected, null);
});

test("selectSkill returns the only skill in array", () => {
  const skills = [{ score: 0.5, usage_count: 10 }];
  const selected = selectSkill(skills);
  assert.strictEqual(selected, skills[0]);
});
