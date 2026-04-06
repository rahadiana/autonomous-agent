import test from "node:test";
import assert from "node:assert";
import { ToolSchema, createTool, ToolRegistry, createToolRegistry } from "../core/toolRegistry.js";

test("createTool creates tool with defaults", () => {
  const tool = createTool({
    name: "test_tool",
    description: "A test tool",
    handler: async () => ({ result: "ok" })
  });

  assert.strictEqual(tool.name, "test_tool");
  assert.strictEqual(tool.description, "A test tool");
  assert.strictEqual(tool.capability, "test_tool");
  assert.ok(tool.input_schema);
  assert.ok(tool.output_schema);
  assert.strictEqual(tool.version, 1);
  assert.strictEqual(tool.deprecated, false);
});

test("createTool accepts custom capability", () => {
  const tool = createTool({
    name: "add",
    description: "Add numbers",
    capability: "math.add",
    handler: async () => ({})
  });

  assert.strictEqual(tool.capability, "math.add");
});

test("ToolRegistry register adds tool", () => {
  const registry = createToolRegistry();
  const tool = createTool({ name: "tool1", description: "desc", handler: () => {} });

  registry.register(tool);

  assert.strictEqual(registry.size(), 1);
  assert.strictEqual(registry.get("tool1"), tool);
});

test("ToolRegistry register throws on duplicate", () => {
  const registry = createToolRegistry();
  const tool = { name: "dup", description: "desc", handler: () => {} };

  registry.register(tool);

  assert.throws(() => registry.register(tool), /already registered/);
});

test("ToolRegistry register throws on missing name/handler", () => {
  const registry = createToolRegistry();

  assert.throws(() => registry.register({ description: "no name" }), /must have name/);
  assert.throws(() => registry.register({ name: "test", description: "no handler" }), /must have name/);
});

test("ToolRegistry getByCapability returns tools", () => {
  const registry = createToolRegistry();
  registry.register(createTool({ name: "a", capability: "math", description: "d", handler: () => {} }));
  registry.register(createTool({ name: "b", capability: "math", description: "d", handler: () => {} }));
  registry.register(createTool({ name: "c", capability: "text", description: "d", handler: () => {} }));

  const mathTools = registry.getByCapability("math");
  assert.strictEqual(mathTools.length, 2);
});

test("ToolRegistry unregister removes tool", () => {
  const registry = createToolRegistry();
  const tool = createTool({ name: "remove_me", capability: "test", description: "d", handler: () => {} });

  registry.register(tool);
  assert.strictEqual(registry.size(), 1);

  registry.unregister("remove_me");
  assert.strictEqual(registry.size(), 0);
});

test("ToolRegistry listByTag filters correctly", () => {
  const registry = createToolRegistry();
  registry.register(createTool({ name: "a", description: "d", handler: () => {}, tags: ["api"] }));
  registry.register(createTool({ name: "b", description: "d", handler: () => {}, tags: ["util"] }));
  registry.register(createTool({ name: "c", description: "d", handler: () => {}, tags: ["api", "v2"] }));

  const apiTools = registry.listByTag("api");
  assert.strictEqual(apiTools.length, 2);
});

test("ToolRegistry search finds by name/description/capability", () => {
  const registry = createToolRegistry();
  registry.register(createTool({ name: "fetch_user", description: "Get user data", capability: "api.user", handler: () => {} }));
  registry.register(createTool({ name: "add_numbers", description: "Add two numbers", capability: "math.add", handler: () => {} }));

  const results = registry.search("user");
  assert.ok(results.some(r => r.name === "fetch_user"));
});

test("ToolRegistry clear removes all", () => {
  const registry = createToolRegistry();
  registry.register(createTool({ name: "a", description: "d", handler: () => {} }));
  registry.register(createTool({ name: "b", description: "d", handler: () => {} }));

  registry.clear();
  assert.strictEqual(registry.size(), 0);
});