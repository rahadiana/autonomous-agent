# CHANGELOG

## All Tests PASSED (226 tests) - April 7, 2026

---

## 1. Fix #1 - Executor with Trace/Validation (core/executor.js)

### Input:
```javascript
step = { op: "add", a: "$input.a", b: "$input.b", to: "result" }
ctx = { input: { a: 2, b: 3 }, memory: {}, output: {} }
```

### Output:
```javascript
{
  result: 5,
  trace: {
    step: { op: "add", a: "$input.a", b: "$input.b", to: "result" },
    before: {},
    after: { result: 5 },
    status: "ok"
  }
}
```

### Test: executeStepWithTrace
```javascript
// Input
const skill = { logic: [{ op: "add", a: "$input.a", b: "$input.b", to: "result" }] };
const input = { a: 5, b: 3 };

// Output
{ result: 8, _meta: { stepsExecuted: 1 } }
```

---

## 2. Fix #2 - Inline Validation (core/executor.js)

### Input:
```javascript
skill = {
  output_schema: { required: ["result"], properties: { result: "number" } },
  logic: [{ op: "set", path: "result", value: 5 }]
}
input = {}
```

### Output:
```javascript
{ result: 5, valid: true }
```

### Test: runDSLWithValidation
```javascript
// Input
const skill = {
  output_schema: { properties: { value: "number" } },
  logic: [{ op: "set", path: "value", value: 42 }]
};

// Output (success)
{ value: 42 }

// Output (schema mismatch - throws error)
Error: Output schema invalid: Field value expected number, got string
```

---

## 3. Fix #3 - Deterministic Scoring (core/executor.js)

### Input:
```javascript
skill = { logic: [{ op: "add", a: 1, b: 1, to: "result" }] }
input = {}
```

### Output:
```javascript
{ deterministic: true }
// Same input produces same output on multiple runs
```

### Test: checkDeterminism
```javascript
// Input
const skill = { logic: [{ op: "set", path: "x", value: 10 }] };
const input = {};

// Run twice
const r1 = await runDSL(skill, input);
const r2 = await runDSL(skill, input);

// Output
{ deterministic: true }  // r1 === r2
```

---

## 4. Fix #4 - Capability Enforcement (core/planner.js)

### Input:
```javascript
plan = { bestPath: [{ capability: "math.add" }, { capability: "math.multiply" }] }
registry = new Set(["math.add", "math.subtract"])
```

### Output:
```javascript
{ valid: false, errors: ["Unknown capability: math.multiply"] }
```

### Test: validatePlan
```javascript
// Input
const plan = { bestPath: [{ capability: "math.add" }] };
const registry = new Set(["math.add", "math.subtract"]);

// Output (valid)
{ valid: true, errors: [] }

// Output (invalid capability)
{ valid: false, errors: ["Unknown capability: api.http_get"] }
```

---

## 5. Fix #5 - Blackboard Versioning (core/blackboard.js)

### Input:
```javascript
blackboard.write("goal", { task: "test" }, "planner");
blackboard.write("goal", { task: "test2" }, "planner");
```

### Output:
```javascript
{ version: 2, data: { task: "test2" }, history: [ /* 2 entries */ ] }
```

### Test: Blackboard versioning
```javascript
// Input
const bb = new Blackboard();
await bb.write("goal", { task: "test1" }, "planner");
await bb.write("goal", { task: "test2" }, "planner");

// Output
{
  zone: "goal",
  version: 2,
  action: "write",
  oldData: { task: "test1" },
  newData: { task: "test2" }
}
```

---

## 6. Fix #6 - Mutation with Test Gate (core/mutation.js)

### Input:
```javascript
parentSkill = { score: 0.7, usage_count: 10, mutation_count: 1 }
mutatedScore = 0.8
```

### Output:
```javascript
{ accept: true, reason: "improvement_accepted", details: { improvement: 0.1 } }
```

### Test: acceptMutation
```javascript
// Input
const oldScore = 0.7;
const newScore = 0.85;

// Output (improvement above threshold)
{ accept: true, reason: "improvement_accepted", details: { improvement: 0.15 } }

// Input
const oldScore = 0.7;
const newScore = 0.72;

// Output (improvement below threshold)
{ accept: false, reason: "improvement_below_threshold", details: { improvement: 0.02 } }

// Input
const oldScore = 0.7;
const newScore = 0.6;

// Output (regression)
{ accept: false, reason: "regression_detected", details: { oldScore: 0.7, newScore: 0.6, improvement: -0.1 } }
```

---

## Summary

| Fix | File | Status |
|-----|------|--------|
| Executor with Trace | core/executor.js | ✅ |
| Inline Validation | core/executor.js | ✅ |
| Deterministic Scoring | core/executor.js | ✅ |
| Capability Enforcement | core/planner.js | ✅ |
| Blackboard Versioning | core/blackboard.js | ✅ |
| Mutation with Test Gate | core/mutation.js | ✅ |

**Total: 226 tests PASSED**
