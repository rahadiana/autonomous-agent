import test from "node:test";
import assert from "node:assert";
import { runSkill, runDSL } from "../core/executor.js";

test("runSkill executes set operation", async () => {
  const skill = {
    logic: [
      { op: "set", path: "result", value: 42 }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, 42);
});

test("runSkill executes get operation from input", async () => {
  const skill = {
    logic: [
      { op: "get", path: "data.value", to: "val" }
    ]
  };

  const result = await runSkill(skill, { data: { value: 123 } });
  assert.strictEqual(result.val, 123);
});

test("runSkill executes add operation", async () => {
  const skill = {
    logic: [
      { op: "add", a: 10, b: 5, to: "sum" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.sum, 15);
});

test("runSkill executes subtract operation", async () => {
  const skill = {
    logic: [
      { op: "subtract", a: 10, b: 5, to: "diff" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.diff, 5);
});

test("runSkill executes multiply operation", async () => {
  const skill = {
    logic: [
      { op: "multiply", a: 6, b: 7, to: "product" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.product, 42);
});

test("runSkill executes divide operation", async () => {
  const skill = {
    logic: [
      { op: "divide", a: 20, b: 4, to: "quotient" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.quotient, 5);
});

test("runSkill executes concat operation", async () => {
  const skill = {
    logic: [
      { op: "concat", a: "Hello", b: " World", to: "greeting" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.greeting, "Hello World");
});

test("runSkill executes mcp_call to json.parse", async () => {
  const skill = {
    logic: [
      { op: "mcp_call", tool: "json.parse", args: { text: '{"key":"value"}' }, to: "parsed" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.deepStrictEqual(result.parsed, { key: "value" });
});

test("runSkill rejects disallowed tool", async () => {
  const skill = {
    logic: [
      { op: "mcp_call", tool: "fs.readFile", args: { path: "/etc/passwd" }, to: "data" }
    ]
  };

  await assert.rejects(
    () => runSkill(skill, {}),
    /Tool not allowed/
  );
});

test("runSkill resolves memory reference in mcp_call args", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.jsonText", value: '{"a":1}' },
      { op: "mcp_call", tool: "json.parse", args: { text: "jsonText" }, to: "parsed" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.deepStrictEqual(result.parsed, { a: 1 });
});

test("runSkill resolves nested memory reference in mcp_call args", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.apiResponse.body", value: '{"status":"ok"}' },
      { op: "mcp_call", tool: "json.parse", args: { text: "apiResponse.body" }, to: "parsed" }
    ]
  };

  const result = await runSkill(skill, {});
  assert.deepStrictEqual(result.parsed, { status: "ok" });
});

test("runSkill executes if branching - true branch", async () => {
  const skill = {
    logic: [
      { 
        op: "if", 
        condition: true, 
        branches: { 
          then: [{ op: "set", path: "result", value: "yes" }] 
        } 
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "yes");
});

test("runSkill executes if branching - false branch", async () => {
  const skill = {
    logic: [
      { 
        op: "if", 
        condition: false, 
        branches: { 
          then: [{ op: "set", path: "result", value: "yes" }],
          else: [{ op: "set", path: "result", value: "no" }]
        } 
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "no");
});

test("runSkill uses memory value in condition", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.flag", value: true },
      { 
        op: "if", 
        condition: "flag", 
        branches: { 
          then: [{ op: "set", path: "result", value: "flag was true" }] 
        } 
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "flag was true");
});

test("runSkill handles nested path in set", async () => {
  const skill = {
    logic: [
      { op: "set", path: "user.name", value: "John" },
      { op: "set", path: "user.age", value: 30 }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.user.name, "John");
  assert.strictEqual(result.user.age, 30);
});

test("runSkill throws on unknown operation", async () => {
  const skill = {
    logic: [
      { op: "unknown_op", value: 42 }
    ]
  };

  await assert.rejects(
    () => runSkill(skill, {}),
    /Invalid.*operation|Unknown operation/
  );
});

test("runDSL is alias for runSkill", async () => {
  const skill = { logic: "output.x = 1;" };
  const result = await runDSL(skill, {});
  assert.strictEqual(result.x, 1);
});