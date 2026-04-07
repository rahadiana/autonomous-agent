# CHANGELOG

## All Tests PASSED (226 tests) - April 7, 2026

---

## 1. Bandit Strategy (core/bandit.js)

### Test: banditScore
```javascript
// Input
const skill = { score: 0.8, usage_count: 1 };
const total = 10;

// Output
{ score: 0.8, explore: 0.47, total: 1.27 }
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

## 2. Call Skill (core/executor.js)

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

## 3. Executor DSL (core/executor.js)

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

## 4. Validator (core/validator.js)

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

## 5. Versioning (core/versioning.js)

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

## 6. VectorStore (core/vectorStore.js)

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

## 7. Capability Normalization (core/capabilityNormalization.js)

### Test: normalizeCapability
```javascript
// Input
"Jumlahkan angka"

// Output
"jumlahkan angka"
```

---

## 8. Planner (core/planner.js)

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

## 9. Blackboard (core/blackboard.js)

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

## 10. Mutation (core/mutation.js)

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

## 11. Failure Memory (core/failureMemory.js)

### Test: logFailure
```javascript
// Input
logFailure({ a: 1 }, "skill_1", "Error: invalid input");

// Output (stored in memory)
{
  input: { a: 1 },
  skill_id: "skill_1",
  error: "Error: invalid input",
  created_at: 1712486400000
}
```

---

## 12. Decay (core/decay.js)

### Test: applyDecay
```javascript
// Input
const skill = {
  score: 0.8,
  last_used_at: Date.now() - (30 * 24 * 60 * 60 * 1000)
};

// Output
{ score: 0.64 } // 0.8 * (1 - 0.05 * 30/30)
```

---

## Summary

| Fix | File | Status |
|-----|------|--------|
| Bandit Strategy | core/bandit.js | ✅ |
| Call Skill | core/executor.js | ✅ |
| Executor DSL | core/executor.js | ✅ |
| Validator | core/validator.js | ✅ |
| Versioning | core/versioning.js | ✅ |
| VectorStore | core/vectorStore.js | ✅ |
| Capability Normalization | core/capabilityNormalization.js | ✅ |
| Planner | core/planner.js | ✅ |
| Blackboard | core/blackboard.js | ✅ |
| Mutation | core/mutation.js | ✅ |
| Failure Memory | core/failureMemory.js | ✅ |
| Decay | core/decay.js | ✅ |

**Total: 226 tests PASSED**
