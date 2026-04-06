import test from "node:test";
import assert from "node:assert";
import { getPruningStats, pruneSkills } from "../core/pruning.js";
import { Skill } from "../models/skill.js";
import { sequelize } from "../db.js";

test("getPruningStats returns valid structure", async () => {
  await sequelize.sync({ force: true });
  
  // Create some test skills
  await Skill.create({
    id: "test-1",
    name: "good-skill",
    capability: "math.add",
    json: { logic: "output.result = input.a + input.b;" },
    score: 0.9,
    usage_count: 10,
    status: "active"
  });

  await Skill.create({
    id: "test-2",
    name: "bad-skill",
    capability: "math.add",
    json: { logic: "output.result = input.a - input.b;" },
    score: 0.1,
    usage_count: 10,
    status: "active"
  });

  const stats = await getPruningStats();
  
  assert.ok(typeof stats.total.active === "number");
  assert.ok(typeof stats.total.inactive === "number");
  assert.ok(typeof stats.survivalRate === "string");
  assert.ok(stats.capabilityCoverage.total > 0);
});

test("pruneSkills respects minUsage protection", async () => {
  await sequelize.sync({ force: true });
  
  // Create a low-scoring skill but with low usage (should be protected)
  await Skill.create({
    id: "test-3",
    name: "new-bad-skill",
    capability: "math.multiply",
    json: { logic: "output.result = input.a;" },
    score: 0.2,
    usage_count: 3, // Less than minUsageForPrune (5)
    status: "active"
  });

  // Create a low-scoring skill with high usage (should be pruned)
  await Skill.create({
    id: "test-4",
    name: "old-bad-skill",
    capability: "math.multiply",
    json: { logic: "output.result = input.a - input.b;" },
    score: 0.2,
    usage_count: 10,
    status: "active"
  });

  // Need a "good" skill to keep capability alive
  await Skill.create({
    id: "test-5",
    name: "good-multiply-skill",
    capability: "math.multiply",
    json: { logic: "output.result = input.a * input.b;" },
    score: 0.9,
    usage_count: 10,
    status: "active"
  });

  const result = await pruneSkills();
  
  console.log("Pruning result:", result.summary);
  
  // The new-bad-skill should be protected (usage < 5)
  // The old-bad-skill should be pruned
  const newSkill = await Skill.findByPk("test-3");
  const oldSkill = await Skill.findByPk("test-4");
  
  assert.strictEqual(newSkill.status, "active", "New skill should remain active");
  assert.strictEqual(oldSkill.status, "inactive", "Old bad skill should be pruned");
});

test("pruneSkills ensures capability safety", async () => {
  await sequelize.sync({ force: true });
  
  // Create only one skill for math.subtract (should NOT be pruned even if low score)
  await Skill.create({
    id: "test-6",
    name: "only-subtract-skill",
    capability: "math.subtract",
    json: { logic: "output.result = input.a - input.b;" },
    score: 0.25,
    usage_count: 10,
    status: "active"
  });

  const result = await pruneSkills();
  
  // The only subtract skill should NOT be pruned (capability safety)
  const subSkill = await Skill.findByPk("test-6");
  assert.strictEqual(subSkill.status, "active", "Only skill in capability should not be pruned");
});

test("getPruningStats shows score distribution", async () => {
  await sequelize.sync({ force: true });
  
  // Create skills in different score ranges
  await Skill.create({
    id: "test-7",
    name: "high-score",
    capability: "math.add",
    json: {},
    score: 0.9,
    usage_count: 10,
    status: "active"
  });

  await Skill.create({
    id: "test-8",
    name: "mid-score",
    capability: "math.add",
    json: {},
    score: 0.6,
    usage_count: 10,
    status: "active"
  });

  await Skill.create({
    id: "test-9",
    name: "low-score",
    capability: "math.multiply",
    json: {},
    score: 0.2,
    usage_count: 10,
    status: "active"
  });

  const stats = await getPruningStats();
  
  console.log("Score distribution:", stats.scoreDistribution);
  
  assert.ok(stats.scoreDistribution["0.85-1.0"] >= 1);
  assert.ok(stats.scoreDistribution["0.5-0.7"] >= 1);
  assert.ok(stats.scoreDistribution["0.0-0.3"] >= 1);
});