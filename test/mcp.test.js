import test from "node:test";
import assert from "node:assert";
import { mcp, ALLOWED_TOOLS, isToolAllowed, callTool } from "../core/mcp.js";

test("ALLOWED_TOOLS contains expected tools", () => {
  assert.ok(ALLOWED_TOOLS.includes("http.get"));
  assert.ok(ALLOWED_TOOLS.includes("http.post"));
  assert.ok(ALLOWED_TOOLS.includes("json.parse"));
});

test("isToolAllowed returns true for allowed tools", () => {
  assert.strictEqual(isToolAllowed("http.get"), true);
  assert.strictEqual(isToolAllowed("http.post"), true);
  assert.strictEqual(isToolAllowed("json.parse"), true);
});

test("isToolAllowed returns false for disallowed tools", () => {
  assert.strictEqual(isToolAllowed("fs.readFile"), false);
  assert.strictEqual(isToolAllowed("eval"), false);
  assert.strictEqual(isToolAllowed("process.exit"), false);
});

test("json.parse tool parses valid JSON", () => {
  const result = mcp["json.parse"]({ text: '{"name":"test"}' });
  assert.deepStrictEqual(result, { name: "test" });
});

test("json.parse tool returns error for invalid JSON", () => {
  const result = mcp["json.parse"]({ text: "not valid json" });
  assert.ok(result.error);
  assert.strictEqual(result.original, "not valid json");
});

test("json.stringify tool converts object to string", () => {
  const result = mcp["json.stringify"]({ value: { foo: "bar" } });
  assert.strictEqual(result, '{"foo":"bar"}');
});

test("callTool throws for disallowed tool", async () => {
  await assert.rejects(
    () => callTool("fs.readFile", {}),
    /Tool not allowed/
  );
});

test("callTool throws for non-existent tool", async () => {
  await assert.rejects(
    () => callTool("nonexistent.tool", {}),
    /Tool not allowed/
  );
});

test("callTool works for allowed tool", async () => {
  const result = await callTool("json.parse", { text: '{"x":1}' });
  assert.deepStrictEqual(result, { x: 1 });
});