import { test, describe } from "node:test";
import assert from "node:assert";
import { MCPWrapper } from "../services/mcpWrapper.js";

describe("MCP Wrapper", () => {
  test("should initialize with default tools", () => {
    const mcp = new MCPWrapper();
    mcp.init();
    assert.ok(mcp.tools.has("http.get"), "has http.get");
    assert.ok(mcp.tools.has("http.post"), "has http.post");
    assert.ok(mcp.tools.has("file.read"), "has file.read");
    assert.ok(mcp.tools.has("file.write"), "has file.write");
    console.log("TEST: MCP default tools OK");
  });

  test("should parse and stringify JSON", () => {
    const mcp = new MCPWrapper();
    const obj = { key: "value", num: 123 };
    const parsed = mcp.parseJSON(mcp.stringifyJSON(obj));
    assert.deepStrictEqual(parsed, obj);
    console.log("TEST: JSON parse/stringify OK");
  });

  test("should register custom tool", () => {
    const mcp = new MCPWrapper();
    mcp.register("custom.add", (params) => params.a + params.b);
    assert.strictEqual(mcp.tools.has("custom.add"), true);
    console.log("TEST: Custom tool registration OK");
  });
});