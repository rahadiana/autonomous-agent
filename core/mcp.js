import fetch from "node-fetch";

const RATE_LIMIT_MS = 200;
let lastCall = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastCall;
  
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  
  lastCall = Date.now();
}

export const ALLOWED_TOOLS = [
  "http.get",
  "http.post",
  "json.parse"
];

export const mcp = {
  async "http.get"(args) {
    await rateLimit();
    
    const res = await fetch(args.url, {
      timeout: 5000
    });

    return {
      status: res.status,
      statusText: res.statusText,
      body: await res.text()
    };
  },

  async "http.post"(args) {
    await rateLimit();
    
    const res = await fetch(args.url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...args.headers
      },
      body: JSON.stringify(args.body || {}),
      timeout: 5000
    });

    return {
      status: res.status,
      statusText: res.statusText,
      body: await res.text()
    };
  },

  "json.parse"(args) {
    try {
      return JSON.parse(args.text);
    } catch (e) {
      return { error: "Invalid JSON", original: args.text };
    }
  },

  "json.stringify"(args) {
    try {
      return JSON.stringify(args.value);
    } catch (e) {
      return { error: "Cannot stringify" };
    }
  }
};

export function isToolAllowed(tool) {
  return ALLOWED_TOOLS.includes(tool);
}

export async function callTool(tool, args) {
  if (!isToolAllowed(tool)) {
    throw new Error(`Tool not allowed: ${tool}`);
  }

  if (!mcp[tool]) {
    throw new Error(`Tool not found: ${tool}`);
  }

  const rawResult = await mcp[tool](args);
  return normalizeHttp(rawResult);
}

export function normalizeHttp(res) {
  if (!res || typeof res !== "object") {
    return res;
  }

  if (res.status !== undefined && res.body !== undefined) {
    return {
      ok: res.status >= 200 && res.status < 300,
      data: safeJsonParse(res.body),
      raw: res.body
    };
  }

  return res;
}

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}