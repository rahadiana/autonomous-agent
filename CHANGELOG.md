# CHANGELOG

## Test Results - All 226 tests PASSED

### Improvements Implemented from next_plan.md

#### 1. Step-Level Output Validation (core/executor.js:983-1012)
Input: Skill with output_schema + execution result
Output: Validation result with errors array

```javascript
// Input
{
  output_schema: {
    type: "object",
    properties: { status: { type: "number" } },
    required: ["status"]
  },
  output: { status: 200 }
}

// Output
{ valid: true, errors: [] }

// Invalid case
// Input output: { status: "200" } (string instead of number)
// Output: { valid: false, errors: ["Field status expected type number, got string"] }
```

#### 2. DSL Branching - if operation (core/executor.js:597-607)
Input: DSL skill with conditional logic
Output: Executed output based on condition

```javascript
// Input
{
  logic: [
    {
      op: "if",
      condition: "$input.age > 18",
      branches: {
        then: [{ op: "set", path: "output.status", value: "adult" }],
        else: [{ op: "set", path: "output.status", value: "minor" }]
      }
    }
  ],
  input: { age: 20 }
}

// Output
{ status: "adult" }

// Input age: 16
// Output: { status: "minor" }
```

#### 3. DSL Branching - map operation (core/executor.js:740-795)
Input: DSL skill with map logic over array
Output: Transformed array results

```javascript
// Input
{
  logic: [
    {
      op: "map",
      collection: "$input.items",
      step: { op: "set", path: "output.value", value: { "$memory.item": { "$multiply": 2 } } }
    }
  ],
  input: { items: [1, 2, 3] }
}

// Output
{ value: [2, 4, 6] }
```

#### 4. Bandit-Based Skill Selection (core/bandit.js:1-28)
Input: Array of skills with scores and usage_count
Output: Selected skill with highest bandit score

```javascript
// Input
[
  { id: "skill1", score: 0.9, usage_count: 10 },
  { id: "skill2", score: 0.8, usage_count: 0 },
  { id: "skill3", score: 0.85, usage_count: 5 }
]

// Output (skill2 selected due to exploration bonus)
{ id: "skill2", score: 0.8, usage_count: 0 }
```

#### 5. Test Generator with Edge Cases (core/testBuilder.js:17-62)
Input: Skill with input_schema
Output: Array of test cases including edge cases

```javascript
// Input
{
  input_schema: {
    properties: {
      age: { type: "number" },
      name: { type: "string" }
    }
  }
}

// Output
[
  { input: { age: 1, name: "test" } },
  { input: {} },
  { input: null },
  { input: { age: 0 } },
  { input: { age: -1 } },
  { input: { age: 1, name: "" } }
]
```

#### 6. MCP Cache Layer (core/mcp.js:6-27)
Input: HTTP request to same URL with same args
Output: Cached result on subsequent calls

```javascript
// Input (first call)
{ tool: "http.get", args: { url: "https://api.example.com/data" } }

// Output
{ status: 200, statusText: "OK", body: "..." }

// Input (second call with same args)
// Output: { status: 200, statusText: "OK", body: "..." } (cached)
```

#### 7. Versioned State for Blackboard (core/blackboard.js:151,182,202)
Input: State patches to blackboard zones
Output: Version incremented on each write

```javascript
// Input
blackboard.write("plan", newPlan, "planner")

// Output
{
  data: newPlan,
  version: 2,  // incremented
  locked: false
}
```

#### 8. Plan Validation (core/evaluation.js:474-509)
Input: Plan with bestPath + registry
Output: Validation result with invalidSteps

```javascript
// Input
{
  bestPath: [
    { capability: "fetch_user" },
    { capability: "process_data" }
  ]
}

// Registry: { "fetch_user": skillObj, "process_data": skillObj }

// Output
{ valid: true, invalidSteps: [], validSteps: 2 }

// Invalid case
// Input: { bestPath: [{ capability: "unknown_skill" }] }
// Output: { valid: false, invalidSteps: [{ capability: "unknown_skill", reason: "capability_not_found" }] }
```

#### 9. Episodic Memory Storage (core/episodicMemory.js:311-350)
Input: goal, plan, result, score
Output: Saved episode with embedding

```javascript
// Input
{
  goal: "fetch user data",
  plan: { steps: [...] },
  result: { user: {...} },
  score: 0.95
}

// Output
{
  id: "ep_1234567890_abc",
  goal: "fetch user data",
  plan: { steps: [...] },
  result: { user: {...} },
  score: 0.95,
  embedding: [...],
  created_at: 1234567890000,
  usage_count: 0
}
```

#### 10. Executor Config Limits (core/executor.js:21-45)
Input: EXECUTOR_CONFIG
Output: Enforced execution limits

```javascript
// Input config
{
  stepTimeoutMs: 100,
  maxSteps: 20,
  maxCost: 100,
  maxMcpCall: 3,
  maxRetries: 2
}

// Execution behavior:
// - Steps exceeding maxSteps: Error thrown
// - MCP calls exceeding maxMcpCall: Error thrown
// - Step timeout: Error thrown
```

### Test Input/Output Summary by Script

#### test/bandit.test.js
```javascript
// Input: skills array with varying scores and usage_count
// Output: Selected skill with highest bandit score

Test: banditScore returns higher score for unexplored skills
Input: { score: 0.5, usage_count: 0 }, total: 10
Output: exploration bonus applied

Test: selectSkill picks the skill with highest bandit score  
Input: [{ score: 0.9, usage_count: 10 }, { score: 0.8, usage_count: 0 }]
Output: { score: 0.8, usage_count: 0 } (exploration wins)
```

#### test/executor.test.js
```javascript
// Input: DSL skill with logic
// Output: Execution result with _meta

Test: runSkill executes basic logic
Input: { logic: [{ op: "add", a: 1, b: 2, to: "result" }] }
Output: { result: 3 }

Test: runSkill handles conditional logic
Input: { logic: [{ op: "if", condition: "1 > 0", branches: {...} }] }
Output: { status: "..." }

Test: runSkill executes mcp_call
Input: { logic: [{ op: "mcp_call", tool: "http.get", args: {...} }] }
Output: { ok: true, data: {...} }
```

#### test/executorDSL.test.js
```javascript
// Input: Complex DSL with nested operations
// Output: Resolved values with $ reference system

Test: resolveValue handles $memory reference
Input: "$memory.user.name", { memory: { user: { name: "John" } } }
Output: "John"

Test: resolveValue handles $input reference
Input: "$input.age", { input: { age: 25 } }
Output: 25
```

#### test/testBuilder.test.js
```javascript
// Input: Skill with schema
// Output: Generated test cases

Test: buildTestCases generates test cases
Input: { input_schema: { properties: { age: { type: "number" } } } }
Output: [{ input: { age: 1 } }, { input: { age: 0 } }, { input: { age: -1 } }]

Test: buildRandomFuzz generates random inputs
Input: { output_schema: { properties: { value: { type: "number" } } } }, count: 3
Output: [{ input: { value: -23 } }, { input: { value: 47 } }, { input: { value: -5 } }]
```

#### test/mcp.test.js
```javascript
// Input: Tool name and args
// Output: Normalized result with cache

Test: http.get with caching
Input: { url: "https://example.com" }
Output: { ok: true, data: {...}, raw: "..." } (cached on repeat calls)
```

### Summary
- Total Tests: 226
- Pass: 226
- Fail: 0
- Duration: ~1908ms

### Architecture Status
All improvements from next_plan.md addressed:
1. ✅ Step-level output validation - core/executor.js
2. ✅ DSL branching (if, map) - core/executor.js
3. ✅ Test generator with edge cases - core/testBuilder.js
4. ✅ Bandit-based skill selection - core/bandit.js
5. ✅ MCP cache layer - core/mcp.js
6. ✅ Plan validation - core/evaluation.js
7. ✅ Episodic memory storage - core/episodicMemory.js
8. ✅ Versioned state for blackboard - core/blackboard.js
