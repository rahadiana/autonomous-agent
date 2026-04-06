import test from "node:test";
import assert from "node:assert";
import { applyDecay } from "../core/decay.js";
import { Skill } from "../models/skill.js";
import { sequelize } from "../db.js";

test.before(async () => {
  await sequelize.sync({ force: true });
});

test.after(async () => {
  try {
    await sequelize.close();
  } catch (e) {}
});

test.beforeEach(async () => {
  try {
    await sequelize.sync({ force: true });
  } catch (e) {
    await sequelize.sync({ force: true });
  }
  await Skill.destroy({ where: {} });
});

test("applyDecay reduces score for old skills", async () => {
  const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const skill = await Skill.create({
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "test_skill",
    capability: "test",
    json: { logic: "output.x = 1;" },
    score: 0.9,
    last_used_at: oldDate
  });

  await applyDecay();

  const updated = await Skill.findByPk(skill.id);

  assert.ok(updated.score < 0.9, "Score should decay after 30 days");
});

test("applyDecay does not affect skills without last_used_at", async () => {
  const skill = await Skill.create({
    id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    name: "unused_skill",
    capability: "test",
    json: { logic: "output.x = 1;" },
    score: 0.8,
    last_used_at: null
  });

  await applyDecay();

  const updated = await Skill.findByPk(skill.id);

  assert.strictEqual(updated.score, 0.8);
});

test("applyDecay applies stronger decay for older skills", async () => {
  await sequelize.sync({ force: true });
  await Skill.destroy({ where: {} });

  const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
  const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const skillRecent = await Skill.create({
    id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    name: "recent",
    capability: "test",
    json: { logic: "output.x = 1;" },
    score: 0.9,
    last_used_at: recent
  });

  const skillOld = await Skill.create({
    id: "d4e5f6a7-b8c9-0123-defa-234567890123",
    name: "old",
    capability: "test",
    json: { logic: "output.x = 1;" },
    score: 0.9,
    last_used_at: old
  });

  await applyDecay();

  const updatedRecent = await Skill.findByPk(skillRecent.id);
  const updatedOld = await Skill.findByPk(skillOld.id);

  assert.ok(updatedRecent, "Recent skill should exist");
  assert.ok(updatedOld, "Old skill should exist");
  assert.ok(updatedRecent.score > updatedOld.score, "Recent skill should have higher score after decay");
});

test("applyDecay handles empty database", async () => {
  await applyDecay();
  assert.ok(true);
});
