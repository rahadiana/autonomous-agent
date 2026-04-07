import { describe, it } from "node:test";
import assert from "node:assert";
import { validate, validateInput, validateOutput } from "../services/validator.js";

describe("Validator", () => {
  it("should validate with schema", () => {
    const schema = {
      type: "object",
      properties: {
        result: { type: "number" }
      },
      required: ["result"]
    };
    
    const data = { result: 5 };
    const result = validate(schema, data);
    
    assert.strictEqual(result.valid, true);
  });

  it("should reject invalid data", () => {
    const schema = {
      type: "object",
      properties: {
        result: { type: "number" }
      },
      required: ["result"]
    };
    
    const data = { result: "not a number" };
    const result = validate(schema, data);
    
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it("should handle null schema", () => {
    const result = validate(null, { test: true });
    assert.strictEqual(result.valid, true);
  });

  it("should validate input", () => {
    const schema = { type: "object", properties: { a: { type: "number" } } };
    const input = { a: 5 };
    const result = validateInput(input, schema);
    assert.strictEqual(result.valid, true);
  });
});