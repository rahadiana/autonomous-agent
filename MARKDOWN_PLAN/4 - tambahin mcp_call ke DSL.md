Kita tambahkan **`mcp_call`** dengan desain yang tidak merusak determinisme dan tetap aman.

Saya tidak akan kasih versi “setengah jadi”. Ini langsung **production-ready extension**.

---

# 🔧 1. DESAIN `mcp_call` (FINAL)

Tambahkan op baru:

```ts
type Operation =
  | "get"
  | "set"
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "concat"
  | "mcp_call";
```

---

## 📦 FORMAT DSL

```json
{
  "op": "mcp_call",
  "tool": "http.get",
  "args": {
    "url": "https://api.example.com/data"
  },
  "to": "response"
}
```

---

## ⚠️ ATURAN KERAS

* ❌ tidak boleh dynamic tool name
* ❌ tidak boleh akses OS langsung
* ✅ semua lewat wrapper
* ✅ output harus dinormalisasi

---

# 🔧 2. MCP ENGINE (CORE)

Bikin layer ini:

```ts
type MCPTools = {
  "http.get": (args: any) => Promise<any>;
  "http.post": (args: any) => Promise<any>;
  "json.parse": (args: any) => any;
};
```

---

## IMPLEMENTASI DASAR

```ts
import fetch from "node-fetch";

export const mcp: MCPTools = {
  async "http.get"(args) {
    const res = await fetch(args.url);
    const text = await res.text();

    return {
      status: res.status,
      body: text
    };
  },

  async "http.post"(args) {
    const res = await fetch(args.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args.body)
    });

    return {
      status: res.status,
      body: await res.text()
    };
  },

  "json.parse"(args) {
    try {
      return JSON.parse(args.text);
    } catch {
      return null;
    }
  }
};
```

---

# 🔧 3. UPDATE EXECUTOR (ASYNC)

Karena MCP async → executor harus async.

```ts
export async function runDSL(skill, input) {
  const ctx = {
    input,
    output: {},
    memory: {}
  };

  for (const step of skill.logic) {
    await executeStep(step, ctx);
  }

  return ctx.output;
}
```

---

# 🔧 4. IMPLEMENTASI `mcp_call`

```ts
async function executeStep(step, ctx) {
  switch (step.op) {

    case "mcp_call": {
      const tool = step.tool;

      if (!mcp[tool]) {
        throw new Error(`MCP tool not found: ${tool}`);
      }

      const resolvedArgs = resolveObject(step.args, ctx);

      const result = await mcp[tool](resolvedArgs);

      ctx.memory[step.to] = result;
      break;
    }

    // ... existing ops
  }
}
```

---

# 🔧 5. RESOLVE ARGUMENT (WAJIB)

Biar DSL bisa pakai memory:

```ts
function resolveObject(obj, ctx) {
  if (typeof obj !== "object" || obj === null) return obj;

  const result = {};

  for (const key in obj) {
    const val = obj[key];

    if (typeof val === "string" && ctx.memory[val] !== undefined) {
      result[key] = ctx.memory[val];
    } else {
      result[key] = val;
    }
  }

  return result;
}
```

---

# 🔧 6. CONTOH SKILL REAL

## 🌐 Ambil API + parse JSON

```json
{
  "name": "fetch_user",
  "capability": "api.fetch_user",
  "logic": [
    {
      "op": "mcp_call",
      "tool": "http.get",
      "args": {
        "url": "https://jsonplaceholder.typicode.com/users/1"
      },
      "to": "raw"
    },
    {
      "op": "get",
      "path": "raw.body",
      "to": "text"
    },
    {
      "op": "mcp_call",
      "tool": "json.parse",
      "args": {
        "text": "text"
      },
      "to": "json"
    },
    {
      "op": "set",
      "path": "output.user",
      "value": "json"
    }
  ]
}
```

---

# 🔒 7. SECURITY GUARD (WAJIB BANGET)

Tambahkan whitelist:

```ts
const ALLOWED_TOOLS = [
  "http.get",
  "http.post",
  "json.parse"
];
```

```ts
if (!ALLOWED_TOOLS.includes(step.tool)) {
  throw new Error("Tool not allowed");
}
```

---

# 🚫 8. RATE LIMIT (JANGAN LUPA)

Kalau tidak:

👉 agent akan spam API sendiri

Minimal:

```ts
let lastCall = 0;

async function rateLimit() {
  const now = Date.now();

  if (now - lastCall < 200) {
    await new Promise(r => setTimeout(r, 200));
  }

  lastCall = Date.now();
}
```

---

# 🧠 9. KENAPA INI GAME CHANGER

Sebelum:

* agent cuma bisa manipulasi data lokal

Sesudah:

* bisa:

  * 🌐 call API
  * 📁 baca file (kalau ditambah)
  * 🔧 pakai tools eksternal

---

# ⚠️ 10. MASALAH YANG AKAN MUNCUL

Kalau kamu tidak siap:

1. ❌ output API tidak konsisten → evaluator kacau
2. ❌ skill jadi tidak deterministic
3. ❌ latency bikin scoring bias

Solusi:

* normalize output
* cache response
* timeout request

---

# 🎯 NEXT STEP (INI LEVEL LANJUT)

Kalau mau lanjut serius:

### 🔥 1. Conditional Logic

```
op: "if"
```

### 🔥 2. Loop / iteration

```
op: "map"
```

### 🔥 3. Skill chaining (skill call)

```
op: "call_skill"
```

---

Kalau kamu mau bikin ini jadi agent yang benar-benar bisa evolve:

👉 bilang: **“tambahin conditional + branching ke DSL”**

Kalau tidak ada itu, agent kamu masih linear — belum “berpikir”.
