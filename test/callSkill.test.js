import test from "node:test";
import assert from "node:assert";
import { runSkill, setSkillRunner } from "../core/executor.js";
import { SkillRunner, createSkillRunner } from "../services/skillRunner.js";

test.beforeEach(() => {
  setSkillRunner(null);
});

test("call_skill executes nested skill", async () => {
  const runner = createSkillRunner({
    double: {
      logic: [
        { op: "set", path: "result", value: 10 }
      ],
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    }
  });

  setSkillRunner(runner);

  const skill = {
    logic: [
      { op: "call_skill", skill: "double", input: {}, to: "doubled" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.doubled.result, 10);
});

test("call_skill passes input correctly", async () => {
  const runner = createSkillRunner({
    add: {
      logic: [
        { op: "set", path: "sum", value: 30 }
      ],
      output_schema: {
        type: "object",
        properties: { sum: { type: "number" } },
        required: ["sum"]
      }
    }
  });

  setSkillRunner(runner);

  const skill = {
    logic: [
      { op: "call_skill", skill: "add", input: { a: 10, b: 20 }, to: "result" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result.sum, 30);
});

test("call_skill throws when skill not found", async () => {
  const runner = createSkillRunner({});
  setSkillRunner(runner);

  const skill = {
    logic: [
      { op: "call_skill", skill: "nonexistent", input: {}, to: "result" }
    ]
  };

  await assert.rejects(
    () => runSkill(skill, {}),
    /Skill not found/
  );
});

test("call_skill uses memory reference for skill name", async () => {
  const runner = createSkillRunner({
    triple: {
      logic: [
        { op: "set", path: "result", value: 21 }
      ],
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    }
  });

  setSkillRunner(runner);

  const skill = {
    logic: [
      { op: "set", path: "memory.skillName", value: "triple" },
      { op: "call_skill", skill: "skillName", input: {}, to: "result" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result.result, 21);
});

test("call_skill_map executes skill for each item in array", async () => {
  const runner = createSkillRunner({
    double: {
      logic: [
        { op: "set", path: "result", value: 1 }
      ],
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    }
  });

  setSkillRunner(runner);

  const skill = {
    logic: [
      { op: "set", path: "memory.numbers", value: [1, 2, 3, 4, 5] },
      { op: "call_skill_map", collection: "numbers", skill: "double", input_key: "item", to: "results" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.results.length, 5);
});

test("call_skill_map with empty array", async () => {
  const runner = createSkillRunner({
    double: {
      logic: [
        { op: "multiply", a: "input.item", b: 2, to: "result" }
      ],
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    }
  });

  setSkillRunner(runner);

  const skill = {
    logic: [
      { op: "set", path: "memory.empty", value: [] },
      { op: "call_skill_map", collection: "empty", skill: "double", input_key: "item", to: "results" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.deepStrictEqual(result.results, []);
});

test("call_skill chain - output of one becomes input of another", async () => {
  const runner = createSkillRunner({
    add1: {
      logic: [
        { op: "set", path: "result", value: 6 }
      ],
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    },
    multiply2: {
      logic: [
        { op: "set", path: "result", value: 12 }
      ],
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    }
  });

  setSkillRunner(runner);

  const skill = {
    logic: [
      { op: "call_skill", skill: "add1", input: {}, to: "step1" },
      { op: "call_skill", skill: "multiply2", input: {}, to: "step2" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.step1.result, 6);
  assert.strictEqual(result.step2.result, 12);
});

test("call_skill validates output schema", async () => {
  const runner = createSkillRunner({
    bad: {
      logic: [
        { op: "set", path: "result", value: "wrong type" }
      ],
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    }
  });

  setSkillRunner(runner);

  const skill = {
    logic: [
      { op: "call_skill", skill: "bad", input: {}, to: "result" }
    ]
  };

  await assert.rejects(
    () => runSkill(skill, {}),
    /Output validation failed/
  );
});

test("SkillRunner can register and list skills", () => {
  const runner = createSkillRunner();
  runner.register("test1", { logic: "output.x = 1;" });
  runner.register("test2", { logic: "output.y = 2;" });

  assert.strictEqual(runner.has("test1"), true);
  assert.strictEqual(runner.has("test2"), true);
  assert.strictEqual(runner.has("test3"), false);
  assert.deepStrictEqual(runner.list(), ["test1", "test2"]);
});

test("call_skill throws when SkillRunner not configured", async () => {
  const skill = {
    logic: [
      { op: "call_skill", skill: "some", input: {}, to: "result" }
    ]
  };

  await assert.rejects(
    () => runSkill(skill, {}),
    /SkillRunner not configured/
  );
});

test("call_skill_map throws when SkillRunner not configured", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.items", value: [1, 2, 3] },
      { op: "call_skill_map", collection: "items", skill: "some", input_key: "item", to: "results" }
    ]
  };

  await assert.rejects(
    () => runSkill(skill, {}),
    /SkillRunner not configured/
  );
});

test("call_skill works with multiple steps after", async () => {
  const runner = createSkillRunner({
    square: {
      logic: [
        { op: "set", path: "result", value: 9 }
      ],
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    }
  });

  setSkillRunner(runner);

  const skill = {
    logic: [
      { op: "call_skill", skill: "square", input: {}, to: "squared" },
      { op: "set", path: "final", value: 10 }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.squared.result, 9);
  assert.strictEqual(result.final, 10);
});