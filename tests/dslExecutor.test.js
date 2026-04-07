import { test, describe } from "node:test";
import { strictEqual } from "node:assert";
import { DSLExecutor, runDSL } from "../services/dslExecutor.js";

describe("DSLExecutor", () => {

  test("validateDSL - valid DSL returns true", () => {
    const executor = new DSLExecutor();
    const skill = {
      name: "test",
      capability: "test",
      logic: [{ op: "get", path: "input.a", to: "a" }]
    };
    strictEqual(executor.validateDSL(skill), true);
  });

  test("validateDSL - invalid when logic not array", () => {
    const executor = new DSLExecutor();
    const skill = { name: "test", logic: "not array" };
    strictEqual(executor.validateDSL(skill), false);
  });

  test("validateDSL - invalid when op not in whitelist", () => {
    const executor = new DSLExecutor();
    const skill = { name: "test", logic: [{ op: "exec", path: "x", to: "y" }] };
    strictEqual(executor.validateDSL(skill), false);
  });

  test("set operation - set output value", async () => {
    const executor = new DSLExecutor();
    const skill = {
      logic: [
        { op: "get", path: "input.a", to: "a" },
        { op: "set", path: "result", value: "a" }
      ]
    };
    const result = await executor.execute(skill, { a: 5 });
    strictEqual(result.result, 5);
  });

  test("add operation", async () => {
    const executor = new DSLExecutor();
    const skill = {
      logic: [
        { op: "get", path: "input.a", to: "a" },
        { op: "get", path: "input.b", to: "b" },
        { op: "add", a: "a", b: "b", to: "result" },
        { op: "set", path: "result", value: "result" }
      ]
    };
    const result = await executor.execute(skill, { a: 2, b: 3 });
    strictEqual(result.result, 5);
  });

  test("subtract operation", async () => {
    const executor = new DSLExecutor();
    const skill = {
      logic: [
        { op: "get", path: "input.a", to: "a" },
        { op: "get", path: "input.b", to: "b" },
        { op: "subtract", a: "a", b: "b", to: "result" },
        { op: "set", path: "result", value: "result" }
      ]
    };
    const result = await executor.execute(skill, { a: 10, b: 3 });
    strictEqual(result.result, 7);
  });

  test("multiply operation", async () => {
    const executor = new DSLExecutor();
    const skill = {
      logic: [
        { op: "get", path: "input.a", to: "a" },
        { op: "get", path: "input.b", to: "b" },
        { op: "multiply", a: "a", b: "b", to: "result" },
        { op: "set", path: "result", value: "result" }
      ]
    };
    const result = await executor.execute(skill, { a: 4, b: 5 });
    strictEqual(result.result, 20);
  });

  test("divide operation", async () => {
    const executor = new DSLExecutor();
    const skill = {
      logic: [
        { op: "get", path: "input.a", to: "a" },
        { op: "get", path: "input.b", to: "b" },
        { op: "divide", a: "a", b: "b", to: "result" },
        { op: "set", path: "result", value: "result" }
      ]
    };
    const result = await executor.execute(skill, { a: 20, b: 4 });
    strictEqual(result.result, 5);
  });

  test("divide by zero returns null", async () => {
    const executor = new DSLExecutor();
    const skill = {
      logic: [
        { op: "get", path: "input.a", to: "a" },
        { op: "get", path: "input.b", to: "b" },
        { op: "divide", a: "a", b: "b", to: "result" },
        { op: "set", path: "result", value: "result" }
      ]
    };
    const result = await executor.execute(skill, { a: 10, b: 0 });
    strictEqual(result.result, null);
  });

  test("concat operation", async () => {
    const executor = new DSLExecutor();
    const skill = {
      logic: [
        { op: "get", path: "input.a", to: "a" },
        { op: "get", path: "input.b", to: "b" },
        { op: "concat", a: "a", b: "b", to: "result" },
        { op: "set", path: "result", value: "result" }
      ]
    };
    const result = await executor.execute(skill, { a: "hello", b: " world" });
    strictEqual(result.result, "hello world");
  });

  test("runDSL helper works", async () => {
    const skill = {
      logic: [
        { op: "get", path: "input.a", to: "a" },
        { op: "get", path: "input.b", to: "b" },
        { op: "add", a: "a", b: "b", to: "result" },
        { op: "set", path: "result", value: "result" }
      ]
    };
    const result = await runDSL(skill, { a: 3, b: 7 });
    strictEqual(result.result, 10);
  });
});