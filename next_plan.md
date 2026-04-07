Berikut adalah **mapping konkret antara perubahan (CHANGELOG + planning docs) → implementasi DSL & runtime**, dengan fokus:

* input / output tiap fungsi
* kontrak data nyata
* bukti dari code (file raw yang kamu kasih)

Saya tidak akan ulang teori—ini **engineering contract level** supaya agent lain bisa langsung ngerti & implement.

---

# 🔴 1. CORE EXECUTOR

## `runDSL(skill, input)`

📍 Evidence: 

### ✅ Input

```ts
skill: {
  logic: Step[]
}

input: any
```

### ✅ Output

```ts
output: any
```

### ⚠️ Behavior

* Inisialisasi context:

```ts
{
  input,
  output: {},
  memory: {}
}
```

### ⚠️ Masalah

* ❌ Tidak ada schema validation sebelum execute
* ❌ Tidak enforce output_schema

### ✅ Fix

Tambahkan:

```ts
if (!validateDSL(skill)) throw new Error("Invalid DSL");

validateInput(skill.input_schema, input);
```

---

# 🔴 2. `executeStep(step, ctx)`

📍 Evidence: 

### ✅ Input

```ts
step: {
  op: string,
  ...params
}

ctx: {
  input,
  output,
  memory
}
```

### ✅ Output

```ts
void | { jump: number }
```

### Behavior per op:

---

## `get`

### Input

```json
{
  "op": "get",
  "path": "input.a",
  "to": "a"
}
```

### Output

```ts
ctx.memory["a"] = value
```

---

## `set`

### Input

```json
{
  "op": "set",
  "path": "output.result",
  "value": "result"
}
```

### Output

```ts
ctx.output.result = resolvedValue
```

---

## `add / subtract / multiply / divide`

### Input

```json
{
  "op": "add",
  "a": "a",
  "b": "b",
  "to": "result"
}
```

### Output

```ts
ctx.memory["result"] = number
```

---

## ⚠️ Critical Issue

* ❌ Tidak ada type check (string + number bisa kacau)
* ❌ divide by zero silent → null

### ✅ Fix

```ts
if (typeof a !== "number" || typeof b !== "number") {
  throw new Error("Invalid numeric operation");
}
```

---

# 🔵 3. MCP CALL

📍 Evidence: 

## `mcp_call`

### Input

```json
{
  "op": "mcp_call",
  "tool": "http.get",
  "args": { "url": "..." },
  "to": "response"
}
```

### Output

```ts
ctx.memory["response"] = {
  status: number,
  body: string
}
```

---

## `mcp[tool](args)`

### Input

```ts
args: any
```

### Output

```ts
Promise<any>
```

---

## ⚠️ Critical Findings

* ❌ Tidak ada timeout
* ❌ Tidak ada retry
* ❌ Tidak normalize JSON vs text

### ✅ Fix

```ts
async function safeCall(tool, args) {
  return withTimeout(() => mcp[tool](args), 5000);
}
```

---

# 🟣 4. CONDITIONAL ENGINE

📍 Evidence: 

## `compare`

### Input

```json
{
  "op": "compare",
  "a": "x",
  "b": "y",
  "operator": "==",
  "to": "isEqual"
}
```

### Output

```ts
ctx.memory["isEqual"] = boolean
```

---

## `if`

### Input

```json
{
  "op": "if",
  "condition": "isEqual",
  "true_jump": 6,
  "false_jump": 3
}
```

### Output

```ts
{ jump: number }
```

---

## ⚠️ Critical Issue

* ❌ No bounds safety at runtime (only validation phase)
* ❌ No max depth global

### ✅ Fix

Tambahkan:

```ts
if (ip >= steps.length) throw new Error("Invalid jump");
```

---

# 🟢 5. MAP (ARRAY ENGINE)

📍 Evidence: 

## `map`

### Input

```json
{
  "op": "map",
  "source": "input.items",
  "as": "item",
  "steps": [...],
  "to": "results"
}
```

### Output

```ts
ctx.memory["results"] = Array<subCtx.output>
```

---

## ⚠️ Critical Findings

* ❌ deep copy memory tiap iterasi → heavy
* ❌ no parallelization
* ❌ nested map bisa explode

### ✅ Fix

```ts
if (ctx.depth > MAX_DEPTH) throw new Error("Too deep");
```

---

# 🟡 6. FILTER

📍 Evidence: 

### Input

```json
{
  "op": "filter",
  "source": "input.items",
  "as": "item",
  "condition": "keep"
}
```

### Output

```ts
ctx.memory["filtered"] = filteredArray
```

---

## ⚠️ Issue

* ❌ silent failure kalau condition undefined

### ✅ Fix

```ts
if (typeof keep !== "boolean") throw new Error("Invalid filter condition");
```

---

# 🟠 7. REDUCE

📍 Evidence: 

### Input

```json
{
  "op": "reduce",
  "source": "input.items",
  "accumulator": "acc",
  "initial": 0
}
```

### Output

```ts
ctx.memory["sum"] = finalValue
```

---

## ⚠️ Issue

* ❌ accumulator bisa undefined
* ❌ no type safety

---

# 🧠 8. SKILL MEMORY SYSTEM

📍 Evidence: 

## `updateSkillStats(skill, success)`

### Input

```ts
skill: DB record
success: boolean
```

### Output

```ts
DB update
```

---

## Formula

```ts
newScore =
  (oldScore * 0.7) +
  (successRate * 0.3)
```

---

## ⚠️ Issue

* ❌ bias ke early score (cold start problem)
* ❌ no confidence interval

### ✅ Fix

Gunakan:

```ts
score = (success + 1) / (usage + 2)
```

---

# 🧬 9. BANDIT SELECTION

📍 Evidence: 

## `banditScore(skill, totalSelections)`

### Input

```ts
skill: { score, usage_count }
totalSelections: number
```

### Output

```ts
number
```

---

## Formula

```ts
score =
  exploit +
  c * sqrt(log(total) / usage)
```

---

## ⚠️ Issue

* ❌ no cap → exploration bisa terlalu besar
* ❌ usage_count = 0 → bias ekstrem

### ✅ Fix

```ts
usage = Math.max(skill.usage_count, 1);
```

---

# 🧠 10. TREE SEARCH

📍 Evidence: 

## `treeSearch(initialState)`

### Input

```ts
State {
  goal,
  steps,
  score,
  depth
}
```

### Output

```ts
best State
```

---

## ⚠️ Issue

* ❌ score random → tidak meaningful
* ❌ tidak pakai execution feedback

### ✅ Fix

```ts
score += simulateStepScore(...)
```

---

# 🔁 11. MULTI-AGENT ORCHESTRATOR

📍 Evidence: 

## `runMultiAgent(input)`

### Input

```ts
input: string | object
```

### Output

```ts
result: any
```

---

## Flow Output

```ts
{
  plan,
  result,
  score,
  critique
}
```

---

## ⚠️ Critical Issue

* ❌ hanya 1 refinement iteration
* ❌ tidak persistent memory integration

---

# 🧠 12. EPISODIC MEMORY

📍 Evidence: 

## `tryReuse(goal)`

### Input

```ts
goal: string
```

### Output

```ts
Episode | null
```

---

## ⚠️ Issue

* ❌ embedding brute-force (no index)
* ❌ O(n) scan

### ✅ Fix

Use:

```ts
faiss / pgvector
```

---

# 🧠 13. BLACKBOARD SYSTEM

📍 Evidence: 

## `BlackboardStore.set(patch)`

### Input

```ts
patch: partial state
```

### Output

```ts
state updated + notify()
```

---

## ⚠️ Issue

* ❌ race condition (no locking)
* ❌ no transaction

---

# 🔥 FINAL CRITICAL SUMMARY

## ❌ FAKE / PARTIAL IMPLEMENTATION DETECTED

1. **Planner intelligence**

   * masih random scoring
   * belum pakai real evaluation

2. **Simulation engine**

   * hardcoded rules (mock)
   * bukan real world model

3. **Self-improvement**

   * belum connect ke executor result nyata

4. **Autonomy**

   * masih orchestrated, bukan truly self-driven

---

# ✅ PRIORITY FIX (WAJIB)

### 1. Enforce schema

```ts
validate(input_schema)
validate(output_schema)
```

---

### 2. Replace random scoring

```ts
score = execution_success + simulation_score
```

---

### 3. Add execution trace

```ts
trace.push({ step, input, output })
```

---

### 4. Add global safety guard

```ts
MAX_TOTAL_STEPS = 1000
MAX_DEPTH = 5
```

---

### 5. Normalize MCP output

```ts
return {
  ok: boolean,
  data: parsed,
  error: null
}
```

---

Kalau kamu lanjut, saya bisa:

* mapping **per file GitHub (real repo)** → mana yang belum diimplement
* atau bongkar **autonomy claim vs real execution loop (lebih brutal audit)**
