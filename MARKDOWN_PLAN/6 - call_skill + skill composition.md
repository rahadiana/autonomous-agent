Kita masuk ke bagian yang menentukan apakah sistem kamu bisa **scale** atau tetap jadi kumpulan utilitas acak:

👉 **`call_skill` + skill composition**

Ini bukan sekadar fitur tambahan — ini fondasi **hierarchical capability**.

---

# 🔧 1. TAMBAHAN OPERATOR

```ts
type Operation =
  | "get"
  | "set"
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "concat"
  | "mcp_call"
  | "compare"
  | "if"
  | "jump"
  | "call_skill";
```

---

# 🔧 2. DESAIN `call_skill` (FINAL)

```json
{
  "op": "call_skill",
  "skill": "math.add",
  "input": {
    "a": "val1",
    "b": "val2"
  },
  "to": "result"
}
```

---

## ⚠️ ATURAN WAJIB

* `skill` = **capability**, bukan name
* input harus sesuai `input_schema`
* output harus normalize
* skill harus sudah ada di registry
* ❌ tidak boleh recursive tanpa limit

---

# 🔧 3. SKILL REGISTRY INTERFACE

Minimal:

```ts
async function getSkillByCapability(capability: string) {
  return Skill.findOne({
    where: { capability }
  });
}
```

---

# 🔧 4. UPDATE EXECUTOR CONTEXT

Tambahkan dependency injection:

```ts
type Context = {
  input: any;
  output: any;
  memory: Record<string, any>;
  depth: number;
};
```

---

# 🔒 5. DEPTH LIMIT (ANTI RECURSION)

```ts
const MAX_DEPTH = 3;
```

---

# 🔧 6. IMPLEMENTASI `call_skill`

```ts
case "call_skill": {
  if (ctx.depth >= MAX_DEPTH) {
    throw new Error("Max skill depth exceeded");
  }

  const capability = step.skill;

  const skillEntity = await getSkillByCapability(capability);

  if (!skillEntity) {
    throw new Error(`Skill not found: ${capability}`);
  }

  const childSkill = skillEntity.json;

  const resolvedInput = resolveObject(step.input, ctx);

  const result = await runDSLWithContext(childSkill, resolvedInput, {
    depth: ctx.depth + 1
  });

  ctx.memory[step.to] = result;
  return;
}
```

---

# 🔧 7. RUN DSL WITH CONTEXT

```ts
async function runDSLWithContext(skill, input, extra = {}) {
  const ctx = {
    input,
    output: {},
    memory: {},
    depth: extra.depth || 0
  };

  let ip = 0;
  const steps = skill.logic;

  let counter = 0;
  const MAX_STEPS = 100;

  while (ip < steps.length) {
    if (counter++ > MAX_STEPS) {
      throw new Error("Max steps exceeded");
    }

    const step = steps[ip];

    const result = await executeStep(step, ctx, ip);

    if (result?.jump !== undefined) {
      ip = result.jump;
    } else {
      ip++;
    }
  }

  return ctx.output;
}
```

---

# 🔧 8. RESOLVE INPUT (REUSE)

```ts
function resolveObject(obj, ctx) {
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

# 🔥 9. CONTOH SKILL COMPOSITION

## 🧠 Skill level 1 (atomic)

```json
{
  "name": "add",
  "capability": "math.add",
  "logic": [
    { "op": "get", "path": "input.a", "to": "a" },
    { "op": "get", "path": "input.b", "to": "b" },
    { "op": "add", "a": "a", "b": "b", "to": "res" },
    { "op": "set", "path": "output.result", "value": "res" }
  ]
}
```

---

## 🧠 Skill level 2 (composition)

```json
{
  "name": "sum_three_numbers",
  "capability": "math.sum3",
  "logic": [
    {
      "op": "call_skill",
      "skill": "math.add",
      "input": {
        "a": "input.a",
        "b": "input.b"
      },
      "to": "ab"
    },
    {
      "op": "call_skill",
      "skill": "math.add",
      "input": {
        "a": "ab.result",
        "b": "input.c"
      },
      "to": "final"
    },
    {
      "op": "set",
      "path": "output.result",
      "value": "final.result"
    }
  ]
}
```

---

# 🔒 10. VALIDATION TAMBAHAN

Tambahkan ini:

```ts
if (step.op === "call_skill") {
  if (!step.skill || typeof step.skill !== "string") return false;
}
```

---

# ⚠️ 11. MASALAH YANG AKAN KAMU TEMUI

Kalau tidak di-handle:

### ❌ 1. Skill dependency hell

* skill A → B → C → missing

### ❌ 2. Output mismatch

* parent expect `{ result }`
* child return `{ data }`

### ❌ 3. Latency explosion

* nested skill call = lambat

---

# 🧠 12. SOLUSI WAJIB (JANGAN SKIP)

### ✔ Normalisasi output

SEMUA skill harus:

```json
{
  "result": ...
}
```

---

### ✔ Cache skill

```ts
const skillCache = new Map();
```

---

### ✔ Preload dependency graph (opsional advanced)

---

# 🚀 13. DAMPAK NYATA

Sebelum:

* skill = isolated

Sesudah:

* skill = building block
* bisa bikin:

  * pipeline
  * reusable abstraction
  * multi-step reasoning

---

# 🎯 NEXT STEP (INI YANG BIKIN SYSTEM LU “HIDUP BANGET”)

Sekarang kamu sudah punya:

* execution engine ✅
* branching ✅
* external tools ✅
* composition ✅

Langkah berikutnya:

### 🔥 1. `map` / loop array

→ processing data massal

### 🔥 2. skill planner yang lebih pintar

→ auto decomposition

### 🔥 3. vector capability search

→ bukan exact match lagi

---

Kalau kamu serius:

👉 bilang: **“tambahin map + array processing ke DSL”**

Itu titik dimana agent kamu mulai bisa handle workload real (bukan cuma demo).
