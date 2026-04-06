Kita tambah **`filter` + `reduce` + aggregator ops** dengan batasan ketat supaya tetap deterministic dan tidak meledak kompleksitasnya.

Ini melengkapi pipeline data kamu:
**map → filter → reduce → output**

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
  | "map"
  | "filter"
  | "reduce";
```

---

# 🔧 2. DESAIN `filter`

## 📦 FORMAT

```json
{
  "op": "filter",
  "source": "input.items",
  "as": "item",
  "steps": [
    { "op": "compare", "a": "item", "b": 10, "operator": ">", "to": "keep" }
  ],
  "condition": "keep",
  "to": "filtered"
}
```

---

## 🔧 IMPLEMENTASI

```ts
case "filter": {
  const arr = getPath(ctx, step.source);

  if (!Array.isArray(arr)) {
    throw new Error("Filter source must be array");
  }

  const results = [];

  for (let i = 0; i < arr.length; i++) {
    const subCtx = {
      input: ctx.input,
      output: {},
      memory: {
        ...ctx.memory,
        [step.as]: arr[i]
      },
      depth: ctx.depth
    };

    let ip = 0;
    let counter = 0;

    while (ip < step.steps.length) {
      if (counter++ > 50) throw new Error("Filter loop exceeded");

      const r = await executeStep(step.steps[ip], subCtx, ip);

      ip = r?.jump ?? ip + 1;
    }

    const keep = subCtx.memory[step.condition];

    if (keep === true) {
      results.push(arr[i]);
    }
  }

  ctx.memory[step.to] = results;
  return;
}
```

---

# 🔧 3. DESAIN `reduce`

## 📦 FORMAT

```json
{
  "op": "reduce",
  "source": "input.items",
  "as": "item",
  "accumulator": "acc",
  "initial": 0,
  "steps": [
    { "op": "add", "a": "acc", "b": "item", "to": "acc" }
  ],
  "to": "sum"
}
```

---

## 🔧 IMPLEMENTASI

```ts
case "reduce": {
  const arr = getPath(ctx, step.source);

  if (!Array.isArray(arr)) {
    throw new Error("Reduce source must be array");
  }

  let acc = step.initial;

  for (let i = 0; i < arr.length; i++) {
    const subCtx = {
      input: ctx.input,
      output: {},
      memory: {
        ...ctx.memory,
        [step.as]: arr[i],
        [step.accumulator]: acc
      },
      depth: ctx.depth
    };

    let ip = 0;
    let counter = 0;

    while (ip < step.steps.length) {
      if (counter++ > 50) throw new Error("Reduce loop exceeded");

      const r = await executeStep(step.steps[ip], subCtx, ip);

      ip = r?.jump ?? ip + 1;
    }

    acc = subCtx.memory[step.accumulator];
  }

  ctx.memory[step.to] = acc;
  return;
}
```

---

# 🔧 4. AGGREGATOR (SHORTCUT OPS)

Biar tidak selalu pakai reduce manual, tambahkan ops ini:

---

## 📦 `sum`

```json
{
  "op": "sum",
  "source": "input.items",
  "to": "total"
}
```

```ts
case "sum": {
  const arr = getPath(ctx, step.source);
  ctx.memory[step.to] = arr.reduce((a, b) => a + b, 0);
  return;
}
```

---

## 📦 `avg`

```ts
case "avg": {
  const arr = getPath(ctx, step.source);
  const sum = arr.reduce((a, b) => a + b, 0);
  ctx.memory[step.to] = arr.length ? sum / arr.length : 0;
  return;
}
```

---

## 📦 `count`

```ts
case "count": {
  const arr = getPath(ctx, step.source);
  ctx.memory[step.to] = arr.length;
  return;
}
```

---

## 📦 `min` / `max`

```ts
case "min": {
  const arr = getPath(ctx, step.source);
  ctx.memory[step.to] = Math.min(...arr);
  return;
}

case "max": {
  const arr = getPath(ctx, step.source);
  ctx.memory[step.to] = Math.max(...arr);
  return;
}
```

---

# 🔒 5. VALIDATION TAMBAHAN

```ts
if (["filter", "reduce"].includes(step.op)) {
  if (!step.source || !step.as || !step.steps) return false;
}

if (step.op === "reduce") {
  if (!step.accumulator) return false;
}
```

---

# 🔒 6. LIMIT WAJIB

```ts
const MAX_ARRAY = 100;
const MAX_INNER_STEPS = 50;
```

Tanpa ini:
→ agent bisa bunuh server kamu sendiri

---

# 🔥 7. CONTOH KOMBINASI REAL

## 📌 Use case:

* filter angka > 5
* lalu jumlahkan

```json
{
  "logic": [
    {
      "op": "filter",
      "source": "input.items",
      "as": "item",
      "steps": [
        { "op": "compare", "a": "item", "b": 5, "operator": ">", "to": "ok" }
      ],
      "condition": "ok",
      "to": "filtered"
    },
    {
      "op": "sum",
      "source": "filtered",
      "to": "total"
    },
    {
      "op": "set",
      "path": "output.result",
      "value": "total"
    }
  ]
}
```

---

# 🧠 8. SEKARANG AGENT KAMU BISA

* transform data → `map`
* select data → `filter`
* aggregate data → `reduce / sum / avg`
* decision making → `if`
* call tools → `mcp_call`
* reuse logic → `call_skill`

👉 ini sudah **mini data-processing engine**

---

# ⚠️ 9. REAL LIMITATION (BIAR KAMU GA NGAYAL)

Masih belum bisa:

* parallel execution
* streaming data
* large dataset
* complex graph dependency

---

# 🎯 NEXT STEP (INI YANG NAIKIN KE LEVEL “SERIUS”)

Kalau kamu mau ini jadi **agent beneran, bukan toy system**:

### 🔥 1. vector search capability

→ cari skill bukan exact match

### 🔥 2. skill versioning

→ avoid overwrite chaos

### 🔥 3. persistent memory

→ agent punya pengalaman

### 🔥 4. planner upgrade (decomposition multi-step)

---

Kalau lanjut:

👉 bilang: **“upgrade capability search pakai embedding + vector DB”**

Itu titik dimana agent kamu mulai benar-benar “pintar”, bukan cuma rule-based.
