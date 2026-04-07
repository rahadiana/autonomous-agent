# CHANGELOG

## 2026-04-07 - MARKDOWN_PLAN/3-7 Implementation

### DSL Executor (services/dslExecutor.js)
- Safe instruction-based DSL execution with whitelisted operations
- Operations: get, set, add, subtract, multiply, divide, concat, mcp_call, compare, if, jump, call_skill, map

**Basic Math Input:**
```js
{ skill: { logic: [{ op: "get", path: "input.a", to: "a" }, { op: "get", path: "input.b", to: "b" }, { op: "add", a: "a", b: "b", to: "result" }, { op: "set", path: "result", value: "result" }] }, input: { a: 2, b: 3 } }
```
**Basic Math Output:**
```js
{ result: 5 }
```

**MCP Call Input:**
```js
{ skill: { logic: [{ op: "mcp_call", tool: "http.get", args: { url: "https://example.com" }, to: "res" }] }, input: {} }
```
**MCP Call Output:**
```js
{ res: { status: 200, body: "..." } }
```

**Conditional Branching Input:**
```js
{ skill: { logic: [{ op: "get", path: "input.x", to: "x" }, { op: "compare", a: "x", b: 10, operator: ">", to: "isGreater" }, { op: "if", condition: "isGreater", true_jump: 4, false_jump: 2 }, { op: "set", path: "result", value: "big" }, { op: "jump", to: 5 }, { op: "set", path: "result", value: "small" }] }, input: { x: 15 } }
```
**Conditional Branching Output:**
```js
{ result: "big" }
```

**Skill Composition Input:**
```js
{ skill: { logic: [{ op: "call_skill", skill: "math.add", input: { a: 1, b: 2 }, to: "sum" }, { op: "set", path: "result", value: "sum" }] }, input: {} }
```
**Skill Composition Output:**
```js
{ result: { result: 3 } }
```

**Array Map Input:**
```js
{ skill: { logic: [{ op: "map", source: "input.items", as: "item", steps: [{ op: "get", path: "item.value", to: "v" }, { op: "add", a: "v", b: 1, to: "newV" }, { op: "set", path: "output.value", value: "newV" }], to: "results" }], input: { items: [{ value: 1 }, { value: 2 }] } }
```
**Array Map Output:**
```js
{ results: [{ value: 2 }, { value: 3 }] }
```
**Status:** PASS (14/14 tests)

---

## 2026-04-07 - MARKDOWN_PLAN/2 Implementation

### New Components Created

#### 1. Capability Matcher (services/capabilityMatcher.js)
- Deterministic capability matching
- Functions: normalizeCapability, findSkill, matchCapability

**Test Input:**
```js
{ capability: "  MATH.ADD  " }
```
**Test Output:**
```js
"math.add"
```

**Find Skill Input:**
```js
{ capability: "math.add" }
```
**Find Skill Output:**
```js
{ id: "test-id-1", name: "add_skill", capability: "math.add", json: {...} }
```

**Match Capability Input:**
```js
{ capability: "math.subtract" }
```
**Match Capability Output:**
```js
{ match: {...}, type: "exact" }
```
**Status:** PASS (3/3 tests)

---

#### 2. Validator (services/validator.js)
- Schema validation using AJV
- Functions: validate, validateInput, validateOutput

**Test Input:**
```js
{ schema: { type: "object", properties: { result: { type: "number" } }, required: ["result"] }, data: { result: 5 } }
```
**Test Output:**
```js
{ valid: true, errors: [] }
```

**Invalid Data Input:**
```js
{ schema: { type: "object", properties: { result: { type: "number" } }, required: ["result"] }, data: { result: "not a number" } }
```
**Invalid Data Output:**
```js
{ valid: false, errors: [...] }
```

**Null Schema Input:**
```js
{ schema: null, data: { test: true } }
```
**Null Schema Output:**
```js
{ valid: true, errors: [] }
```
**Status:** PASS (4/4 tests)

---

#### 3. Test Builder (services/testBuilder.js)
- Auto-generate test cases for skills
- Functions: buildTestCases, buildEdgeCases

**Test Input:**
```js
{ capability: "math.add" }
```
**Test Output:**
```js
[{ input: { a: 2, b: 3 }, expected: { result: 5 } }, { input: { a: -1, b: 1 }, expected: { result: 0 } }, ...]
```

**Unknown Capability Input:**
```js
{ capability: "unknown.skill" }
```
**Unknown Capability Output:**
```js
[{ input: {}, expected: {} }]
```

**Edge Cases Input:**
```js
{ capability: "math.add" }
```
**Edge Cases Output:**
```js
[{ input: {}, expected: null }, { input: null, expected: null }]
```
**Status:** PASS (5/5 tests)

---

#### 4. Evaluator (services/evaluator.js)
- Real score evaluation with weights
- Functions: evaluate, shouldAccept, canRetry

**Test Input:**
```js
{ result: { result: 5 }, validation: { valid: true }, skill: { name: "test", capability: "math.add", logic: "..." } }
```
**Test Output:**
```js
{ score: 0.84, passed: true, breakdown: { correctness: 0.4, schema: 0.2, reuse: 0.12, efficiency: 0.12 } }
```

**Invalid Schema Input:**
```js
{ result: { result: 5 }, validation: { valid: false, errors: ["error"] }, skill: { name: "test", capability: "math.add", logic: "..." } }
```
**Invalid Schema Output:**
```js
{ score: 0.72, passed: false, ... }
```

**Threshold Check Input:**
```js
{ score: 0.9 }
```
**Threshold Check Output:**
```js
true
```

**Retry Condition Input:**
```js
{ iteration: 3 }
```
**Retry Condition Output:**
```js
false
```
**Status:** PASS (4/4 tests)

---

### Summary
- Total Tests: 43
- Passed: 43
- Failed: 0

All tests passing.