Berikut **critical audit terhadap perubahan (CHANGELOG vs implementasi nyata)** berdasarkan:

* Planning docs (file 2–23 yang kamu upload)
* DSL evolution + architecture layers
* (tidak terlihat adanya bukti implementasi penuh di repo → ini jadi fokus utama)

---

# 🚨 TEMUAN KRITIS (BERDASARKAN GAP)

---

## ❌ 1. DSL SUDAH DIDESAIN KOMPLEKS — TAPI EXECUTOR REAL BELUM TERBUKTI LENGKAP

### Evidence dari planning:

* Basic DSL ops (get/set/add) 
* Async MCP integration 
* Branching (if, jump, compare) 
* Map/filter/reduce

### Problem:

Tidak ada bukti bahwa:

* Semua op ini benar-benar terintegrasi dalam **1 executor unified**
* Tidak ada validator DSL
* Tidak ada instruction safety layer

👉 Ini red flag:
**DSL berkembang lebih cepat daripada runtime**

---

### 🔧 FIX (WAJIB)

**File target (harus ada):**

```
/core/executor.ts
```

### Issue:

Executor kemungkinan masih fragmented (per feature)

### Fix:

Gabungkan semua op ke satu dispatcher + validator:

```ts
const ALLOWED_OPS = new Set([
  "get","set","add","subtract","multiply","divide","concat",
  "mcp_call","compare","if","jump","map","filter","reduce"
]);

function validateStep(step) {
  if (!ALLOWED_OPS.has(step.op)) {
    throw new Error(`Invalid op: ${step.op}`);
  }
}
```

Tambahkan sebelum execute:

```ts
for (const step of skill.logic) {
  validateStep(step);
}
```

---

## ❌ 2. MCP ADA DI DSL — TAPI BELUM ADA ISOLATION LAYER

### Evidence:

* MCP design ada 
* Tapi tidak ada:

  * rate limit
  * timeout
  * whitelist enforcement runtime

---

### Problem:

Agent bisa:

* spam API
* hang execution
* inject tool misuse

---

### 🔧 FIX

**File:**

```
/core/mcp.ts
```

### Tambahkan guard:

```ts
const ALLOWED_TOOLS = ["http.get","http.post","json.parse"];

async function safeMcpCall(tool, args) {
  if (!ALLOWED_TOOLS.includes(tool)) {
    throw new Error("Tool not allowed");
  }

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 5000)
  );

  return Promise.race([
    mcp[tool](args),
    timeout
  ]);
}
```

Dan di executor:

```ts
const result = await safeMcpCall(tool, resolvedArgs);
```

---

## ❌ 3. BRANCHING SUDAH ADA — TAPI TIDAK ADA LOOP GUARD GLOBAL

### Evidence:

* map/filter/reduce punya counter limit
* tapi executor utama tidak punya global step limit

---

### Problem:

Infinite loop sangat mungkin terjadi dari:

* jump
* if branching

---

### 🔧 FIX

Di executor utama:

```ts
let stepsExecuted = 0;
const MAX_STEPS = 1000;

while (ip < steps.length) {
  if (stepsExecuted++ > MAX_STEPS) {
    throw new Error("Execution limit exceeded");
  }
```

---

## ❌ 4. SKILL LEARNING SYSTEM (DECAY, REINFORCEMENT) BELUM TERHUBUNG KE EXECUTION

### Evidence:

* Skill memory design lengkap 

### Problem:

Tidak ada bukti:

* executor memanggil updateSkillStats
* evaluator terhubung ke DB

👉 berarti:
**learning = tidak terjadi**

---

### 🔧 FIX

**File:**

```
/core/runtime.ts
```

Tambahkan hook setelah execution:

```ts
const result = await runDSL(skill.json, input);

const valid = validate(skill.output_schema, result);

await updateSkillStats(skill, valid);

return result;
```

---

## ❌ 5. BANDIT + MUTATION ADA DI DESIGN — TAPI TIDAK MASUK PIPELINE

### Evidence:

* UCB1 strategy 

### Problem:

Tidak ada:

* selector integration
* mutation trigger

---

### 🔧 FIX

Ganti skill selection:

```ts
const skills = await registry.findAll(capability);

const selected = await selectSkillWithBandit(skills);
```

Tambahkan exploration:

```ts
if (Math.random() < strategy.exploration_rate) {
  const mutated = mutateSkill(selected.json);
  const score = await testSkill(mutated);

  if (score > selected.score) {
    await createNewVersion(selected, mutated);
  }
}
```

---

## ❌ 6. PLANNER TREE SEARCH + LLM LOOP TIDAK TERHUBUNG KE EXECUTOR

### Evidence:

* tree search 
* LLM planner/critic 

### Problem:

Tidak ada orchestrator nyata yang:

* menjalankan loop lengkap
* bridging planner → executor → critic

---

### 🔧 FIX

**File:**

```
/core/orchestrator.ts
```

Implement minimal:

```ts
const plans = await plannerLLM(input);

const bestPlan = await treeSearch(plans);

const result = await executePlan(bestPlan, input);

const critique = await criticLLM(input, bestPlan, result);
```

---

## ❌ 7. MULTI-AGENT + BLACKBOARD = MASIH KONSEP

### Evidence:

* blackboard system 
* scheduler 

### Problem:

Tidak ada:

* event loop nyata
* agent isolation

---

### 🔧 FIX

Minimal scheduler:

```ts
while (state.status !== "done") {
  const runnable = agents
    .filter(a => a.canRun(state))
    .sort((a, b) => computePriority(b, state) - computePriority(a, state));

  const agent = runnable[0];

  await agent.run(state);
}
```

---

## ❌ 8. WORLD MODEL + SIMULATION + CURIOSITY = BELUM TERINTEGRASI

### Evidence:

* world model 
* simulation 
* curiosity 

### Problem:

Tidak ada:

* updateBelief dipanggil
* simulation sebelum execution
* goal queue dipakai

---

### 🔧 FIX

Pipeline:

```ts
const imagined = await imaginePlans(plans, bb);

const best = imagined[0];

const result = await executePlan(best.plan, input);

updateBelief(bb.belief, result);
updateWorld(bb.world, result);
```

---

## ❌ 9. META-REASONING + SELF-MODIFICATION = HIGH RISK, NO GUARD

### Evidence:

* meta reasoning 
* self-modifying 

### Problem:

Belum ada:

* sandbox enforcement real
* rollback enforcement
* audit log

👉 ini sangat berbahaya

---

### 🔧 FIX

WAJIB:

```ts
if (mod.target === "executor") {
  throw new Error("Forbidden modification");
}
```

Tambahkan audit log:

```ts
await AuditLog.create({
  mod,
  result: "accepted",
  score_diff: newScore - oldScore
});
```

---

# 🚨 KESIMPULAN KERAS

## Sistem kamu sekarang:

### ❌ BUKAN autonomous agent

### ❌ BELUM self-improving

### ❌ BELUM learning system

---

## Sistem kamu saat ini:

👉 **"Spec-driven architecture dengan implementasi parsial"**

---

# 🔥 PRIORITAS PERBAIKAN (WAJIB URUT)

1. **Executor stabil (DSL full support + guard)**
2. **Skill execution + evaluation hook**
3. **Skill registry + bandit selection**
4. **Planner → Executor → Critic loop**
5. **Memory (episodic + skill stats)**

---

Kalau kamu mau, next step gue bisa:

👉 audit langsung isi repo file per file (real code, bukan design)
👉 dan tandain bagian yang fake / belum jalan

Itu bakal jauh lebih brutal (dan lebih akurat).
