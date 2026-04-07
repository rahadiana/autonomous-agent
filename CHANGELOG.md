# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### 1. Executor DSL Validation
**File:** `core/executor.js`

```javascript
import { getPath, setPath, resolveValue } from './executor.js';

// Test Input:
const ctx = { memory: { a: { b: 1 } }, input: {} };
const val = getPath(ctx.memory, "a.b");

// Test Output:
1
```

```javascript
// Test Input:
const obj = {};
setPath(obj, "a.b.c", 42);

// Test Output:
{ a: { b: { c: 42 } } }
```

```javascript
// Test Input:
const ctx = { memory: { x: 10 }, input: {} };
resolveValue("$memory.x", ctx);

// Test Output:
10
```

---

#### 2. Planner with Cache + Cost Control
**File:** `core/planner.js`

```javascript
// Test Input:
const planner = new Planner({ maxCost: 1.0 });
const plan = { bestPath: ["step1", "step2", "step3"] };
const cost = planner.estimateCost(plan);

// Test Output:
0.3
```

```javascript
// Test Input:
const plan = { bestPath: Array(11).fill("step") }; // 11 steps
const cost = planner.estimateCost(plan);

// Test Output:
1.1 // exceeds maxCost: 1.0
```

---

#### 3. Bandit Skill Selection (UCB)
**File:** `core/bandit.js`

```javascript
// Test Input:
const skills = [
  { id: "s1", score: 0.8, usage_count: 10 },
  { id: "s2", score: 0.9, usage_count: 0 }
];
const selected = selectSkill(skills);

// Test Output:
{ id: "s2", score: 0.9, usage_count: 0 } // higher UCB due to low usage
```

---

#### 4. Global Scoring System
**File:** `core/scoring.js`

```javascript
// Test Input:
const score = globalScore({
  correctness: 1.0,
  schema_validity: 0.8,
  efficiency: 0.9,
  reuse: 0.7,
  latency: 0.5
});

// Test Output:
0.85 // 0.4 + 0.16 + 0.135 + 0.105 + 0.05
```

---

#### 5. Blackboard Versioning (CAS)
**File:** `core/blackboard.js`

```javascript
// Test Input:
const bb = new Blackboard();
bb.hardGuardSet("goal", { data: "test" }, 0, "agent1");
const result = bb.hardGuardSet("goal", { data: "test2" }, 0, "agent2");

// Test Output:
{ accepted: false, version: 1, reason: "outdated_update" }
```

---

#### 6. Mutation Control System
**File:** `core/mutation.js`

```javascript
// Test Input:
const skill = { usage_count: 10, score: 0.8, mutation_count: 0 };
const result = shouldMutate(skill);

// Test Output:
{ shouldMutate: true, reason: "ok" }
```

```javascript
// Test Input:
const skill = { usage_count: 2, score: 0.8 }; // below threshold
const result = shouldMutate(skill);

// Test Output:
{ shouldMutate: false, reason: "usage_below_threshold", details: { current: 2, required: 5 } }
```

```javascript
// Test Input:
const failures = [{ error: "timeout" }];
const mutated = mutateFromFailure(skill, failures);

// Test Output:
{ logic: [...], maxLoops: 500 } // reduced from 1000
```

---

#### 7. Skill Versioning with Lineage
**File:** `core/versioning.js`

```javascript
// Test Input:
const skill = { id: "v1", version: 1 };
const newVersion = createVersion(skill);

// Test Output:
{ id: "v2", version: 2, parent_id: "v1" }
```

---

#### 8. Validator Schema Check
**File:** `core/validator.js`

```javascript
// Test Input:
const schema = { type: "object", properties: { name: { type: "string" } } };
const data = { name: "test" };
const result = validate(data, schema);

// Test Output:
{ valid: true, errors: [] }
```

---

#### 9. MCP Tool Registry
**File:** `core/mcp.js`

```javascript
// Test Input:
registerTool("math_add", { description: "Add two numbers" });
const tool = getTool("math_add");

// Test Output:
{ name: "math_add", description: "Add two numbers" }
```

---

#### 10. Test Runner + Evaluator
**File:** `core/testRunner.js`

```javascript
// Test Input:
const skill = { logic: [{ op: "set", path: "result", value: 10 }] };
const testCases = [{ input: {}, expected: { result: 10 } }];
const result = evaluateSkill(skill, testCases);

// Test Output:
{ score: 1.0, passed: 1, failed: 0 }
```

---

### Test Summary

**All Tests Pass: 226/226**

```
# tests 226
# pass 226
# fail 0
# duration_ms: 1995.456568
```

| Test File | Tests | Status |
|-----------|-------|--------|
| bandit.test.js | 8 | ✅ Pass |
| callSkill.test.js | 12 | ✅ Pass |
| executorDSL.test.js | 20+ | ✅ Pass |
| executor.test.js | 20+ | ✅ Pass |
| mcp.test.js | 9 | ✅ Pass |
| scoring.test.js | 5 | ✅ Pass |
| mutation.test.js | 6 | ✅ Pass |
| testBuilder.test.js | 5 | ✅ Pass |
| testRunner.test.js | 5 | ✅ Pass |
| validation.test.js | 5 | ✅ Pass |
| Other tests | ~140 | ✅ Pass |

---

### Implementation Status

| Feature | Status | File |
|---------|--------|------|
| Executor DSL + Validation | ✅ Done | core/executor.js |
| Planner Cache + Cost | ✅ Done | core/planner.js |
| Bandit UCB Selection | ✅ Done | core/bandit.js |
| Global Scoring | ✅ Done | core/scoring.js |
| Blackboard Versioning | ✅ Done | core/blackboard.js |
| Mutation Control | ✅ Done | core/mutation.js |
| Skill Versioning | ✅ Done | core/versioning.js |
| Validator | ✅ Done | core/validator.js |
| MCP Registry | ✅ Done | core/mcp.js |
| Test Runner | ✅ Done | core/testRunner.js |

---

Generated: 2026-04-07
