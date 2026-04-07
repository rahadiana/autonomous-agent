export class MCPWrapper {
  constructor() {
    this.tools = new Map();
  }

  register(name, fn) {
    this.tools.set(name, fn);
  }

  async call(toolName, params) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`MCP tool ${toolName} not found`);
    }
    return tool(params);
  }

  async httpGet(url) {
    const fetch = (await import("node-fetch")).default;
    const response = await fetch(url);
    return response.json();
  }

  async httpPost(url, body) {
    const fetch = (await import("node-fetch")).default;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return response.json();
  }

  readFile(path) {
    const fs = require("fs");
    return fs.readFileSync(path, "utf-8");
  }

  writeFile(path, content) {
    const fs = require("fs");
    fs.writeFileSync(path, content, "utf-8");
  }

  parseJSON(str) {
    return JSON.parse(str);
  }

  stringifyJSON(obj) {
    return JSON.stringify(obj, null, 2);
  }

  init() {
    this.register("http.get", this.httpGet.bind(this));
    this.register("http.post", this.httpPost.bind(this));
    this.register("file.read", this.readFile.bind(this));
    this.register("file.write", this.writeFile.bind(this));
    this.register("json.parse", this.parseJSON.bind(this));
    this.register("json.stringify", this.stringifyJSON.bind(this));
  }
}