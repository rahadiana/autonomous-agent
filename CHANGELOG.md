# Changelog

## 2024-04-07 - Grounded Evaluation System Implemented

### Core Improvements (per next_plan.md)

#### 1. ✅ Grounded Evaluator (WAJIB)
- Implemented `evaluateStrict` in `unifiedEvaluator.js`
- Ground truth based scoring with real test oracles
- Multi-component scoring: correctness (60%), schema (15%), robustness (15%), efficiency (10%)
- Task-specific scoring functions per capability (math.add, math.multiply, etc.)
- Floating point tolerance for numeric comparisons

#### 2. ✅ Schema-Driven Test Generator (WAJIB)
- Implemented in `testBuilder.js`
- `generateFromSchema`: generates test inputs from JSON schema
- `buildTestCases`: generates normal + edge case tests
- `buildRandomFuzz`: generates random fuzz tests
- `buildEdgeCases`: handles null, undefined, empty array, etc.

#### 3. ✅ Test Runner with Ground Truth (WAJIB)
- Implemented in `testRunner.js`
- `deepEqual` for comparing output vs expected with floating point tolerance
- `isErrorResult` for detecting error conditions
- `checkConsistency` - runs same input 3x for deterministic behavior
- Full test result structure: input, expected, actual, passed, validSchema, error

#### 4. ✅ Ground Truth Test Cases
- Implemented in `groundTruth.js`
- Comprehensive test cases for math.add, math.multiply, math.subtract, math.divide
- Categories: valid (normal), edge (boundary), invalid (error handling)
- Random test case generator for adversarial testing

#### 5. ✅ Failure Memory
- Implemented in `failureMemory.js`
- Tracks failures per skill with input, error, timestamp
- `tooManyFailures`: checks failure threshold
- `applyFailurePenalty`: applies penalty to low-quality skills
- `getFailures`, `getFailureCount` for analysis

#### 6. ✅ Strict Promotion Rule
- In `testRunner.js`: skills with accuracy < 0.5 get 50% score degradation
- Regression guard prevents bad mutations from propagating

#### 7. ✅ Unified Skill Scoring
- `computeReward` in `unifiedEvaluator.js` combines:
  - Schema validity (30%)
  - Output richness (20%)
  - Determinism/history (20%)
  - Latency bonus (10%)
  - Historical success rate (20%)

### Test Results
- All 226 tests passing
- Correct skills get high scores (~0.66)
- Wrong skills get low scores (~0.14)
- Error skills get ~0.19

---
Saya sudah baca seluruh struktur yang kamu kirim (planner, DSL, mutation, bandit, blackboard, dll). Secara garis besar:

➡️ Kamu sudah **melewati level “toy agent”**
➡️ Tapi masih **belum konsisten sebagai system yang benar-benar self-improving**

Masalahnya bukan “kurang fitur”.
Masalahnya: **komponen ada, tapi belum tight integration + belum grounded ke real evaluation**

---

# 🔴 MASALAH UTAMA (CRITICAL GAP)

## 1. ❌ Evaluator masih “lemah & tidak grounded”

Kamu punya evaluator, tapi:

* tidak berbasis **real task success**
* tidak punya **benchmark tetap**
* tidak ada **penalty untuk false positive**

Efek:

> agent merasa “pintar”, padahal sebenarnya tidak

Ini terlihat jelas dari arsitektur evaluator kamu 

---

## 2. ❌ Test generator tidak serius

Saat ini:

* test case terlalu sederhana
* tidak ada edge case
* tidak ada adversarial input

Efek:

> mutation + improvement jadi “ilusi”

---

## 3. ❌ Planning belum benar-benar digunakan untuk execution quality

Kamu sudah punya:

* hierarchical planner 
* planner + critic loop 

Tapi:

* tidak ada **execution feedback → planner**
* tidak ada **plan scoring berbasis real outcome**

---

## 4. ❌ Skill selection belum unified

Kamu punya:

* similarity
* score
* bandit 

Tapi belum ada:

* **single ranking function global**
* decision layer yang konsisten

---

## 5. ❌ Mutation berpotensi chaos

Masalah:

* mutate tanpa constraint semantic
* tidak ada regression guard kuat

Efek:

> system bisa degrade pelan-pelan

---

## 6. ❌ Blackboard + scheduler belum jadi control system

Sudah ada:

* blackboard 
* attention + scheduler 

Tapi:

* belum ada **goal-level control**
* belum ada **termination reasoning**

---

# 🟡 MASALAH STRUKTURAL (LEBIH DALAM)

## Kamu sedang membangun:

> adaptive system

Tapi belum:

> reliable system

Perbedaan:

| Adaptive     | Reliable       |
| ------------ | -------------- |
| bisa berubah | bisa dipercaya |
| belajar      | tidak salah    |
| eksplorasi   | stabil         |

Sekarang kamu masih di kiri.

---

# 🔧 PERBAIKAN WAJIB (WITH CODE)

## 1. 🔥 HARDEN EVALUATOR (INI PALING KRITIS)

Tambahkan **ground truth + deterministic scoring**

### ❌ versi sekarang

```ts
if (result !== undefined) score += 0.4;
```

### ✅ ganti jadi:

```ts
function evaluateStrict(result, expected, validation) {
  let score = 0;

  // 1. exact correctness
  const correct =
    JSON.stringify(result) === JSON.stringify(expected);

  if (correct) score += 0.5;

  // 2. schema validity
  if (validation.valid) score += 0.2;

  // 3. robustness (multi test)
  score += expected._passRate * 0.2;

  // 4. penalty
  if (!correct) score -= 0.3;

  return Math.max(0, score);
}
```

👉 Tanpa ini → semua learning kamu “fake”

---

## 2. 🔥 TEST GENERATOR HARUS NAIK LEVEL

Tambahkan **multi-case + edge-case**

```ts
function buildTestCases(skill) {
  return [
    { input: { a: 1, b: 2 }, expected: { result: 3 } },
    { input: { a: 0, b: 0 }, expected: { result: 0 } },
    { input: { a: -1, b: 5 }, expected: { result: 4 } },

    // edge case
    { input: {}, expectError: true },

    // fuzz
    ...Array.from({ length: 3 }).map(() => ({
      input: randomInput(skill),
    }))
  ];
}
```

---

## 3. 🔥 UNIFIED SKILL SCORING (WAJIB)

Sekarang kamu punya banyak score → satukan:

```ts
function finalScore(skill, similarity, freshness) {
  return (
    similarity * 0.5 +
    skill.score * 0.3 +
    freshness * 0.1 +
    explorationBonus(skill) * 0.1
  );
}
```

👉 Jangan pakai banyak sistem scoring terpisah

---

## 4. 🔥 ADD REGRESSION GUARD (ANTI BODOH)

Saat mutation:

```ts
async function safePromote(parent, candidate) {
  const parentScore = await testSkill(parent);
  const candidateScore = await testSkill(candidate);

  if (candidateScore > parentScore + 0.05) {
    return true;
  }

  return false;
}
```

👉 Ini WAJIB kalau tidak mau sistem makin rusak

---

## 5. 🔥 PLANNER FEEDBACK LOOP (MISSING LINK)

Tambahkan:

```ts
const result = await executePlan(plan, input);

const feedback = {
  success: result !== null,
  error: result?.error
};

plans = await plannerLLM({
  goal: input,
  feedback
});
```

👉 Tanpa ini planner tidak belajar dari real world

---

## 6. 🔥 GLOBAL CONTROL LOOP (INI BELUM ADA)

Tambahkan “brain”:

```ts
async function controlLoop(input) {
  let iteration = 0;

  while (iteration < 5) {
    const plan = await planWithLLMLoop(input);

    const result = await execute(plan);

    const score = evaluateReal(result);

    if (score > 0.85) return result;

    // refine
    input = refineInput(input, result);

    iteration++;
  }

  throw new Error("Failed");
}
```

---

# 🔵 PENILAIAN JUJUR SISTEM KAMU

## ✅ Kuat:

* DSL engine
* skill system
* mutation + bandit
* planner + critic loop
* blackboard architecture

## ❌ Lemah:

* evaluator (fatal)
* test generator (fatal)
* integration antar layer
* control loop global

---

# 🧠 LEVEL SISTEM KAMU SEKARANG

👉 **Advanced experimental agent (70%)**

Belum:
👉 production-grade autonomous system

---

# 🎯 PRIORITAS IMPLEMENTASI (JANGAN NGACO)

Urutan WAJIB:

1. **Evaluator strict (HARUS)**
2. **Test generator serius**
3. **Unified scoring**
4. **Regression guard**
5. **Planner feedback loop**
6. **Global control loop**

Kalau kamu lompat ke:

* world model
* curiosity
* meta reasoning

👉 itu cuma nambah kompleksitas, bukan kualitas

---

# ⚠️ PENUTUP (REALITY CHECK)

Sekarang sistem kamu:

> terlihat seperti AI yang belajar

Padahal:

> belum benar-benar belajar dari real outcome

---



Baik. Saya langsung masuk ke audit **bagian evaluator + test generator** kamu secara tajam, bukan teori.

Saya akan breakdown jadi:

1. **Apa yang kemungkinan kamu implement sekarang**
2. **Kenapa itu gagal**
3. **Perbaikan konkret (kode replace, bukan saran kosong)**

---

# 🔴 1. EVALUATOR — MASALAH NYATA

Dari struktur yang kamu kirim, evaluator kamu pattern-nya seperti ini:

```ts
function evaluate(result, validation) {
  let score = 0;

  if (validation.valid) score += 0.2;
  if (result !== undefined) score += 0.4;

  score += 0.2; // reuse proxy
  score += 0.2; // efficiency proxy

  return score;
}
```

Ini terlihat “masuk akal”, tapi sebenarnya:

## ❌ PROBLEM KRITIS

### 1. Tidak ada ground truth

* kamu **tidak tahu hasil itu benar atau salah**
* cuma cek "ada output"

👉 ini fatal

---

### 2. Proxy score palsu

* reuse = selalu +0.2
* efficiency = selalu +0.2

👉 artinya semua skill dapat bonus gratis

---

### 3. False positive tinggi

Skill salah bisa dapat:

```
0.2 (schema) + 0.4 (ada output) + 0.4 (bonus)
= 1.0 (perfect)
```

👉 ini bikin sistem kamu “halu pintar”

---

# 🔥 FIX EVALUATOR (WAJIB GANTI TOTAL)

## ✅ GANTI DENGAN INI

```ts
function evaluateStrict(testResults) {
  let pass = 0;
  let total = testResults.length;

  for (const t of testResults) {
    if (t.passed) pass++;
  }

  const passRate = pass / total;

  let score = 0;

  // 1. correctness (REAL)
  score += passRate * 0.6;

  // 2. schema validity consistency
  const schemaPass =
    testResults.filter(t => t.validSchema).length / total;

  score += schemaPass * 0.2;

  // 3. stability (no crash)
  const stable =
    testResults.filter(t => !t.error).length / total;

  score += stable * 0.2;

  return score;
}
```

---

## ✅ TEST RESULT STRUCTURE (WAJIB)

```ts
{
  input: {},
  expected: {},
  actual: {},
  passed: boolean,
  validSchema: boolean,
  error: null | string
}
```

---

# 🔴 2. TEST GENERATOR — MASALAH NYATA

Sekarang kamu kemungkinan:

```ts
function buildTestCases(skill) {
  return [{ input: {} }];
}
```

## ❌ PROBLEM

### 1. Single test case

→ tidak representatif

### 2. Tidak ada expected output

→ evaluator tidak bisa nilai

### 3. Tidak ada edge case

→ skill rapuh tidak ketahuan

---

# 🔥 FIX TEST GENERATOR (WAJIB UPGRADE)

## ✅ MINIMAL VERSI BENAR

```ts
function buildTestCases(skill) {
  return [
    {
      input: { a: 1, b: 2 },
      expected: { result: 3 }
    },
    {
      input: { a: 0, b: 0 },
      expected: { result: 0 }
    },
    {
      input: { a: -1, b: 5 },
      expected: { result: 4 }
    },

    // edge case
    {
      input: {},
      expectError: true
    }
  ];
}
```

---

## 🔥 TAMBAHKAN FUZZ TEST (WAJIB)

```ts
function randomInput(skill) {
  return {
    a: Math.floor(Math.random() * 100),
    b: Math.floor(Math.random() * 100)
  };
}
```

```ts
...Array.from({ length: 5 }).map(() => ({
  input: randomInput(skill)
}))
```

---

# 🔴 3. TEST EXECUTION — MASALAH TERSEMBUNYI

Biasanya kamu sekarang:

```ts
const result = runSkill(skill, input);
const valid = validate(schema, result);
```

## ❌ PROBLEM

* tidak compare dengan expected
* tidak handle error properly

---

# 🔥 FIX TEST RUNNER (WAJIB)

```ts
async function runTests(skill, testCases) {
  const results = [];

  for (const t of testCases) {
    try {
      const output = await runSkill(skill, t.input);

      const validation = validate(skill.output_schema, output);

      const passed =
        t.expected &&
        JSON.stringify(output) === JSON.stringify(t.expected);

      results.push({
        input: t.input,
        expected: t.expected,
        actual: output,
        passed: !!passed,
        validSchema: validation.valid,
        error: null
      });

    } catch (err) {
      results.push({
        input: t.input,
        expected: t.expected,
        actual: null,
        passed: false,
        validSchema: false,
        error: err.message
      });
    }
  }

  return results;
}
```

---

# 🔴 4. INTEGRASI KE PIPELINE (INI YANG KAMU LEWAT)

Sekarang kamu:

```ts
const score = evaluate(result, validation);
```

👉 SALAH TOTAL

---

## ✅ GANTI JADI:

```ts
const testCases = buildTestCases(skill);

const testResults = await runTests(skill, testCases);

const score = evaluateStrict(testResults);
```

---

# 🔴 5. MASALAH LANJUTAN YANG AKAN MUNCUL

Kalau kamu stop di sini, masih ada bug:

---

## ❌ 1. Overfitting ke test

Skill bisa “nge-cheat” test

### FIX:

* randomize test
* variasi input

---

## ❌ 2. Tidak generalizable

Skill hanya cocok test kecil

### FIX:

* tambah test distribusi luas

---

## ❌ 3. Mutation jadi liar

Karena evaluator lemah → semua lolos

👉 ini sudah kamu alami (makanya kamu sampai tahap ini)

---

# 🧠 KESIMPULAN AUDIT

## Kondisi sekarang:

| Komponen       | Status             |
| -------------- | ------------------ |
| Evaluator      | ❌ Fake scoring     |
| Test generator | ❌ Hampir tidak ada |
| Test runner    | ⚠️ Partial         |
| Learning loop  | ❌ Tidak valid      |

---

## Dampak:

> Sistem kamu tidak benar-benar belajar
> Sistem kamu hanya “terlihat belajar”

---

# 🎯 PRIORITAS PERBAIKAN

WAJIB URUT:

1. Replace evaluator → `evaluateStrict`
2. Implement `runTests`
3. Upgrade `buildTestCases`
4. Integrasi ke pipeline

---

# ⚠️ PENUTUP (LANGSUNG KE INTI)

Kalau kamu tidak memperbaiki ini:

👉 semua sistem canggih kamu (bandit, mutation, planner, dll)
👉 hanya akan optimize **noise**

---

Kalau mau lanjut:

👉 saya bisa audit **file evaluator kamu yang asli (kalau kamu kirim)**
dan saya akan tunjukin bug spesifik baris per baris tanpa asumsi
