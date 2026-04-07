import { describe, it } from "node:test";
import assert from "node:assert";
import { TestBuilder } from "../services/testBuilder.js";

describe("TestBuilder", () => {
  const builder = new TestBuilder();

  it("should build math.add test cases", () => {
    const skill = { capability: "math.add", json: {} };
    const cases = builder.buildTestCases(skill);
    
    assert.ok(cases.length > 0);
    assert.strictEqual(cases[0].input.a, 2);
    assert.strictEqual(cases[0].expected.result, 5);
  });

  it("should build math.subtract test cases", () => {
    const skill = { capability: "math.subtract" };
    const cases = builder.buildTestCases(skill);
    
    assert.ok(cases.length > 0);
    assert.strictEqual(cases[0].expected.result, 2);
  });

  it("should build string.concat test cases", () => {
    const skill = { capability: "string.concat" };
    const cases = builder.buildTestCases(skill);
    
    assert.ok(cases.length > 0);
    assert.strictEqual(cases[0].expected.result, "hello world");
  });

  it("should return default for unknown capability", () => {
    const skill = { capability: "unknown.skill" };
    const cases = builder.buildTestCases(skill);
    
    assert.strictEqual(cases.length, 1);
  });

  it("should build edge cases", () => {
    const skill = { capability: "math.add" };
    const cases = builder.buildEdgeCases(skill);
    
    assert.ok(cases.length >= 1);
  });
});