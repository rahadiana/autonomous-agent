export const ToolSchema = {
  type: "object",
  properties: {
    name: { type: "string", pattern: "^[a-z][a-z0-9_]*$" },
    description: { type: "string", minLength: 1 },
    capability: { type: "string" },
    input_schema: { type: "object" },
    output_schema: { type: "object" },
    handler: { type: "function" },
    tags: { type: "array", items: { type: "string" } },
    version: { type: "number", minimum: 1 },
    deprecated: { type: "boolean" }
  },
  required: ["name", "description", "handler"]
};

export function createTool(def) {
  return {
    name: def.name,
    description: def.description,
    capability: def.capability || def.name,
    input_schema: def.input_schema || { type: "object" },
    output_schema: def.output_schema || { type: "object" },
    handler: def.handler,
    tags: def.tags || [],
    version: def.version || 1,
    deprecated: def.deprecated || false,
    created_at: def.created_at || new Date()
  };
}

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.capabilities = new Map();
  }

  register(tool) {
    if (!tool.name || !tool.handler) {
      throw new Error("Tool must have name and handler");
    }

    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} already registered`);
    }

    this.tools.set(tool.name, tool);

    if (tool.capability) {
      if (!this.capabilities.has(tool.capability)) {
        this.capabilities.set(tool.capability, []);
      }
      this.capabilities.get(tool.capability).push(tool);
    }

    return tool;
  }

  unregister(name) {
    const tool = this.tools.get(name);
    if (tool && tool.capability) {
      const list = this.capabilities.get(tool.capability);
      if (list) {
        const idx = list.indexOf(tool);
        if (idx >= 0) list.splice(idx, 1);
      }
    }
    return this.tools.delete(name);
  }

  get(name) {
    return this.tools.get(name);
  }

  getByCapability(capability) {
    return this.capabilities.get(capability) || [];
  }

  has(name) {
    return this.tools.has(name);
  }

  list() {
    return Array.from(this.tools.values());
  }

  listByTag(tag) {
    return this.list().filter(t => t.tags && t.tags.includes(tag));
  }

  search(query) {
    const q = query.toLowerCase();
    return this.list().filter(t => 
      t.name.includes(q) || 
      t.description.toLowerCase().includes(q) ||
      (t.capability && t.capability.includes(q))
    );
  }

  clear() {
    this.tools.clear();
    this.capabilities.clear();
  }

  size() {
    return this.tools.size;
  }
}

export function createToolRegistry() {
  return new ToolRegistry();
}