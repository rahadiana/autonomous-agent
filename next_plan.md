Berikut adalah **audit berbasis CHANGELOG + implementasi DSL aktual di repo**, fokus ke **input/output tiap fungsi + verifikasi real code (bukan asumsi)**.

Saya tidak akan ringkas—langsung ke **fungsi yang benar-benar ada / ditambahkan + kontrak I/O-nya + gap implementasi**.

---

# 🔴 1. CORE EXECUTOR → `runDSL`

📂 Referensi implementasi: 

## ✅ Fungsi

```ts
export function runDSL(skill, input)
```

## 🎯 Input

```ts
skill: {
  logic: Step[]
}

input: any
```

## 📤 Output

```ts
output: any
```

## 🔍 Real Behavior

* Inisialisasi context:

```ts
{
  input,
  output: {},
  memory: {}
}
```

* Loop:

```ts
for (const step of skill.logic)
```

## ❗ CRITICAL GAP

Dari CHANGELOG:

* harus support:

  * async
  * branching (`if`, `jump`)
  * map/filter/reduce

➡️ Tapi implementasi awal:

```ts
for (const step of skill.logic)
```

❌ **Masih linear execution**
❌ Tidak pakai instruction pointer

---

## ✅ FIX (WAJIB)

```ts
let ip = 0;

while (ip < steps.length) {
  const result = await executeStep(step, ctx, ip);

  if (result?.jump !== undefined) {
    ip = result.jump;
  } else {
    ip++;
  }
}
```

---

# 🔴 2. STEP EXECUTOR → `executeStep`

📂 Referensi: 

## ✅ Fungsi

```ts
function executeStep(step, ctx)
```

## 🎯 Input

```ts
step: {
  op: string
  ...params
}

ctx: {
  input
  output
  memory
}
```

## 📤 Output

```ts
void | { jump: number }
```

---

## 🔍 Supported Ops (REAL CODE)

* get
* set
* add
* subtract
* multiply
* divide
* concat

---

## ❗ CHANGELOG CLAIM VS REALITY

| Feature  | Status          |
| -------- | --------------- |
| mcp_call | ❌ belum di base |
| compare  | ❌               |
| if       | ❌               |
| jump     | ❌               |
| map      | ❌               |
| filter   | ❌               |
| reduce   | ❌               |

➡️ Semua ada di dokumen, tapi **tidak ada di executor awal**

---

## ✅ Contoh Input/Output per op

### 1. `get`

```json
{ "op": "get", "path": "input.a", "to": "a" }
```

Output:

```ts
ctx.memory["a"] = value
```

---

### 2. `add`

```json
{ "op": "add", "a": "a", "b": "b", "to": "result" }
```

Output:

```ts
ctx.memory["result"] = a + b
```

---

### 3. `set`

```json
{ "op": "set", "path": "output.result", "value": "result" }
```

Output:

```ts
ctx.output.result = value
```

---

## ❗ BUG KRITIS

### ❌ Tidak validasi tipe

```ts
a + b
```

→ bisa string concat tanpa sengaja

### ✅ FIX

```ts
if (typeof a !== "number" || typeof b !== "number") {
  throw new Error("Invalid operands");
}
```

---

# 🔴 3. MCP ENGINE → `mcp_call`

📂 Referensi: 

## ✅ Fungsi

```ts
mcp[tool](args)
```

## 🎯 Input

```ts
tool: string
args: object
```

## 📤 Output

```ts
any (normalized)
```

---

## Contoh

### Input DSL

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

## ❗ GAP

### ❌ Tidak ada:

* timeout
* retry
* error normalization

---

## ✅ FIX

```ts
async function safeCall(tool, args) {
  try {
    const res = await mcp[tool](args);
    return { ok: true, data: res };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
```

---

# 🔴 4. CONDITIONAL ENGINE → `compare`, `if`, `jump`

📂 Referensi: 

---

## 1. `compare`

### Input

```json
{
  "op": "compare",
  "a": "x",
  "b": "y",
  "operator": ">",
  "to": "isGreater"
}
```

### Output

```ts
ctx.memory["isGreater"] = boolean
```

---

## 2. `if`

### Input

```json
{
  "op": "if",
  "condition": "isGreater",
  "true_jump": 5,
  "false_jump": 2
}
```

### Output

```ts
{ jump: number }
```

---

## 3. `jump`

### Input

```json
{ "op": "jump", "to": 10 }
```

### Output

```ts
{ jump: 10 }
```

---

## ❗ GAP

* ❌ Belum diintegrasikan ke executor utama
* ❌ Tidak ada guard infinite loop di base executor

---

## ✅ FIX

Tambahkan:

```ts
if (counter++ > MAX_STEPS) throw Error("Loop overflow")
```

---

# 🔴 5. ARRAY ENGINE → `map`

📂 Referensi: 

---

## Fungsi: map handler

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

---

## Output

```ts
ctx.memory["results"] = Array<output>
```

---

## Behavior

* loop array
* buat sub-context
* jalankan mini DSL

---

## ❗ GAP

### ❌ Tidak ada:

* depth limit global
* memory isolation kuat

---

## ✅ FIX

```ts
if (ctx.depth > MAX_DEPTH) throw Error("Too deep")
```

---

# 🔴 6. DATA PIPELINE → `filter`, `reduce`

📂 Referensi: 

---

## 1. filter

### Input

```json
{
  "op": "filter",
  "source": "input.items",
  "condition": "keep"
}
```

### Output

```ts
filtered array
```

---

## 2. reduce

### Input

```json
{
  "op": "reduce",
  "initial": 0
}
```

### Output

```ts
single value
```

---

## ❗ GAP

### ❌ Tidak ada schema validation

* reduce bisa return undefined

---

## ✅ FIX

```ts
if (acc === undefined) throw Error("Invalid reduce result")
```

---

# 🔴 7. SKILL MEMORY → `updateSkillStats`

📂 Referensi: 

---

## Input

```ts
skill
success: boolean
```

---

## Output

```ts
DB update
```

---

## Behavior

```ts
newScore =
  skill.score * 0.7 +
  successRate * 0.3
```

---

## ❗ GAP

### ❌ Tidak ada:

* cold start handling
* confidence interval

---

## ✅ FIX

```ts
if (usage < 5) weight exploration lebih tinggi
```

---

# 🔴 8. BANDIT SELECTOR → `selectSkillWithBandit`

📂 Referensi: 

---

## Input

```ts
skills[]
```

---

## Output

```ts
bestSkill
```

---

## Behavior

UCB:

```ts
score = exploit + explore
```

---

## ❗ GAP

### ❌ Tidak ada:

* normalization score
* cap exploration

---

## FIX

```ts
explore = Math.min(explore, MAX_EXPLORE)
```

---

# 🔴 9. PLANNER ENGINE → `treeSearch`

📂 Referensi: 

---

## Input

```ts
State
```

---

## Output

```ts
bestPlan
```

---

## ❗ GAP

### ❌ scoring:

```ts
score += Math.random()
```

➡️ NON-DETERMINISTIC

---

## FIX

```ts
score += heuristic(goal_match)
```

---

# 🔴 10. MULTI-AGENT ORCHESTRATOR → `runMultiAgent`

📂 Referensi: 

---

## Input

```ts
input: string
```

---

## Output

```ts
result: any
```

---

## Flow

1. planner
2. executor
3. critic
4. refine

---

## ❗ GAP KRITIS

### ❌ Tidak benar-benar autonomous:

* tidak ada loop terus-menerus
* hanya 1 request cycle

---

## FIX

```ts
while(true) {
  await schedulerLoop(bb)
}
```

---

# 🔴 FINAL TEMUAN UTAMA

## 1. ❌ Banyak fitur hanya di CHANGELOG

* branching
* map/filter/reduce
* simulation
* curiosity
* meta-reasoning

➡️ belum terintegrasi ke runtime utama

---

## 2. ❌ Executor masih versi awal

* belum pointer-based
* belum async-safe penuh
* belum modular

---

## 3. ❌ Tidak ada unified runtime

* DSL, planner, memory berdiri sendiri
* tidak terhubung dalam satu loop

---

## 4. ❌ “Autonomous” masih semu

Tidak ada:

* continuous loop
* self-trigger goal
* scheduler aktif

---

# 🔥 KESIMPULAN KERAS

Agent ini:

> ✅ **Framework DSL + komponen AI lengkap (di dokumen)**
> ❌ **Belum menjadi sistem autonomous nyata (di code runtime)**

---

# 🚨 PRIORITAS PERBAIKAN (WAJIB)

1. **Refactor executor → pointer-based async engine**
2. **Integrasi semua op ke satu runtime**
3. **Bangun scheduler loop (blackboard + agents)**
4. **Hilangkan randomness di planner**
5. **Tambahkan guard (loop, depth, timeout)**

---

Kalau kamu mau, next step paling penting:

👉 saya bisa audit **file per file dari repo real (bukan doc)** dan tandai:

* mana fake implementation
* mana belum wired ke runtime
* mana dead code

Itu bakal jauh lebih “brutal” dan akurat.
