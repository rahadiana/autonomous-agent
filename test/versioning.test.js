import test from "node:test";
import assert from "node:assert";
import { createVersion } from "../core/versioning.js";
import { Skill } from "../models/skill.js";
import { sequelize } from "../db.js";

test.before(async () => {
  await sequelize.sync({ force: true });
});

test.beforeEach(async () => {
  await sequelize.sync({ force: true });
});

test.after(async () => {
  try {
    await sequelize.close();
  } catch (e) {}
});

test("createVersion creates a new skill with incremented version", async () => {
  const parent = await Skill.create({
    id: "a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5",
    name: "test_skill",
    capability: "math.add",
    json: { logic: "output.result = input.a + input.b;" },
    score: 0.7,
    version: 1
  });

  const newJson = { logic: "output.result = input.a + input.b + 1;" };

  const child = await createVersion(parent, newJson);

  assert.strictEqual(child.version, 2);
  assert.strictEqual(child.parent_id, parent.id);
  assert.strictEqual(child.name, parent.name);
  assert.strictEqual(child.capability, parent.capability);
  assert.strictEqual(child.score, parent.score);
  assert.deepStrictEqual(child.json, newJson);
});

test("createVersion generates unique id for each version", async () => {
  const parent = await Skill.create({
    id: "b2b2b2b2-c3c3-d4d4-e5e5-f6f6f6f6f6f6",
    name: "test_skill",
    capability: "math.add",
    json: { logic: "output.result = input.a + input.b;" },
    score: 0.5,
    version: 1
  });

  const v1 = await createVersion(parent, { logic: "output.x = 1;" });
  const v2 = await createVersion(parent, { logic: "output.x = 2;" });

  assert.notStrictEqual(v1.id, v2.id);
});

test("createVersion chains versions correctly", async () => {
  const parent = await Skill.create({
    id: "c3c3c3c3-d4d4-e5e5-f6f6-a7a7a7a7a7a7",
    name: "chain_test",
    capability: "test",
    json: { logic: "output.x = 0;" },
    score: 0.5,
    version: 1
  });

  const v1 = await createVersion(parent, { logic: "output.x = 1;" });
  const v2 = await createVersion(v1, { logic: "output.x = 2;" });
  const v3 = await createVersion(v2, { logic: "output.x = 3;" });

  assert.strictEqual(v1.version, 2);
  assert.strictEqual(v2.version, 3);
  assert.strictEqual(v3.version, 4);

  assert.strictEqual(v1.parent_id, parent.id);
  assert.strictEqual(v2.parent_id, v1.id);
  assert.strictEqual(v3.parent_id, v2.id);
});

test("createVersion sets created_at timestamp", async () => {
  const parent = await Skill.create({
    id: "d4d4d4d4-e5e5-f6f6-a7a7-b8b8b8b8b8b8",
    name: "timestamp_test",
    capability: "test",
    json: { logic: "output.x = 1;" },
    score: 0.5,
    version: 1
  });

  const before = Date.now();
  const child = await createVersion(parent, { logic: "output.x = 2;" });
  const after = Date.now();

  const createdAtMs = new Date(child.created_at).getTime();

  assert.ok(createdAtMs >= before - 1000);
  assert.ok(createdAtMs <= after + 1000);
});
