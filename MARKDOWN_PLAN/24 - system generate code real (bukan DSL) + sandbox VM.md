Kita masuk ke tahap paling berisiko: **agent menghasilkan kode nyata (bukan DSL) + mengeksekusinya di sandbox VM**. Fokusnya: **aman, terukur, bisa rollback**. Jangan pernah menjalankan kode LLM langsung tanpa isolasi.

---

# 🧠 1. ARSITEKTUR

```txt
Modifier / Planner
      ↓
Code Generator (LLM)
      ↓
Validator (static checks)
      ↓
Sandbox VM (isolated runtime)
      ↓
Tester (test cases)
      ↓
Evaluator
      ↓
Version Manager (accept / rollback)
```

---

# 🔧 2. FORMAT OUTPUT KODE (KONTRAK KETAT)

LLM harus mengeluarkan **modul fungsi tunggal**:

```json
{
  "name": "sum_numbers",
  "language": "javascript",
  "entry": "handler",
  "code": "export async function handler(input) { return { result: input.a + input.b }; }",
  "input_schema": { "type": "object", "properties": { "a": {"type":"number"}, "b": {"type":"number"} }, "required": ["a","b"] },
  "output_schema": { "type": "object", "properties": { "result": {"type":"number"} }, "required": ["result"] }
}
```

Aturan:

* satu entrypoint: `handler`
* tidak ada akses global
* tidak ada require/import kecuali whitelist
* pure function (sebisa mungkin)

---

# 🔧 3. CODE GENERATOR (LLM)

Prompt (ringkas, strict):

```txt
Generate a single JavaScript module with an async function `handler(input)`.

Rules:
- No external network
- No filesystem
- No process access
- Deterministic
- Return JSON matching schema

Return JSON only with fields: name, language, entry, code, input_schema, output_schema.
```

---

# 🔒 4. STATIC VALIDATION (WAJIB)

Cek cepat sebelum run:

```ts
function validateCodeModule(mod) {
  if (mod.language !== "javascript") return false;
  if (!mod.code.includes("handler")) return false;

  // forbid dangerous tokens
  const banned = ["require(", "process.", "fs.", "child_process", "eval(", "Function("];
  for (const b of banned) {
    if (mod.code.includes(b)) return false;
  }

  return true;
}
```

---

# 🧪 5. SANDBOX VM (NODE VM)

Gunakan `vm` dengan isolasi ketat + timeout.

```ts
import vm from "vm";

export async function runInSandbox(mod, input, timeoutMs = 100) {
  const sandbox = {
    module: {},
    exports: {},
    input,
    console: { log: () => {} } // silent
  };

  vm.createContext(sandbox);

  const wrapped = `
    "use strict";
    ${mod.code}
    if (typeof handler !== "function" && (!exports || !exports.handler)) {
      throw new Error("No handler exported");
    }
    const __h = (typeof handler === "function") ? handler : exports.handler;
    module.exports = __h;
  `;

  const script = new vm.Script(wrapped, { timeout: timeoutMs });

  script.runInContext(sandbox, { timeout: timeoutMs });

  const handler = sandbox.module.exports;

  if (typeof handler !== "function") {
    throw new Error("Invalid handler");
  }

  const res = await Promise.race([
    handler(sandbox.input),
    new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), timeoutMs))
  ]);

  return res;
}
```

> Catatan: untuk produksi, pertimbangkan isolasi lebih kuat (proses terpisah / container).

---

# 🔧 6. TEST RUNNER

```ts
async function testModule(mod, testCases) {
  let passed = 0;

  for (const t of testCases) {
    try {
      const out = await runInSandbox(mod, t.input);
      const valid = validate(t.output_schema, out).valid;
      if (valid) passed++;
    } catch {
      // fail
    }
  }

  return passed / testCases.length;
}
```

---

# 📊 7. EVALUATOR

```ts
function scoreModule(passRate, latencyMs) {
  let score = 0;
  score += passRate * 0.7;
  score += latencyMs < 50 ? 0.2 : 0.1;
  score += 0.1; // simplicity prior
  return score;
}
```

---

# 🔁 8. INTEGRASI KE SELF-MODIFYING

```ts
async function proposeAndTest(context) {
  const mod = await codeGeneratorLLM(context);

  if (!validateCodeModule(mod)) return null;

  const passRate = await testModule(mod, buildTests(mod));
  const score = scoreModule(passRate, 0);

  return { mod, score };
}
```

---

# ✅ 9. ACCEPTANCE + VERSIONING

```ts
async function acceptIfBetter(currentScore, candidate) {
  if (candidate.score > currentScore + 0.05) {
    await saveVersion(/* snapshot */);
    await registerModule(candidate.mod); // store in DB
    return true;
  }
  return false;
}
```

---

# 🗃️ 10. REGISTRY (KODE NYATA)

```ts
const CodeModule = sequelize.define("CodeModule", {
  name: DataTypes.STRING,
  code: DataTypes.TEXT,
  entry: DataTypes.STRING,
  input_schema: DataTypes.JSON,
  output_schema: DataTypes.JSON,
  score: DataTypes.FLOAT,
  version: DataTypes.INTEGER
});
```

---

# 🔄 11. EXECUTION PATH

Saat eksekusi:

1. cari **module terbaik (vector + score)**
2. jalankan di sandbox
3. fallback ke DSL jika gagal

```ts
async function executeWithCodeFirst(input, capability) {
  const mod = await findBestModule(capability);

  if (mod) {
    try {
      return await runInSandbox(mod, input);
    } catch {
      // fallback
    }
  }

  return runDSL(await getSkill(capability), input);
}
```

---

# 🔒 12. SAFETY HARDENING (WAJIB)

* **timeout ketat** (50–200ms)
* **no I/O** (network/fs)
* **no process/env**
* **memory limit** (via process/container jika perlu)
* **deny dynamic eval/Function**
* **size limit code** (mis. < 10KB)

---

# ⚠️ 13. RISIKO & MITIGASI

**Risiko**

* infinite loop → **timeout**
* exfiltration → **no network/fs**
* CPU spike → **time + step limits**
* regression → **A/B test + rollback**

**Mitigasi**

* sandbox proses terpisah (child_process) untuk produksi
* rate limit eksekusi
* audit log setiap run

---

# 🚀 14. HASIL

Sekarang agent kamu bisa:

* menghasilkan **kode nyata**
* menguji di **sandbox**
* **mempromosikan** versi terbaik
* **fallback** ke DSL jika perlu

Ini mengubah sistem dari:

> rule-based DSL
> menjadi
> **hybrid: DSL + generated code (evolving)**

---

# 🎯 NEXT STEP (opsional, tingkat lanjut)

* sandbox proses terpisah (worker pool)
* WASM sandbox (lebih ketat)
* differential testing (bandingkan DSL vs code)
* auto-refactor (LLM memperbaiki modul lama)

Kalau mau lanjut, pilih:

* “upgrade ke sandbox proses terpisah (worker pool)”
* atau “tambah differential testing + auto-refactor”
