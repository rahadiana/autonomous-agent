import fetch from "node-fetch";

const RATE_LIMIT_MS = 200;
let lastCall = 0;

const httpCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCacheKey(tool, args) {
  return `${tool}:${JSON.stringify(args)}`;
}

function getCached(key) {
  const entry = httpCache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    httpCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(key, data) {
  httpCache.set(key, { data, timestamp: Date.now() });
}

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
    const cacheKey = getCacheKey("http.get", args);
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
    await rateLimit();
    
    const res = await fetch(args.url, {
      timeout: 5000
    });

    const result = {
      status: res.status,
      statusText: res.statusText,
      body: await res.text()
    };
    
    setCache(cacheKey, result);
    return result;
  },

  async "http.post"(args) {
    const cacheKey = getCacheKey("http.post", args);
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
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

    const result = {
      status: res.status,
      statusText: res.statusText,
      body: await res.text()
    };
    
    setCache(cacheKey, result);
    return result;
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