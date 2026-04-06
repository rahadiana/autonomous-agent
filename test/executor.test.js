import test from "node:test";
import assert from "node:assert";
import { runSkill } from "../core/executor.js";

test("runSkill executes basic logic and returns output", async () => {
  const skill = {
    logic: "output.result = input.a + input.b;"
  };

  const result = await runSkill(skill, { a: 10, b: 5 });

  assert.strictEqual(result.result, 15);
});

test("runSkill handles string operations", async () => {
  const skill = {
    logic: "output.greeting = 'Hello, ' + input.name + '!';"
  };

  const result = await runSkill(skill, { name: "World" });

  assert.strictEqual(result.greeting, "Hello, World!");
});

test("runSkill handles conditional logic", async () => {
  const skill = {
    logic: `
      if (input.value > 0) {
        output.status = "positive";
      } else {
        output.status = "non-positive";
      }
    `
  };

  const pos = await runSkill(skill, { value: 42 });
  assert.strictEqual(pos.status, "positive");

  const neg = await runSkill(skill, { value: -1 });
  assert.strictEqual(neg.status, "non-positive");
});

test("runSkill handles array operations", async () => {
  const skill = {
    logic: "output.sum = input.numbers.reduce((a, b) => a + b, 0);"
  };

  const result = await runSkill(skill, { numbers: [1, 2, 3, 4, 5] });

  assert.strictEqual(result.sum, 15);
});

test("runSkill handles memory object", async () => {
  const skill = {
    logic: `
      memory.counter = (memory.counter || 0) + 1;
      output.count = memory.counter;
    `
  };

  const result = await runSkill(skill, {});

  assert.strictEqual(result.count, 1);
});

test("runSkill throws on invalid JS syntax", async () => {
  const skill = {
    logic: "output.result = input.a + ;"
  };

  await assert.rejects(
    () => runSkill(skill, { a: 1 }),
    SyntaxError
  );
});

test("runSkill throws on undefined variable access", async () => {
  const skill = {
    logic: "output.result = nonexistentFunction();"
  };

  await assert.rejects(
    () => runSkill(skill, {})
  );
});

test("runSkill handles nested object output", async () => {
  const skill = {
    logic: `
      output.data = {
        nested: {
          value: input.x * 2
        },
        list: [input.x, input.x * 2, input.x * 3]
      };
    `
  };

  const result = await runSkill(skill, { x: 3 });

  assert.strictEqual(result.data.nested.value, 6);
  assert.ok(Array.isArray(result.data.list));
  assert.strictEqual(result.data.list.length, 3);
  assert.strictEqual(result.data.list[0], 3);
  assert.strictEqual(result.data.list[1], 6);
  assert.strictEqual(result.data.list[2], 9);
});
