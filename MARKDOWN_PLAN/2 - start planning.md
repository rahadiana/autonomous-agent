
 

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
