import { test, describe } from "node:test";
import assert from "node:assert";
import { Executor } from "../services/executor.js";

describe("Executor", () => {
  test("should execute simple logic", () => {
    const executor = new Executor(false);
    const skillJson = {
      logic: "output.result = input.a + input.b;",
      output_schema: {
        type: "object",
        properties: { result: { type: "number" } },
        required: ["result"]
      }
    };
    const result = executor.execute(skillJson, { a: 5, b: 3 });
    assert.strictEqual(result.result, 8);
    console.log("TEST: Execute simple logic OK");
  });

  test("should handle edge cases", () => {
    const executor = new Executor(false);
    const skillJson = { logic: "output.result = input.x || 0;" };
    const result = executor.execute(skillJson, {});
    assert.strictEqual(result.result, 0);
    console.log("TEST: Edge case handling OK");
  });
  
  test("should run with sandbox mode", () => {
    const executor = new Executor(true);
    const skillJson = {
      logic: "output.result = input.value * 2;",
      output_schema: { type: "object", properties: { result: { type: "number" } } }
    };
    const result = executor.execute(skillJson, { value: 5 });
    assert.strictEqual(result.result, 10);
    console.log("TEST: Sandbox execution OK");
  });
});