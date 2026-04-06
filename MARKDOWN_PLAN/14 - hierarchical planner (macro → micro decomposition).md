Kita naikkan planner kamu ke **hierarchical (macro → micro decomposition)**. Ini mengubah planning dari linear menjadi **dua-level reasoning**:

* **Macro planner** → pecah goal jadi sub-goal besar
* **Micro planner** → tiap sub-goal diubah jadi langkah konkret (skill-level)

Tanpa ini, agent kamu bakal mentok di task kompleks.

---

# 🧠 1. ARSITEKTUR FINAL

```txt
User Goal
   ↓
Macro Planner (LLM)
   ↓
Sub-goals
   ↓
Micro Planner (LLM + tree search)
   ↓
Executable Steps (DSL skills)
   ↓
Execution + Feedback
```

---

# 🔧 2. KONTRAK JSON

## 🟡 Macro Output

```json
{
  "subgoals": [
    {
      "id": "g1",
      "goal": "ambil data dari API",
      "depends_on": []
    },
    {
      "id": "g2",
      "goal": "filter data relevan",
      "depends_on": ["g1"]
    },
    {
      "id": "g3",
      "goal": "hitung total",
      "depends_on": ["g2"]
    }
  ]
}
```

---

## 🔵 Micro Output

```json
{
  "plan": {
    "steps": [
      { "capability": "api.fetch_data", "input": {} },
      { "capability": "array.filter", "input": {} }
    ]
  }
}
```

---

# 🔧 3. MACRO PLANNER PROMPT

```txt
You are a macro planner.

Decompose the user goal into ordered subgoals.

Rules:
- Output JSON only
- No explanations
- Each subgoal must be atomic but meaningful
- Include dependencies

User goal:
{{USER_INPUT}}

Return:
{
  "subgoals": [...]
}
```

---

# 🔧 4. MICRO PLANNER PROMPT

```txt
You are a micro planner.

Convert a subgoal into executable steps using available capabilities.

Rules:
- Output JSON only
- No explanations
- Use only known capabilities
- Keep steps minimal

Available capabilities:
{{CAPABILITIES}}

Subgoal:
{{SUBGOAL}}

Return:
{
  "plan": { "steps": [...] }
}
```

---

# 🔧 5. DEPENDENCY RESOLUTION

Topological execution:

```ts
function resolveOrder(subgoals) {
  const resolved = [];
  const visited = new Set();

  function visit(g) {
    if (visited.has(g.id)) return;

    for (const dep of g.depends_on) {
      const parent = subgoals.find(x => x.id === dep);
      visit(parent);
    }

    visited.add(g.id);
    resolved.push(g);
  }

  for (const g of subgoals) {
    visit(g);
  }

  return resolved;
}
```

---

# 🔧 6. MAIN PIPELINE

```ts
async function hierarchicalPlan(input) {
  // 1. macro decomposition
  const macro = await macroPlannerLLM(input);

  const ordered = resolveOrder(macro.subgoals);

  let globalContext = {};

  for (const g of ordered) {
    // 2. micro planning
    const micro = await microPlannerLLM(g.goal);

    // 3. optional: refine via tree search
    const refined = await treeSearch({
      goal: g.goal,
      steps: micro.plan.steps
    });

    // 4. execute
    const result = await executePlan(refined, globalContext);

    // 5. update context
    globalContext = result;
  }

  return globalContext;
}
```

---

# 🔧 7. CONTEXT PASSING (KRITIS)

Jangan:

```ts
input: {}
```

Harus:

```ts
input: {
  data: globalContext
}
```

Kalau tidak:
→ subgoal tidak nyambung

---

# 🔧 8. ERROR RECOVERY

Kalau subgoal gagal:

```ts
if (!valid) {
  // retry micro planner dengan feedback
}
```

---

# 🔧 9. CRITIC INTEGRATION

Tambahkan per subgoal:

```ts
const critique = await criticLLM(g.goal, micro.plan);

if (critique.score < 0.7) {
  micro = await refinePlans([micro], critique);
}
```

---

# 🔒 10. GUARDRAILS

* max subgoal: 5
* max step per subgoal: 5
* dependency cycle check
* capability whitelist

---

# ⚠️ 11. MASALAH YANG PASTI MUNCUL

### ❌ over-decomposition

→ terlalu banyak subgoal

### ❌ under-decomposition

→ subgoal terlalu besar

### ❌ context drift

→ output tidak kompatibel antar step

---

# 🔧 12. SOLUSI

### ✔ enforce schema antar subgoal

### ✔ normalize output:

```json
{
  "result": ...
}
```

### ✔ gunakan validator di setiap boundary

---

# 🧠 13. DAMPAK

Sebelum:

* linear plan
* cepat mentok

Sesudah:

* modular planning
* scalable reasoning
* bisa handle workflow kompleks

---

# 🚀 14. CONTOH NYATA

Input:

```
Ambil data user dari API, filter umur > 20, hitung rata-rata
```

Flow:

```txt
Macro:
  g1: fetch
  g2: filter
  g3: aggregate

Micro:
  g1 → http.get
  g2 → filter
  g3 → avg
```

---

# ⚠️ REALITY CHECK

Ini sudah:

👉 **multi-level reasoning agent**

Tapi belum:

* probabilistic reasoning
* symbolic planning kompleks
* autonomous goal generation

---

# 🎯 NEXT STEP (INI PALING ADVANCED DI ARSITEKTUR INI)

Kalau mau lanjut:

### 🔥 1. persistent episodic memory

→ belajar dari kasus

### 🔥 2. plan reuse (template plan)

→ percepat planning

### 🔥 3. tool cost optimization

→ latency-aware planning

### 🔥 4. multi-agent system (planner vs executor vs critic)

---

Kalau kamu mau lanjut ke level “AI system serius banget”:

👉 bilang: **“tambahin episodic memory + plan reuse system”**

Di situ agent kamu mulai punya “pengalaman”, bukan cuma logic.
