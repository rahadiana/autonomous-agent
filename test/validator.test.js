import test from "node:test";
import assert from "node:assert";
import { validate } from "../core/validator.js";

test("validate returns true for valid data", () => {
  const schema = {
    type: "object",
    properties: {
      result: { type: "number" }
    },
    required: ["result"]
  };

  const { valid, errors } = validate(schema, { result: 42 });

  assert.strictEqual(valid, true);
  assert.deepStrictEqual(errors, []);
});

test("validate returns false for missing required field", () => {
  const schema = {
    type: "object",
    properties: {
      result: { type: "number" }
    },
    required: ["result"]
  };

  const { valid, errors } = validate(schema, {});

  assert.strictEqual(valid, false);
  assert.ok(errors.length > 0);
});

test("validate returns false for wrong type", () => {
  const schema = {
    type: "object",
    properties: {
      result: { type: "number" }
    },
    required: ["result"]
  };

  const { valid, errors } = validate(schema, { result: "not a number" });

  assert.strictEqual(valid, false);
  assert.ok(errors.length > 0);
});

test("validate handles array schema", () => {
  const schema = {
    type: "array",
    items: { type: "number" }
  };

  const validResult = validate(schema, [1, 2, 3]);
  assert.strictEqual(validResult.valid, true);

  const invalidResult = validate(schema, [1, "two", 3]);
  assert.strictEqual(invalidResult.valid, false);
});

test("validate handles nested object schema", () => {
  const schema = {
    type: "object",
    properties: {
      user: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" }
        },
        required: ["name", "age"]
      }
    },
    required: ["user"]
  };

  const validResult = validate(schema, {
    user: { name: "John", age: 30 }
  });
  assert.strictEqual(validResult.valid, true);

  const invalidResult = validate(schema, {
    user: { name: "John" }
  });
  assert.strictEqual(invalidResult.valid, false);
});

test("validate handles enum constraint", () => {
  const schema = {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["active", "inactive", "pending"]
      }
    },
    required: ["status"]
  };

  const validResult = validate(schema, { status: "active" });
  assert.strictEqual(validResult.valid, true);

  const invalidResult = validate(schema, { status: "deleted" });
  assert.strictEqual(invalidResult.valid, false);
});

test("validate handles minimum and maximum constraints", () => {
  const schema = {
    type: "object",
    properties: {
      score: { type: "number", minimum: 0, maximum: 100 }
    },
    required: ["score"]
  };

  const validResult = validate(schema, { score: 50 });
  assert.strictEqual(validResult.valid, true);

  const tooLow = validate(schema, { score: -1 });
  assert.strictEqual(tooLow.valid, false);

  const tooHigh = validate(schema, { score: 101 });
  assert.strictEqual(tooHigh.valid, false);
});
