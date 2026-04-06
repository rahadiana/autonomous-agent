import test from "node:test";
import assert from "node:assert";
import { buildTestCases, buildEdgeCases, buildRandomFuzz } from "../core/testBuilder.js";

test("buildTestCases returns at least empty input test", () => {
  const skill = { output_schema: {} };
  const tests = buildTestCases(skill);

  assert.ok(tests.length >= 1);
  assert.deepStrictEqual(tests[0].input, {});
});

test("buildTestCases generates number test cases", () => {
  const skill = {
    output_schema: {
      properties: {
        value: { type: "number" }
      }
    }
  };

  const tests = buildTestCases(skill);

  const numberTests = tests.filter(t => t.input.value !== undefined);
  assert.ok(numberTests.length >= 3);
});

test("buildTestCases generates string test cases", () => {
  const skill = {
    output_schema: {
      properties: {
        name: { type: "string" }
      }
    }
  };

  const tests = buildTestCases(skill);

  const stringTests = tests.filter(t => t.input.name !== undefined);
  assert.ok(stringTests.length >= 2);
});

test("buildTestCases generates boolean test cases", () => {
  const skill = {
    output_schema: {
      properties: {
        flag: { type: "boolean" }
      }
    }
  };

  const tests = buildTestCases(skill);

  const boolTests = tests.filter(t => t.input.flag !== undefined);
  assert.strictEqual(boolTests.length, 2);
});

test("buildEdgeCases includes null and undefined", () => {
  const skill = {};
  const tests = buildEdgeCases(skill);

  const inputs = tests.map(t => t.input);
  assert.ok(inputs.includes(null));
  assert.ok(inputs.includes(undefined));
});

test("buildEdgeCases includes empty array and string", () => {
  const skill = {};
  const tests = buildEdgeCases(skill);

  const inputs = tests.map(t => t.input);
  assert.ok(inputs.some(i => Array.isArray(i)));
  assert.ok(inputs.some(i => i === ""));
});

test("buildRandomFuzz generates specified count", () => {
  const skill = {
    output_schema: {
      properties: {
        value: { type: "number" },
        name: { type: "string" },
        flag: { type: "boolean" }
      }
    }
  };

  const tests = buildRandomFuzz(skill, 10);
  assert.strictEqual(tests.length, 10);
});

test("buildRandomFuzz generates random values", () => {
  const skill = {
    output_schema: {
      properties: {
        value: { type: "number" }
      }
    }
  };

  const tests = buildRandomFuzz(skill, 100);
  const values = tests.map(t => t.input.value);
  
  const uniqueValues = new Set(values);
  assert.ok(uniqueValues.size > 1, "Should have variety in generated values");
});

test("buildTestCases handles no schema", () => {
  const skill = {};
  const tests = buildTestCases(skill);

  assert.ok(tests.length >= 1);
});