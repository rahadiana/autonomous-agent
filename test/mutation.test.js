import test from "node:test";
import assert from "node:assert";
import { mutateSkill } from "../core/mutation.js";

test("mutateSkill returns clone with same structure", () => {
  const skill = {
    logic: [
      { op: "add", value: 10 },
      { op: "subtract", value: 5 }
    ],
    output_schema: { type: "object" }
  };

  const mutated = mutateSkill(skill);

  assert.notStrictEqual(mutated, skill);
  assert.deepStrictEqual(mutated.output_schema, skill.output_schema);
});

test("mutateSkill can change add to subtract", () => {
  let foundSubtract = false;

  for (let i = 0; i < 100; i++) {
    const skill = {
      logic: [{ op: "add", value: 10 }],
      output_schema: {}
    };

    const mutated = mutateSkill(skill);

    if (mutated.logic[0].op === "subtract") {
      foundSubtract = true;
      break;
    }
  }

  assert.ok(foundSubtract, "Mutation should sometimes change add to subtract");
});

test("mutateSkill handles empty logic array", () => {
  const skill = {
    logic: [],
    output_schema: {}
  };

  const mutated = mutateSkill(skill);

  assert.deepStrictEqual(mutated.logic, []);
});

test("mutateSkill handles string logic (passthrough)", () => {
  const skill = {
    logic: "output.result = input.a + input.b;",
    output_schema: {}
  };

  const mutated = mutateSkill(skill);

  assert.strictEqual(mutated.logic, skill.logic);
});

test("mutateSkill does not mutate original", () => {
  const skill = {
    logic: [{ op: "add", value: 10 }],
    output_schema: { type: "object" }
  };

  mutateSkill(skill);

  assert.strictEqual(skill.logic[0].op, "add");
});
