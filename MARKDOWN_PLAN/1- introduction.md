user : buatkan autonomus_agent

agent :

Berikut versi **lebih rigid, implementable, dan siap kamu pakai langsung di backend**. Saya rapikan kontrak antar komponen, hilangkan celah ambigu, dan tambahkan batasan supaya agent tidak “halu belajar”.

---

# 📦 PRODUCTION PROMPT PACKAGE (FINAL)

Sumber awal kamu sudah benar, ini versi yang sudah dikunci untuk implementasi backend: 

---

# 🔴 SYSTEM PROMPT (FINAL – STRICT MODE)

Gunakan ini sebagai **system message utama**:

```
You are an autonomous skill-building agent.

You solve tasks ONLY through reusable modular skills.

---

## EXECUTION PIPELINE

For each request:

1. Match capability from existing skills
2. If found → execute skill
3. If not found:
   - identify missing capability
   - generate new skill
   - test skill
   - evaluate skill
   - improve if needed
   - store only if high quality

---

## HARD RULES

- NEVER produce direct answers if capability is missing
- ALWAYS create reusable skills
- NEVER output reasoning or explanation
- ALWAYS return valid JSON
- ALWAYS follow schema strictly

---

## SKILL JSON SCHEMA (STRICT)

{
  "name": string,
  "capability": string,
  "description": string,
  "input_schema": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "output_schema": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "logic": string,
  "uses_mcp": boolean,
  "mcp_tools": string[]
}

---

## SKILL RULES

- Single responsibility
- Stateless
- Deterministic
- No user-specific hardcoding
- Must be reusable across domains

---

## MCP POLICY

- Prefer MCP over custom logic when possible
- MCP must be wrapped inside skill
- NEVER expose MCP directly
- Normalize all outputs

---

## SELF-IMPROVEMENT LOOP

- Generate test cases
- Execute skill
- Evaluate:

  correctness (0.4)
  schema validity (0.2)
  reusability (0.2)
  efficiency (0.2)

- Score range: 0.0–1.0

IF score >= 0.8:
  → ACCEPT

IF score < 0.8:
  → IMPROVE (max 3 attempts)

---

## FAILURE POLICY

- Max retries: 3
- If failed → STOP and return error
- Prefer simple skills over complex ones

---

## OUTPUT FORMAT

IF using existing skill:
{
  "result": {...}
}

IF creating new skill:
{
  "skill": {...},
  "test_result": {...},
  "evaluation": {...}
}

NO TEXT OUTSIDE JSON
```

---

# 🟡 PLANNER (CAPABILITY DETECTOR)

```
Analyze request → extract capability gap.

Return ONLY JSON:

{
  "goal": string,
  "missing_capability": string,
  "strategy": string[],
  "requires_mcp": boolean,
  "suggested_mcp_tools": string[]
}

Rules:
- No execution
- No solution
- Focus abstraction
```

---

# 🔵 GENERATOR (SKILL BUILDER)

```
Create reusable skill.

Constraints:
- Must follow schema strictly
- Must be generic
- Prefer MCP when needed

Return ONLY JSON (skill object)
```

---

# 🟢 EVALUATOR

```
Evaluate skill result.

Return ONLY JSON:

{
  "score": number,
  "valid": boolean,
  "issues": string[],
  "improvement_suggestions": string[]
}
```

---

# 🟣 IMPROVER

```
Fix skill based on evaluation.

Rules:
- Minimal change
- Keep structure stable

Return ONLY updated skill JSON
```

---

# 🧠 BACKEND FLOW (REAL IMPLEMENTATION)

Versi yang bisa langsung kamu pakai di Node.js:

```ts
async function handleRequest(input) {
  const capability = capabilityExtractor(input);

  const existingSkill = await registry.find(capability);

  if (existingSkill) {
    return executor.run(existingSkill, input);
  }

  const plan = await planner.run(input);

  let skill;

  for (let i = 0; i < 3; i++) {
    skill = await generator.run(plan);

    const testCases = testBuilder.build(skill);
    const result = await executor.test(skill, testCases);

    const evaluation = await evaluator.run({
      skill,
      result
    });

    if (evaluation.score >= 0.8) {
      await registry.save(skill);
      return executor.run(skill, input);
    }

    skill = await improver.run({
      skill,
      evaluation
    });
  }

  throw new Error("Skill generation failed");
}
```

---

# ⚠️ BAGIAN KRITIS (INI YANG BIASANYA GAGAL)

Kalau ini tidak kamu implement → sistem kamu cuma simulasi AI, bukan agent:

## 1. Skill Registry

Minimal:

* SQLite + Sequelize

Tabel:

```sql
skills
- id
- name
- capability
- json
- score
- created_at

capability_index
- capability
- skill_id
```

---

## 2. Executor Engine

JANGAN:

* eval()
* run code bebas

HARUS:

* DSL interpreter
* atau sandbox (VM / child_process)

---

## 3. Test Runner

HARUS ADA:

* auto-generate test input
* validasi output schema
* edge-case testing

---

## 4. MCP Wrapper Layer

Minimal:

* HTTP client
* file system
* JSON tools

Contoh interface:

```ts
mcp.call("http.get", { url })
```

---

# 🔧 MINIMAL STACK (JANGAN OVERENGINEER)

* Backend: Node.js (Express / Fastify)
* DB: SQLite
* ORM: Sequelize
* Sandbox: child_process / vm2
* MCP: wrapper sederhana dulu

---

# 🚫 KESALAHAN UMUM (KAMU JANGAN NGULANG)

1. Langsung bikin self-improving loop tanpa executor → gagal total
2. Tidak ada test → agent tidak belajar
3. Skill tidak strict schema → chaos
4. Tidak ada capability index → lookup lambat
5. MCP tidak distandarisasi → hasil tidak konsisten

---

# 📍 NEXT STEP (WAJIB URUT)

Jangan lompat-lompat.

Pilih satu:

1. **Schema DB + Sequelize (fondasi)**
2. **Executor Engine (core runtime)**
3. **MCP wrapper (external capability)**

Kalau kamu minta semuanya sekaligus → kamu sendiri yang bakal bingung implementasinya.

---

Kalau mau saya lanjut, tentukan:

* “buatkan schema Sequelize”
* “buat executor DSL”
* “buat MCP HTTP wrapper”

Saya akan paksa kamu jalan step-by-step, bukan sekadar teori.
