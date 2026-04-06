
introduction :
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


==============================================


user : buatkan ini


agent : 

Saya tidak akan “cuma ulangin” isi file itu. Yang kamu butuh adalah **versi yang benar-benar siap dipakai langsung**, bukan sekadar dokumen.

Di bawah ini saya ubah jadi **paket implementasi konkret + siap copy-paste ke backend**. Saya juga perbaiki beberapa celah fatal yang masih ada di versi kamu.

---

# ✅ 1. SYSTEM PROMPT (READY TO USE)

Langsung pakai ini sebagai `system` message:

```txt
You are an autonomous skill-building agent.

You solve tasks ONLY through reusable modular skills.

---

## EXECUTION PIPELINE

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

## SKILL JSON SCHEMA

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

## RULES

- Stateless
- Deterministic
- Reusable
- No hardcoded values

---

## SELF-IMPROVEMENT LOOP

- Generate test cases
- Execute
- Evaluate:

  correctness: 0.4  
  schema: 0.2  
  reuse: 0.2  
  efficiency: 0.2  

Score >= 0.8 → ACCEPT  
Else → IMPROVE (max 3x)

---

## OUTPUT

Existing skill:
{
  "result": {}
}

New skill:
{
  "skill": {},
  "test_result": {},
  "evaluation": {}
}

NO TEXT OUTSIDE JSON
```

---

# ✅ 2. CRITICAL FIX (INI YANG KAMU LEWAT)

Versi kamu masih “AI-looking”, belum “system-ready”.

Masalah utama:

* ❌ Tidak ada **capability matching yang deterministic**
* ❌ Tidak ada **executor aman**
* ❌ Tidak ada **schema validator runtime**

Saya tambahkan bagian wajib.

---

# ✅ 3. CAPABILITY MATCHER (WAJIB ADA)

Jangan pakai fuzzy doang.

```ts
function normalizeCapability(text: string) {
  return text.toLowerCase().trim();
}

async function findSkill(capability: string) {
  return Skill.findOne({
    where: { capability: normalizeCapability(capability) }
  });
}
```

Kalau ini tidak strict → agent kamu bakal “halu bikin skill terus”.

---

# ✅ 4. EXECUTOR (JANGAN NGACO)

INI PALING KRITIS.

Jangan:

```js
eval(skill.logic)
```

Gunakan sandbox:

```ts
import vm from "vm";

export function runSkill(skill, input) {
  const context = {
    input,
    output: {},
  };

  vm.createContext(context);

  const script = new vm.Script(skill.logic);
  script.runInContext(context);

  return context.output;
}
```

---

# ✅ 5. VALIDATOR (WAJIB, ATAU CHAOS)

Pakai `ajv`:

```ts
import Ajv from "ajv";

const ajv = new Ajv();

export function validate(schema, data) {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  return {
    valid,
    errors: validate.errors || []
  };
}
```

---

# ✅ 6. TEST BUILDER (AUTO)

Minimal:

```ts
function buildTestCases(skill) {
  return [
    { input: {} }, // default case
  ];
}
```

Nanti kamu upgrade:

* edge case
* invalid input
* empty input

---

# ✅ 7. EVALUATOR (REAL SCORE)

```ts
function evaluate(result, validation) {
  let score = 0;

  if (validation.valid) score += 0.2;

  // simple correctness proxy
  if (result !== undefined) score += 0.4;

  // reuse proxy
  score += 0.2;

  // efficiency proxy
  score += 0.2;

  return score;
}
```

---

# ✅ 8. DATABASE (SEQUELIZE)

Langsung pakai ini:

```ts
const Skill = sequelize.define("Skill", {
  name: DataTypes.STRING,
  capability: DataTypes.STRING,
  json: DataTypes.JSON,
  score: DataTypes.FLOAT,
});
```

---

# ✅ 9. FINAL BACKEND FLOW (FIXED VERSION)

Ini versi kamu yang sudah diperbaiki:

```ts
async function handleRequest(input) {
  const capability = extractCapability(input);

  const existing = await findSkill(capability);

  if (existing) {
    return runSkill(existing.json, input);
  }

  const plan = await planner(input);

  let skill;

  for (let i = 0; i < 3; i++) {
    skill = await generator(plan);

    const tests = buildTestCases(skill);

    let passed = true;
    let lastResult;

    for (const t of tests) {
      const result = runSkill(skill, t.input);

      const validation = validate(skill.output_schema, result);

      if (!validation.valid) {
        passed = false;
        break;
      }

      lastResult = result;
    }

    const score = evaluate(lastResult, { valid: passed });

    if (score >= 0.8) {
      await Skill.create({
        name: skill.name,
        capability: skill.capability,
        json: skill,
        score
      });

      return runSkill(skill, input);
    }

    skill = await improver(skill);
  }

  throw new Error("Skill generation failed");
}
```

---

# ⚠️ REALITY CHECK (BIAR KAMU GA NGACO)

Kalau kamu pikir ini langsung jadi “AI belajar sendiri”, salah.

Tanpa ini:

* ❌ evaluator bagus → skill jelek tetap masuk
* ❌ test builder → agent tidak belajar
* ❌ capability normalization → duplikasi skill

---

# 🎯 NEXT STEP (PILIH SATU, JANGAN SERAKAH)

Pilih:

1. **“buat executor DSL biar lebih aman dari vm”**
2. **“buat MCP wrapper HTTP + file system”**
3. **“buat auto test generator yang beneran pintar”**
4. **“buat capability extractor berbasis embedding”**

Kalau kamu minta semua sekaligus → implementasi kamu bakal berantakan.

---

Kalau serius mau ini jadi sistem beneran (bukan demo), langkah berikutnya paling krusial adalah:

👉 executor + validator + test system

Tanpa itu, ini cuma prompt keren doang.
