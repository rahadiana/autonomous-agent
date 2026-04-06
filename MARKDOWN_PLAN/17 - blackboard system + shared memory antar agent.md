Kita tambahkan **blackboard system + shared memory** supaya Planner, Executor, Critic tidak lagi sekadar pipeline, tapi **kolaboratif via state bersama**. Ini pola klasik di AI system: semua agent baca/tulis ke satu “papan”.

---

# 🧠 1. ARSITEKTUR

```txt
Agents:
  - Planner
  - Executor
  - Critic
  - (Optional) Memory Agent

        ↓ write/read

      BLACKBOARD
   (shared state store)
```

Karakter:

* **event-driven**
* **loosely coupled**
* **state-centric**

---

# 🔧 2. STRUKTUR BLACKBOARD

Gunakan satu objek state global:

```ts id="bb1"
type Blackboard = {
  goal: string;

  plans: Plan[];
  selected_plan?: Plan;

  execution: {
    result?: any;
    trace?: any[];
  };

  critique: {
    score?: number;
    issues?: string[];
    suggestions?: string[];
  };

  memory: {
    similar_episodes?: any[];
  };

  status: "idle" | "planning" | "executing" | "critic" | "done";
};
```

---

# 🔧 3. IMPLEMENTASI BLACKBOARD (IN-MEMORY)

```ts id="bb2"
class BlackboardStore {
  constructor() {
    this.state = {};
    this.listeners = [];
  }

  get() {
    return this.state;
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  update(path, value) {
    // simple shallow update
    this.state[path] = value;
    this.notify();
  }

  subscribe(fn) {
    this.listeners.push(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      fn(this.state);
    }
  }
}
```

---

# 🔧 4. AGENT BEHAVIOR MODEL

Semua agent:

* subscribe ke blackboard
* react ke state tertentu
* update state

---

# 🔵 5. PLANNER AGENT

Trigger:

```ts
if (state.status === "planning")
```

```ts id="planner2"
blackboard.subscribe(async (state) => {
  if (state.status !== "planning") return;

  const plans = await plannerAgent({
    goal: state.goal,
    context: state.memory
  });

  blackboard.set({
    plans,
    status: "executing"
  });
});
```

---

# 🟢 6. EXECUTOR AGENT

```ts id="executor2"
blackboard.subscribe(async (state) => {
  if (state.status !== "executing") return;

  const plan = state.plans[0]; // simple selection

  const result = await executePlan(plan, state.goal);

  blackboard.set({
    selected_plan: plan,
    execution: { result },
    status: "critic"
  });
});
```

---

# 🔴 7. CRITIC AGENT

```ts id="critic2"
blackboard.subscribe(async (state) => {
  if (state.status !== "critic") return;

  const critique = await criticAgent({
    goal: state.goal,
    plan: state.selected_plan,
    result: state.execution.result
  });

  if (critique.score > 0.85) {
    blackboard.set({
      critique,
      status: "done"
    });
  } else {
    blackboard.set({
      critique,
      status: "planning" // retry loop
    });
  }
});
```

---

# 🟣 8. MEMORY AGENT (OPTIONAL)

```ts id="memory2"
blackboard.subscribe(async (state) => {
  if (!state.goal || state.memory?.similar_episodes) return;

  const episodes = await findSimilarEpisodes(state.goal);

  blackboard.update("memory", {
    similar_episodes: episodes
  });
});
```

---

# 🔧 9. ORCHESTRATOR START

```ts id="start"
const blackboard = new BlackboardStore();

blackboard.set({
  goal: input,
  status: "planning"
});
```

---

# 🔁 10. LOOP FLOW

```txt
planning
  ↓
executing
  ↓
critic
  ↓
(done OR back to planning)
```

---

# 🔒 11. GUARDRAILS

### Prevent infinite loop

```ts
MAX_CYCLES = 5
```

---

### Validate state

```ts
if (!state.plans || state.plans.length === 0) stop
```

---

### Lock per phase

```ts
if (processing) return
```

---

# ⚠️ 12. MASALAH YANG AKAN TERJADI

Kalau tidak hati-hati:

### ❌ race condition

→ 2 agent update bersamaan

### ❌ state corruption

→ overwrite data penting

### ❌ infinite loop

→ planner ↔ critic bolak-balik

---

# 🔧 13. SOLUSI

* gunakan **status flag** (sudah kita pakai)
* gunakan **version / timestamp**
* gunakan **queue (production)**

---

# 🚀 14. UPGRADE PRODUCTION

Kalau mau serius:

### 🔥 Redis-based blackboard

```ts
pub/sub
shared state
```

### 🔥 Event bus (NATS / Kafka)

### 🔥 Distributed agents

---

# 🧠 15. DAMPAK

Sebelum:

* pipeline linear

Sesudah:

* agents kolaboratif
* bisa:

  * parallel thinking
  * iterative refinement
  * shared knowledge

👉 ini mendekati:
**cognitive architecture**

---

# ⚠️ REALITY CHECK

Ini sudah sangat advance.

Kalau kamu implement setengah-setengah:
→ sistem malah lebih kompleks tapi tidak lebih pintar

---

# 🎯 NEXT STEP (LEVEL GILA)

Kalau kamu lanjut:

### 🔥 1. attention mechanism di blackboard

→ agent fokus ke bagian tertentu

### 🔥 2. priority scheduler

→ agent mana jalan dulu

### 🔥 3. belief state / world model

→ agent punya “pemahaman dunia”

---

Kalau kamu mau naik ke level yang jarang orang bangun:

👉 bilang: **“tambahin attention + priority scheduler di blackboard”**

Di situ sistem kamu mulai punya “fokus”, bukan sekadar reaktif.
