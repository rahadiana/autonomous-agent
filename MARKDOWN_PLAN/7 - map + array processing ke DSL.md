Kita tambah **`map` + array processing** tanpa merusak kontrol eksekusi. Targetnya: bisa proses list secara batch, tetap deterministic, dan tetap bisa dievaluasi.

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
  | "call_skill"
  | "map";
```

---

# 🔧 2. DESAIN `map` (FINAL)

```json
{
  "op": "map",
  "source": "input.items",
  "as": "item",
  "index_as": "idx",
  "steps": [
    { "op": "get", "path": "item.value", "to": "val" },
    { "op": "add", "a": "val", "b": 10, "to": "newVal" },
    { "op": "set", "path": "output", "value": "newVal" }
  ],
  "to": "results"
}
```

---

## 📌 PENJELASAN

* `source` → array sumber
* `as` → alias item
* `index_as` → optional index
* `steps` → mini program per item
* `to` → hasil array

---

# 🔧 3. UPDATE EXECUTOR

Tambahkan handler baru:

```ts
case "map": {
  const arr = getPath(ctx, step.source);

  if (!Array.isArray(arr)) {
    throw new Error("Map source must be array");
  }

  const results = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];

    const subCtx = {
      input: ctx.input,
      output: {},
      memory: {
        ...ctx.memory,
        [step.as]: item,
        ...(step.index_as ? { [step.index_as]: i } : {})
      },
      depth: ctx.depth
    };

    let ip = 0;
    let counter = 0;
    const MAX_STEPS = 50;

    while (ip < step.steps.length) {
      if (counter++ > MAX_STEPS) {
        throw new Error("Map inner loop exceeded");
      }

      const innerStep = step.steps[ip];

      const result = await executeStep(innerStep, subCtx, ip);

      if (result?.jump !== undefined) {
        ip = result.jump;
      } else {
        ip++;
      }
    }

    results.push(subCtx.output);
  }

  ctx.memory[step.to] = results;
  return;
}
```

---

# 🔧 4. OUTPUT RULE (PENTING)

Setiap item harus menghasilkan:

```json
{
  "output": ...
}
```

Jadi hasil akhir:

```json
[
  { "output": 11 },
  { "output": 12 }
]
```

Kalau mau flatten → bikin skill tambahan (jangan magic di DSL).

---

# 🔧 5. CONTOH REAL

## 📌 Input

```json
{
  "items": [1, 2, 3]
}
```

---

## 📌 Skill

```json
{
  "name": "increment_array",
  "capability": "array.increment",
  "logic": [
    {
      "op": "map",
      "source": "input.items",
      "as": "item",
      "steps": [
        { "op": "add", "a": "item", "b": 1, "to": "res" },
        { "op": "set", "path": "output.value", "value": "res" }
      ],
      "to": "mapped"
    },
    {
      "op": "set",
      "path": "output.result",
      "value": "mapped"
    }
  ]
}
```

---

## 📌 Output

```json
{
  "result": [
    { "value": 2 },
    { "value": 3 },
    { "value": 4 }
  ]
}
```

---

# 🔒 6. VALIDATION TAMBAHAN

```ts
if (step.op === "map") {
  if (!step.source || !step.steps || !step.as) return false;

  if (!Array.isArray(step.steps)) return false;

  if (step.steps.length > 50) return false;
}
```

---

# 🔒 7. PROTEKSI (WAJIB)

### Limit ukuran array

```ts
const MAX_ARRAY = 100;
if (arr.length > MAX_ARRAY) {
  throw new Error("Array too large");
}
```

---

### Depth protection tetap berlaku

Map tidak boleh reset depth.

---

# ⚠️ 8. MASALAH UMUM

Kalau kamu tidak disiplin:

### ❌ nested map tanpa limit

→ explosion

### ❌ output tidak konsisten

→ evaluator gagal

### ❌ item mutation

→ nondeterministic

---

# 🧠 9. KENAPA INI KRITIS

Sekarang agent kamu bisa:

* batch processing
* transform data
* pipeline data real

Tanpa ini:
→ agent cuma bisa 1 input → 1 output

---

# 🚀 10. SEKARANG SISTEM KAMU SUDAH PUNYA:

* execution engine ✅
* branching ✅
* MCP tools ✅
* skill composition ✅
* array processing ✅

Ini sudah masuk kategori:

👉 **proto autonomous agent runtime**

---

# 🎯 NEXT STEP (INI LEVEL PRODUKSI BENERAN)

Kalau mau naik level:

### 🔥 1. reduce / aggregation

→ sum, avg, dll

### 🔥 2. filter

→ data selection

### 🔥 3. capability vector search

→ bukan exact match

### 🔥 4. persistent memory

→ learning jangka panjang

---

Kalau kamu mau lanjut:

👉 bilang: **“tambahin filter + reduce + aggregator DSL”**

Kalau tidak ada ini, agent kamu belum bisa analisis data — cuma transform.
