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

## 7. Bandit Score (core/bandit.js)

### Test: banditScore
```javascript
// Input
const skill = { score: 0.8, usage_count: 1 };
const total = 10;

// Output
{ score: 0.8, explore: 0.47, total: 0.8 + 0.47 = 1.27 }
```

### Test: selectSkill
```javascript
// Input
const skills = [
  { id: "s1", score: 0.9, usage_count: 10 },
  { id: "s2", score: 0.7, usage_count: 1 }
];

// Output - selects s2 due to exploration bonus
{ selected: "s2" }
```

---

## 8. Call Skill (core/executor.js)

### Test: call_skill executes nested skill
```javascript
// Input
const skill = {
  logic: [{
    op: "call_skill",
    skill: "add_two",
    input: { a: "$input.a", b: "$input.b" }
  }]
};
const input = { a: 3, b: 4 };

// Output
{ result: 7 }
```

### Test: call_skill_map executes skill for each item
```javascript
// Input
const skill = {
  logic: [{
    op: "call_skill_map",
    collection: [1, 2, 3],
    skill: "double",
    input_key: "item"
  }]
};

// Output
{ results: [2, 4, 6] }
```

---

## 9. Executor DSL (core/executorDSL.test.js)

### Test: Basic add operation
```javascript
// Input
const skill = {
  logic: [
    { op: "set", path: "x", value: 5 },
    { op: "add", a: "$memory.x", b: 3, to: "result" }
  ]
};

// Output
{ x: 5, result: 8 }
```

### Test: Conditional execution (if)
```javascript
// Input
const skill = {
  logic: [
    { op: "set", path: "value", value: 10 },
    {
      op: "if",
      condition: { comparison: { left: "$memory.value", op: "gt", right: 5 } },
      branches: {
        then: [{ op: "set", path: "status", value: "high" }]
      }
    }
  ]
};

// Output
{ value: 10, status: "high" }
```

### Test: For loop
```javascript
// Input
const skill = {
  logic: [
    { op: "set", path: "items", value: [1, 2, 3] },
    {
      op: "for",
      collection: "$memory.items",
      var: "item",
      steps: [{ op: "set", path: "temp", value: "$memory.item" }]
    }
  ]
};

// Output
{ items: [1, 2, 3], temp: 3 }
```

---

## 10. Validator (core/validator.test.js)

### Test: Schema validation
```javascript
// Input
const schema = { required: ["name"], properties: { name: "string", age: "number" } };
const data = { name: "John", age: 30 };

// Output
{ valid: true, errors: [] }

// Input (missing required)
const data = { age: 30 };

// Output
{ valid: false, errors: ["Missing required field: name"] }

// Input (type mismatch)
const data = { name: "John", age: "30" };

// Output
{ valid: false, errors: ["Field age expected type number, got string"] }
```

---

## 11. Versioning (core/versioning.test.js)

### Test: createVersion
```javascript
// Input
const skill = { id: "skill_1", version: 1, logic: [] };

// Output
{
  id: "skill_1",
  version: 2,
  parent_id: "skill_1",
  created_at: 1712486400000
}
```

---

## 12. VectorStore (core/vectorStore.test.js)

### Test: VectorStore add and search
```javascript
// Input
const vs = new VectorStore(3);
vs.add("doc1", [1, 0, 0]);
vs.add("doc2", [0, 1, 0]);

// Search
vs.search([1, 0, 0], 1);

// Output
[{ id: "doc1", score: 1 }]
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
| Bandit Strategy | core/bandit.js | ✅ |
| Call Skill | core/executor.js | ✅ |
| Executor DSL | core/executor.js | ✅ |
| Validator | core/validator.js | ✅ |
| Versioning | core/versioning.js | ✅ |
| VectorStore | core/vectorStore.js | ✅ |

**Total: 226 tests PASSED**
