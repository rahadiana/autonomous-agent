# CHANGELOG

## April 7, 2026 - All Tests PASSED

Total: 226 tests passed

---

## Test Input/Output Examples by Script

### 1. bandit.test.js

**Test: banditScore returns higher score for unexplored skills**
```javascript
// Input
const skillA = { score: 0.5, usage_count: 0 };
const skillB = { score: 0.5, usage_count: 100 };
const total = 100;

// Output
// scoreA > scoreB (exploration bonus for unused skill)
```

**Test: selectSkill picks the skill with highest bandit score**
```javascript
// Input
const skills = [
  { score: 0.5, usage_count: 0 },
  { score: 0.7, usage_count: 0 },
  { score: 0.3, usage_count: 0 }
];

// Output
{ score: 0.7 } // selects highest score
```

---

### 2. callSkill.test.js

**Test: call_skill executes nested skill**
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

**Test: call_skill_map executes skill for each item**
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

### 3. executor.test.js

**Test: runSkill executes basic logic and returns output**
```javascript
// Input
const skill = { logic: "output.result = input.a + input.b;" };
const input = { a: 10, b: 5 };

// Output
{ result: 15 }
```

**Test: runSkill handles conditional logic**
```javascript
// Input
const skill = { logic: `if (input.value > 0) { output.status = "positive"; }` };
const input = { value: 42 };

// Output
{ status: "positive" }
```

**Test: runSkill throws on invalid JS syntax**
```javascript
// Input
const skill = { logic: "output.result = input.a + ;" };
const input = { a: 1 };

// Output
// Throws SyntaxError
```

---

### 4. executorDSL.test.js

**Test: for loop iterates over array**
```javascript
// Input
const skill = {
  logic: [{
    op: "set", path: "items", value: [1, 2, 3]
  }, {
    op: "for", collection: "$memory.items", var: "i",
    steps: [{ op: "set", path: "last", value: "$memory.i" }]
  }]
};

// Output
{ items: [1, 2, 3], last: 3 }
```

**Test: switch matches correct case**
```javascript
// Input
const skill = {
  logic: [{
    op: "switch", value: "$input.color",
    cases: {
      "red": [{ op: "set", path: "status", value: "error" }],
      "default": [{ op: "set", path: "status", value: "ok" }]
    }
  }]
};

// Output
{ status: "ok" }
```

---

### 5. executorDSLAdvanced.test.js

**Test: map transforms array**
```javascript
// Input
const skill = {
  logic: [{
    op: "map",
    collection: [1, 2, 3],
    transform: { op: "multiply", a: "$item", b: 2 }
  }]
};

// Output
{ results: [2, 4, 6] }
```

**Test: filter removes items by condition**
```javascript
// Input
const skill = {
  logic: [{
    op: "filter",
    collection: [1, 2, 3, 4],
    condition: { left: "$item", op: "gt", right: 2 }
  }]
};

// Output
{ results: [3, 4] }
```

---

### 6. executorSafety.test.js

**Test: runSkill throws on dangerous code with process**
```javascript
// Input
const skill = { logic: "output.x = process.exit(0);" };

// Output
// Throws Error: Dangerous operation
```

**Test: runSkill timeout prevents infinite loops**
```javascript
// Input
const skill = { logic: "while(true) {}" };
const timeout = 1000;

// Output
// Throws Error: Execution timeout
```

---

### 7. validator.test.js

**Test: validate returns true for valid data**
```javascript
// Input
const schema = { type: "object", properties: { result: { type: "number" } }, required: ["result"] };
const data = { result: 42 };

// Output
{ valid: true, errors: [] }
```

**Test: validate returns false for missing required field**
```javascript
// Input
const schema = { type: "object", properties: { result: { type: "number" } }, required: ["result"] };
const data = {};

// Output
{ valid: false, errors: ["Missing required field: result"] }
```

**Test: validate returns false for wrong type**
```javascript
// Input
const schema = { type: "object", properties: { result: { type: "number" } } };
const data = { result: "not a number" };

// Output
{ valid: false, errors: ["Field result expected type number, got string"] }
```

---

### 8. vectorStore.test.js

**Test: generateEmbedding returns 128-dim vector**
```javascript
// Input
generateEmbedding("hello world");

// Output
// [0.1, -0.2, 0.3, ...] // 128 elements, normalized
```

**Test: cosineSimilarity returns 1 for identical vectors**
```javascript
// Input
cosineSimilarity([1, 0, 0], [1, 0, 0]);

// Output
1
```

**Test: VectorStore search returns top K results**
```javascript
// Input
const store = new VectorStore(3);
store.add("a", [1, 0, 0]);
store.add("b", [0, 1, 0]);
store.search([1, 0, 0], 2);

// Output
[{ id: "a", score: 1 }, { id: "b", score: 0 }]
```

---

### 9. toolRegistry.test.js

**Test: createTool creates tool with defaults**
```javascript
// Input
createTool({ name: "test_tool", description: "A test tool", handler: async () => ({}) });

// Output
{ name: "test_tool", capability: "test_tool", version: 1, deprecated: false, input_schema: {...}, output_schema: {...} }
```

**Test: ToolRegistry register throws on duplicate**
```javascript
// Input
const registry = createToolRegistry();
registry.register({ name: "dup", handler: () => {} });
registry.register({ name: "dup", handler: () => {} });

// Output
// Throws Error: Tool dup already registered
```

---

### 10. testBuilder.test.js

**Test: buildTestCases generates number test cases**
```javascript
// Input
const skill = { output_schema: { properties: { value: { type: "number" } } } };
buildTestCases(skill);

// Output
[{ input: { value: 0 } }, { input: { value: 1 } }, { input: { value: -1 } }]
```

**Test: buildEdgeCases includes null and undefined**
```javascript
// Input
buildEdgeCases({});

// Output
[{ input: null }, { input: undefined }, { input: [] }, { input: "" }]
```

---

### 11. testRunner.test.js

**Test: runTests returns correct passed count for valid skills**
```javascript
// Input
const skill = { logic: "output.result = input.a + input.b;", output_schema: { ... } };
const testCases = [{ input: { a: 1, b: 2 } }, { input: { a: 5, b: 3 } }];

// Output
{ passed: 2, total: 2, score: 1.0, results: [...] }
```

**Test: runTests handles runtime errors gracefully**
```javascript
// Input
const skill = { logic: "output.result = nonexistentVariable;" };
const testCases = [{ input: {} }];

// Output
{ passed: 0, total: 1, results: [{ passed: false, error: "ReferenceError: ..." }] }
```

---

### 12. evaluator.test.js

**Test: correct skill gets high score**
```javascript
// Input
const skill = { logic: "output.result = input.a + input.b;", output_schema: { ... } };
evaluateSkill(skill, "math.add");

// Output
{ score: 1.0, accuracy: 1.0, stable: true, details: [{ passed: true, ... }] }
```

**Test: wrong skill gets low score**
```javascript
// Input
const skill = { logic: "output.result = input.a - input.b;", output_schema: { ... } }; // WRONG
evaluateSkill(skill, "math.add");

// Output
{ score: 0.0, accuracy: 0.0, stable: true, details: [{ passed: false, ... }] }
```

---

### 13. versioning.test.js

**Test: createVersion creates a new skill with incremented version**
```javascript
// Input
const parent = { id: "a1a1...", version: 1, capability: "math.add" };
createVersion(parent, { logic: "output.result = input.a + input.b + 1;" });

// Output
{ id: "b2b2...", version: 2, parent_id: "a1a1...", capability: "math.add" }
```

**Test: createVersion chains versions correctly**
```javascript
// Input
const parent = { id: "parent-1", version: 1 };
const v1 = await createVersion(parent, { logic: "v1" });
const v2 = await createVersion(v1, { logic: "v2" });

// Output
// v2.parent_id = v1.id (chains correctly)
```

---

### 14. skillService.test.js

**Test: handleRequest executes skill and returns result**
```javascript
// Input
handleRequest({ a: 3, b: 4 }, "math.add");

// Output
{ result: 7 }
```

**Test: handleRequest updates usage_count after execution**
```javascript
// Input
// Skill with usage_count: 5
handleRequest({}, "math.add");

// Output
// Skill usage_count updated to 6
```

---

### 15. planner.test.js

**Test: Planner search finds solution for simple goal**
```javascript
// Input
const planner = new Planner();
planner.search({ goal: "add numbers", maxNodes: 100 });

// Output
{ success: true, plan: [{ action: "add", ... }], score: 0.8 }
```

**Test: Planner respects maxNodes limit**
```javascript
// Input
planner.search({ goal: "complex task", maxNodes: 5 });

// Output
{ success: false, status: "limit_exceeded" }
```

---

### 16. reasoner.test.js

**Test: Reasoner evaluate returns score for valid plan**
```javascript
// Input
const reasoner = new Reasoner();
reasoner.evaluate({ plan: [{ step: "add" }], constraints: {} });

// Output
{ score: 0.9, valid: true, constraints_met: true }
```

**Test: Reasoner critique identifies issues**
```javascript
// Input
reasoner.critique({ plan: [{ action: "a" }, { action: "a" }, { action: "a" }], history: [] });

// Output
{ issues: ["Plan lacks diversity"], score: 0.3 }
```

---

### 17. pruning.test.js

**Test: pruneSkills respects minUsage protection**
```javascript
// Input
const skills = [{ id: "s1", score: 0.3, usage_count: 2 }, { id: "s2", score: 0.2, usage_count: 100 }];
pruneSkills(skills, { minUsage: 5 });

// Output
// s1 pruned, s2 kept (high usage protection)
```

---

### 18. decay.test.js

**Test: applyDecay reduces score for old skills**
```javascript
// Input
const skill = { score: 0.8, last_used_at: Date.now() - (30 * 24 * 60 * 60 * 1000) };
applyDecay(skill);

// Output
{ score: 0.64 } // 0.8 * (1 - 0.05 * 1)
```

---

### 19. scoring.test.js

**Test: scoreFromEvaluation extracts score from eval result**
```javascript
// Input
scoreFromEvaluation({ score: 0.85, details: [...] });

// Output
0.85
```

---

## System Status

| Component | Status |
|-----------|--------|
| Tests | 226 PASSED |
| Executor | DSL + safety + timeout |
| Skill Registry | CRUD + versioning |
| Evaluator | ground truth + scoring |
| Planner | tree search + constraints |
| Vector Store | semantic search |
| Bandit | reinforcement learning |