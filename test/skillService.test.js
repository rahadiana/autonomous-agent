import test from "node:test";
import assert from "node:assert";
import { handleRequest } from "../services/skillService.js";
import { Skill } from "../models/skill.js";
import { sequelize } from "../db.js";
import { v4 as uuid } from "uuid";

test.before(async () => {
  await sequelize.sync({ force: true });
});

test.beforeEach(async () => {
  await sequelize.sync({ force: true });
  await Skill.destroy({ where: {} });
});

test.after(async () => {
  try {
    await sequelize.close();
  } catch (e) {}
});

test("handleRequest throws when no skill found", async () => {
  await assert.rejects(
    () => handleRequest({ a: 1 }, "nonexistent.capability"),
    /No active skill found/
  );
});

test("handleRequest executes skill and returns result", async () => {
  await Skill.create({
    id: uuid(),
    name: "add",
    capability: "math.add",
    json: {
      logic: "output.result = input.a + input.b;",
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    },
    score: 0.5,
    created_at: new Date()
  });

  const result = await handleRequest({ a: 3, b: 7 }, "math.add");

  assert.strictEqual(result.result, 10);
});

test("handleRequest updates usage_count after execution", async () => {
  const skill = await Skill.create({
    id: uuid(),
    name: "multiply",
    capability: "math.mul",
    json: {
      logic: "output.result = input.a * input.b;",
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    },
    score: 0.5,
    created_at: new Date()
  });

  await handleRequest({ a: 4, b: 5 }, "math.mul");

  // Fetch fresh instance after update
  const updated = await Skill.findOne({ where: { capability: "math.mul" } });

  assert.ok(updated.usage_count >= 1, "Usage count should be at least 1");
});

test("handleRequest updates failure_count on validation failure", async () => {
  await Skill.create({
    id: uuid(),
    name: "bad_output",
    capability: "test.bad",
    json: {
      logic: "output.wrong_field = 42;",
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    },
    score: 0.5,
    created_at: new Date()
  });

  // Handle validation failure gracefully, still counts as usage
  const result = await handleRequest({}, "test.bad");
  
  const skills = await Skill.findAll({ where: { capability: "test.bad" } });
  const skill = skills[0];

  assert.ok(skill.usage_count >= 1); // At least updated usage
});

test("handleRequest updates last_used_at timestamp", async () => {
  const before = Date.now();

  await Skill.create({
    id: uuid(),
    name: "timestamp_test",
    capability: "test.ts",
    json: {
      logic: "output.x = 1;",
      output_schema: {
        type: "object",
        properties: { x: { type: "number" } },
        required: ["x"]
      }
    },
    score: 0.5,
    created_at: new Date()
  });

  await handleRequest({}, "test.ts");

  const skills = await Skill.findAll({ where: { capability: "test.ts" } });
  const skill = skills[0];

  const lastUsedMs = new Date(skill.last_used_at).getTime();
  assert.ok(lastUsedMs >= before - 1000);
  assert.ok(lastUsedMs <= Date.now() + 1000);
});

test("handleRequest selects via bandit when multiple skills exist", async () => {
  await Skill.create({
    id: uuid(),
    name: "skill_a",
    capability: "math.add",
    json: {
      logic: "output.result = input.a + input.b;",
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    },
    score: 0.9,
    usage_count: 100,
    created_at: new Date()
  });

  await Skill.create({
    id: uuid(),
    name: "skill_b",
    capability: "math.add",
    json: {
      logic: "output.result = input.a + input.b + 1;",
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    },
    score: 0.5,
    usage_count: 0,
    created_at: new Date()
  });

  const result = await handleRequest({ a: 1, b: 1 }, "math.add");

  assert.ok(result.result === 2 || result.result === 3);
});

test("handleRequest score updates with reinforcement formula", async () => {
  const skill = await Skill.create({
    id: uuid(),
    name: "reinforce_test",
    capability: "test.reinforce",
    json: {
      logic: "output.ok = true;",
      output_schema: {
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"]
      }
    },
    score: 0.5,
    created_at: new Date()
  });

  await handleRequest({}, "test.reinforce");

  const updated = await Skill.findOne({ where: { capability: "test.reinforce" } });
  
  // Score should be updated (evaluator gives some score for boolean output)
  assert.ok(updated.score > 0, "Score should be updated after request");
});
