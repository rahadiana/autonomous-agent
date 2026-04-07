import { test, describe } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { DSLExecutor, MCPTools } from "../services/dslExecutor.js";

describe("MCPTools", () => {
  test("getTool throws for unknown tool", () => {
    const mcp = new MCPTools();
    try {
      mcp.getTool("unknown");
      throw new Error("Should have thrown");
    } catch (e) {
      strictEqual(e.message.includes("not allowed"), true);
    }
  });
});

describe("DSLExecutor with MCP", () => {
  test("validateDSL allows mcp_call", () => {
    const executor = new DSLExecutor();
    const skill = {
      logic: [
        { op: "mcp_call", tool: "http.get", args: { url: "https://example.com" }, to: "res" }
      ]
    };
    strictEqual(executor.validateDSL(skill), true);
  });

  test("supports mcp_call in operations", () => {
    const executor = new DSLExecutor();
    strictEqual(executor.mcp instanceof MCPTools, true);
  });
});