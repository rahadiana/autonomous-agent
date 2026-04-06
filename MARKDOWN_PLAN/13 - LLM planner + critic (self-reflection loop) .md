Kita tambahkan **LLM Planner + Critic (self-reflection loop)** di atas tree search kamu. Tujuannya:

* Planner: **dekomposisi goal + generate kandidat plan**
* Critic: **menilai, mendeteksi flaw, dan memberi perbaikan**
* Loop: **refine sampai lolos threshold atau limit iterasi**

Semua tetap **strict JSON**, tidak bocor reasoning, dan bisa di-audit.

---

# 🧠 1. ARSITEKTUR LOOP

```txt
User Input
   ↓
LLM Planner (draft plans)
   ↓
Tree Search (expand + simulate)
   ↓
LLM Critic (evaluate plans)
   ↓
Refine Plans (planner)
   ↓
Select Best Plan
   ↓
Execute (DSL)
   ↓
Evaluate → Reinforcement
```

---

# 🔧 2. KONTRAK JSON (WAJIB)

## Planner Output

```json
{
  "plans": [
    {
      "id": "plan_1",
      "steps": [
        { "capability": "api.fetch_data", "input": {} },
        { "capability": "array.filter", "input": {} },
        { "capability": "array.sum", "input": {} }
      ],
      "rationale": "short abstract intent (no chain-of-thought)"
    }
  ]
}
```

## Critic Output

```json
{
  "evaluations": [
    {
      "plan_id": "plan_1",
      "score": 0.82,
      "issues": ["step mismatch", "missing normalization"],
      "suggestions": ["add transform step before aggregation"]
    }
  ]
}
```

> Catatan: “rationale” ringkas, bukan reasoning panjang.

---

# 🔧 3. PROMPT: PLANNER (STRICT)

Gunakan sebagai system+user template ke LLM:

```txt
You are a planning module.

Decompose the user goal into 2–4 candidate plans using available capabilities.

Rules:
- Output JSON only
- No explanations
- Steps must be executable capabilities
- Prefer minimal steps
- Inputs must be schema-compatible (leave empty if unknown)

Available capabilities:
{{CAPABILITY_LIST}}

User goal:
{{USER_INPUT}}

Return:
{
  "plans": [...]
}
```

---

# 🔧 4. PROMPT: CRITIC (STRICT)

```txt
You are a plan critic.

Evaluate each plan for:
- correctness
- completeness
- efficiency
- compatibility between steps

Rules:
- Output JSON only
- No explanations
- Score 0.0–1.0

User goal:
{{USER_INPUT}}

Plans:
{{PLANS_JSON}}

Return:
{
  "evaluations": [...]
}
```

---

# 🔧 5. ORCHESTRATOR LOOP

```ts
const MAX_ITER = 3;
const ACCEPT_SCORE = 0.85;

async function planWithLLMLoop(input) {
  let plans = await plannerLLM(input);

  for (let i = 0; i < MAX_ITER; i++) {
    // optional: expand via tree search
    plans = await expandPlans(plans);

    const critique = await criticLLM(input, plans);

    const best = pickBestPlan(plans, critique);

    if (best.score >= ACCEPT_SCORE) {
      return best.plan;
    }

    plans = await refinePlans(plans, critique);
  }

  // fallback: best available
  return pickBestPlan(plans, await criticLLM(input, plans)).plan;
}
```

---

# 🔧 6. PICK BEST PLAN

```ts
function pickBestPlan(plans, critique) {
  let best = null;

  for (const p of plans) {
    const evalItem = critique.evaluations.find(
      e => e.plan_id === p.id
    );

    if (!best || evalItem.score > best.score) {
      best = { plan: p, score: evalItem.score };
    }
  }

  return best;
}
```

---

# 🔧 7. REFINE PLANS (SELF-REFLECTION)

Gunakan critic suggestions → feed ke planner lagi:

```ts
async function refinePlans(plans, critique) {
  const improved = [];

  for (const p of plans) {
    const evalItem = critique.evaluations.find(
      e => e.plan_id === p.id
    );

    if (evalItem.score < 0.85) {
      const refined = await plannerLLM({
        goal: p,
        feedback: evalItem.suggestions
      });

      improved.push(...refined.plans);
    } else {
      improved.push(p);
    }
  }

  return improved;
}
```

---

# 🔧 8. TREE SEARCH INTEGRATION

Gabungkan dengan planner:

```ts
async function expandPlans(plans) {
  const expanded = [];

  for (const p of plans) {
    const state = {
      goal: "",
      steps: p.steps,
      depth: p.steps.length
    };

    const refined = await treeSearch(state);

    expanded.push({
      id: p.id,
      steps: refined.steps
    });
  }

  return expanded;
}
```

---

# 🔧 9. EXECUTION PIPELINE

```ts
async function runAgent(input) {
  const plan = await planWithLLMLoop(input);

  const result = await executePlan(plan, input);

  const valid = validateOutput(result);

  await updateSkillStats(plan, valid);

  return result;
}
```

---

# 🔒 10. GUARDRAILS (WAJIB)

### Limit plan:

```ts
MAX_PLANS = 4
MAX_STEPS_PER_PLAN = 5
```

### Reject kalau:

* capability tidak ada
* loop mencurigakan
* step tidak kompatibel schema

---

# ⚠️ 11. FAILURE MODES

Kalau tidak dikontrol:

### ❌ hallucinated capability

→ planner bikin skill yang tidak ada

### ❌ over-planning

→ plan terlalu panjang

### ❌ critic bias

→ selalu approve plan jelek

---

# 🔧 12. SOLUSI

* whitelist capability dari registry
* enforce schema validation tiap step
* penalti plan panjang di scoring

---

# 🧠 13. DAMPAK SISTEM

Sebelum:

* tree search → eksplorasi mekanis

Sesudah:

* planner → arahkan eksplorasi
* critic → koreksi kesalahan
* loop → iteratif improve

👉 ini sudah masuk kategori:
**self-reflective agent architecture**

---

# 🚀 14. UPGRADE BERIKUTNYA (REAL ADVANCED)

Kalau kamu lanjut:

### 🔥 1. tool-aware planning (cost/latency aware)

### 🔥 2. execution feedback ke planner (online learning)

### 🔥 3. hierarchical planning (macro → micro steps)

### 🔥 4. multi-agent planner (planner vs critic terpisah model)

---

# ⚠️ REALITY CHECK

Ini bukan AGI.

Tapi:
👉 ini sudah arsitektur yang dipakai di banyak **AI agent production system modern** (planner + critic loop + tool execution)

---

Kalau kamu mau naik level lagi:

👉 bilang: **“bikin hierarchical planner (macro → micro decomposition)”**

Di situ agent kamu mulai bisa handle task kompleks (bukan cuma linear workflow).
