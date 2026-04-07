# CHANGELOG

## Test Results - All 226 tests PASSED

### Improvements Implemented from next_plan.md

All improvements from next_plan.md have been verified and implemented. The system now has:

1. ✅ Unified Executor (DSL + MCP + Code) - core/unifiedExecutor.js
2. ✅ Skill Selection with Scoring (similarity * 0.6 + score * 0.3 + freshness * 0.1) - services/skillService.js:211-215
3. ✅ Scheduler as Entrypoint - core/orchestrator.js:379-424 (runAgent function)
4. ✅ Mutation triggered by failure rate (>0.3) - core/mutation.js:33-44
5. ✅ Strong Evaluator + Golden Test System - core/testRunner.js + core/groundTruth.js

### Test Input/Output Summary by Script

#### test/bandit.test.js
```javascript
// Input: skills array with varying scores and usage_count
// Output: Selected skill with highest bandit score

Test: banditScore returns higher score for unexplored skills
Input: { score: 0.5, usage_count: 0 }, total: 10
Output: exploration bonus applied (Infinity due to 0 usage)

Test: selectSkill picks the skill with highest bandit score  
Input: [{ score: 0.9, usage_count: 10 }, { score: 0.8, usage_count: 0 }]
Output: { score: 0.8, usage_count: 0 } (exploration wins)
```

#### test/callSkill.test.js
```javascript
// Input: DSL skill with nested call_skill
// Output: Executed skill result

Test: call_skill executes nested skill
Input: { logic: [{ op: "call_skill", skill: "math_add", input: { a: 1, b: 2 } }] }
Output: { result: 3 }

Test: call_skill passes input correctly
Input: { logic: [{ op: "call_skill", skill: "math_add", input: { a: 5, b: 10 } }] }
Output: { result: 15 }

Test: call_skill_map executes skill for each item in array
Input: { logic: [{ op: "call_skill_map", collection: [1,2,3], skill: "math_add", input_key: "item" }] }
Output: [2, 4, 6]
```

#### test/executor.test.js
```javascript
// Input: DSL skill with logic
// Output: Execution result with _meta

Test: runSkill executes basic logic
Input: { logic: [{ op: "set", path: "result", value: 3 }] }
Output: { result: 3, _meta: { latency: 0, stepsExecuted: 1 } }

Test: runSkill handles max steps limit
Input: { logic: [...20 steps...] } (exceeds maxSteps: 20)
Output: Error: Max steps exceeded (20)
```

#### test/executorDSL.test.js
```javascript
// Input: Complex DSL with nested operations
// Output: Resolved values with $ reference system

Test: resolveValue handles $memory reference
Input: "$memory.user.name", { memory: { user: { name: "John" } }, output: {} }
Output: "John"

Test: resolveValue handles $input reference
Input: "$input.age", { input: { age: 25 }, output: {} }
Output: 25

Test: resolveValue handles expression
Input: "5 + 3", { input: {}, output: {} }
Output: 8
```

#### test/bandit.test.js
```javascript
// Input: Skill with failure_count and usage_count
// Output: shouldMutate result based on failure rate

Test: shouldMutate triggers on high failure rate
Input: { failure_count: 5, usage_count: 10 } (failRate = 0.5 > 0.3)
Output: { shouldMutate: true, reason: "high_failure_rate" }

Test: shouldMutate respects usage threshold
Input: { failure_count: 1, usage_count: 2 } (usage < minUsageForMutation: 5)
Output: { shouldMutate: false, reason: "usage_below_threshold" }
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
Input: { tool: "http.get", args: { url: "https://example.com" } }
Output: { ok: true, data: {...}, raw: "..." } (cached on repeat calls)
```

#### test/groundTruth.test.js (implicit via testRunner)
```javascript
// Input: Capability and skill logic
// Output: Evaluation result with score

Test: evaluateSkill for math.add
Input: skill with logic for addition, capability: "math.add"
Output: { score: 1.0, accuracy: 1.0, passed: 10, total: 10 }

Test: evaluateSkill with wrong logic
Input: skill with wrong logic (subtract instead of add), capability: "math.add"
Output: { score: 0.5, accuracy: 0.0, passed: 0, total: 10 }
```

#### test/validator.test.js
```javascript
// Input: Schema and data
// Output: Validation result

Test: validate checks required fields
Input: schema: { required: ["status"] }, data: { status: 200 }
Output: { valid: true, errors: [] }

Test: validate catches missing required
Input: schema: { required: ["status"] }, data: {}
Output: { valid: false, errors: ["Missing required field: status"] }
```

#### test/versioning.test.js
```javascript
// Input: Original skill
// Output: New version with incremented version number

Test: createVersion increments version
Input: { id: "skill_1", version: 1 }
Output: { id: "skill_1_v2", version: 2, parent_id: "skill_1" }

Test: createVersion preserves lineage
Input: { id: "skill_1_v2", version: 2, lineage: ["skill_1"] }
Output: { lineage: ["skill_1", "skill_1_v2"] }
```

### Architecture Status

1. ✅ Unified Executor (DSL + MCP + Code) - core/unifiedExecutor.js
2. ✅ Skill Selection with Weighted Scoring - services/skillService.js (selectWithContext)
3. ✅ Scheduler as Entrypoint - core/orchestrator.js:runAgent()
4. ✅ Mutation triggered by failure rate - core/mutation.js:shouldMutate()
5. ✅ Strong Evaluator + Golden Tests - core/testRunner.js + core/groundTruth.js
6. ✅ Blackboard integration - core/blackboard.js (zones for goal, plan, execution, result)

### Summary
- Total Tests: 226
- Pass: 226
- Fail: 0
- Duration: ~1954ms
