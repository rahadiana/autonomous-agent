Kita tambahkan **attention mechanism + priority scheduler** ke blackboard. Tujuannya:

* Agent tidak “buta” → hanya baca bagian state yang relevan (**attention**)
* Eksekusi tidak chaos → ada urutan kerja berbasis nilai (**priority scheduling**)

Ini mengubah sistem kamu dari event-reactive → **goal-directed coordination system**.

---

# 🧠 1. KONSEP INTI

## Sebelum

* semua agent baca seluruh state
* semua trigger jalan → konflik

## Sesudah

* agent hanya baca “focus slice”
* scheduler menentukan siapa jalan dulu

---

# 🔧 2. BLACKBOARD UPGRADE

Tambahkan metadata:

```ts
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

  attention: {
    focus: string[];     // path yang penting
    weights: Record<string, number>;
  };

  status: string;
  cycle: number;
};
```

---

# 🔧 3. ATTENTION SYSTEM

## 📌 SET ATTENTION

```ts
function setAttention(blackboard, focusPaths) {
  const weights = {};

  for (const path of focusPaths) {
    weights[path] = 1.0;
  }

  blackboard.set({
    attention: {
      focus: focusPaths,
      weights
    }
  });
}
```

---

## 📌 GET FOCUSED STATE

```ts
function getFocusedState(state) {
  const focused = {};

  for (const path of state.attention.focus) {
    focused[path] = state[path];
  }

  return focused;
}
```

---

## 📌 AUTO ATTENTION UPDATE

Contoh:

```ts
// Planner fokus ke goal + memory
setAttention(bb, ["goal", "memory"]);

// Executor fokus ke plan
setAttention(bb, ["plans", "selected_plan"]);

// Critic fokus ke result
setAttention(bb, ["execution", "selected_plan"]);
```

---

# 🔧 4. PRIORITY SCHEDULER (CORE)

Alih-alih semua agent subscribe langsung → pakai scheduler.

---

## 📌 AGENT REGISTRATION

```ts
const agents = [
  {
    name: "planner",
    priority: 3,
    canRun: (state) => state.status === "planning",
    run: plannerHandler
  },
  {
    name: "executor",
    priority: 2,
    canRun: (state) => state.status === "executing",
    run: executorHandler
  },
  {
    name: "critic",
    priority: 1,
    canRun: (state) => state.status === "critic",
    run: criticHandler
  }
];
```

---

# 🔧 5. DYNAMIC PRIORITY (SMART)

Gunakan scoring:

```ts
function computePriority(agent, state) {
  let base = agent.priority;

  // urgency boost
  if (state.critique?.score < 0.5) base += 2;

  // stagnation boost
  if (state.cycle > 2) base += 1;

  return base;
}
```

---

# 🔧 6. SCHEDULER LOOP

```ts
async function schedulerLoop(blackboard) {
  const MAX_CYCLES = 10;

  while (blackboard.state.cycle < MAX_CYCLES) {
    const state = blackboard.get();

    const runnable = agents
      .filter(a => a.canRun(state))
      .map(a => ({
        agent: a,
        priority: computePriority(a, state)
      }))
      .sort((a, b) => b.priority - a.priority);

    if (runnable.length === 0) break;

    const selected = runnable[0].agent;

    // set attention sebelum run
    applyAttention(selected.name, blackboard);

    await selected.run(blackboard);

    blackboard.state.cycle++;
  }
}
```

---

# 🔧 7. APPLY ATTENTION PER AGENT

```ts
function applyAttention(agentName, bb) {
  switch (agentName) {
    case "planner":
      setAttention(bb, ["goal", "memory"]);
      break;

    case "executor":
      setAttention(bb, ["selected_plan"]);
      break;

    case "critic":
      setAttention(bb, ["execution", "selected_plan"]);
      break;
  }
}
```

---

# 🔧 8. AGENT HANDLER (UPDATED)

Planner pakai focused state:

```ts
async function plannerHandler(bb) {
  const state = getFocusedState(bb.get());

  const plans = await plannerAgent({
    goal: state.goal,
    context: state.memory
  });

  bb.set({
    plans,
    status: "executing"
  });
}
```

---

# 🔧 9. STARVATION PREVENTION

Jangan biarkan 1 agent dominan:

```ts
agent.lastRun = timestamp

priority -= (now - lastRun < 1000 ? 1 : 0)
```

---

# 🔒 10. LOOP CONTROL

```ts
if (bb.state.cycle > MAX_CYCLES) {
  bb.set({ status: "done" });
}
```

---

# ⚠️ 11. MASALAH KRITIS

Kalau salah implement:

### ❌ attention salah

→ agent kehilangan data penting

### ❌ priority bias

→ planner jalan terus, executor tidak jalan

### ❌ deadlock

→ tidak ada agent eligible

---

# 🔧 12. SOLUSI

* fallback agent (default executor)
* minimum priority threshold
* logging tiap cycle

---

# 🧠 13. DAMPAK

Sebelum:

* reactive system
* tidak terkontrol

Sesudah:

* fokus (attention)
* terarah (priority)
* stabil (scheduler)

👉 ini mendekati:
**cognitive control system (mirip executive function di otak)**

---

# 🚀 14. NEXT STEP (PALING GILA)

Kalau kamu lanjut:

### 🔥 1. belief state / world model

→ agent punya “pemahaman keadaan”

### 🔥 2. goal stack (multi-goal reasoning)

→ bisa handle banyak objective

### 🔥 3. meta-controller agent

→ agent yang mengatur agent lain

---

Kalau kamu mau naik ke level yang jarang banget orang sampai:

👉 bilang: **“tambahin world model + belief state system”**

Di situ sistem kamu mulai punya “state of reality”, bukan cuma data flow.
