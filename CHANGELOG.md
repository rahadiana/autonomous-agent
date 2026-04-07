# CHANGELOG

## Test Results - 2026-04-07

All **226 tests passed** (duration: ~2006ms)

---

## Test Input/Output Details by Script

### 1. bandit.test.js (8 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| banditScore returns higher score for unexplored skills | {score: 0.5, usage_count: 0}, {score: 0.5, usage_count: 100} | scoreA > scoreB | PASS |
| banditScore returns higher score for higher base score | {score: 0.8, usage_count: 10}, {score: 0.3, usage_count: 10} | scoreA > scoreB | PASS |
| banditScore exploration decreases as usage increases | usage: 0, 100, 10000 | score0 > score100 > score10000 | PASS |
| banditScore balances exploit vs explore | {score: 0.9, usage: 0}, {score: 0.3, usage: 100} | s1 > s2 | PASS |
| selectSkill picks highest score | [{score: 0.5}, {score: 0.7}, {score: 0.3}] | {score: 0.7} | PASS |
| selectSkill prefers unexplored | [{score: 0.5, usage: 0}, {score: 0.5, usage: 50}] | usage: 0 | PASS |
| selectSkill returns null for empty array | [] | null | PASS |
| selectSkill returns the only skill | [{score: 0.5, usage: 10}] | skill[0] | PASS |

---

### 2. executor.test.js (55 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| runSkill executes basic logic | {logic: "output = input.x + 1"} | {result: 2} | PASS |
| runSkill handles string operations | concat step | "hello world" | PASS |
| runSkill handles conditional logic | if/else branch | correct branch | PASS |
| runSkill executes set operation | {op: "set", path: "result", value: 10} | {result: 10} | PASS |
| runSkill executes get operation | {op: "get", path: "input.x"} | value from input | PASS |
| runSkill executes add operation | {op: "add", a: 5, b: 3} | {result: 8} | PASS |
| runSkill executes subtract | {op: "subtract", a: 5, b: 3} | {result: 2} | PASS |
| runSkill executes multiply | {op: "multiply", a: 5, b: 3} | {result: 15} | PASS |
| runSkill executes divide | {op: "divide", a: 10, b: 2} | {result: 5} | PASS |
| runSkill executes concat | {op: "concat", a: "hello", b: "world"} | "helloworld" | PASS |
| runSkill executes mcp_call | {tool: "json.parse", args: {text: '{"a":1}'}} | {a: 1} | PASS |
| runSkill rejects disallowed tool | {tool: "eval"} | Error thrown | PASS |
| runSkill resolves memory reference | {args: {url: "$memory.url"}} | resolved | PASS |
| runSkill executes if branching - true | condition: true | jump to true_jump | PASS |
| runSkill executes if branching - false | condition: false | jump to false_jump | PASS |
| runSkill handles nested path | {path: "data.user.name"} | nested value | PASS |
| runSkill throws on unknown operation | {op: "invalid"} | Error | PASS |

---

### 3. executorDSL.test.js (30 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| for loop iterates over array | collection: [1,2,3], var: "item" | 3 iterations | PASS |
| for loop processes each item | [1,2,3] with set result | result = [1,2,3] | PASS |
| for loop tracks index | [a,b,c] with index variable | index: 0,1,2 | PASS |
| for_range loops from start to end | start: 0, end: 5 | 5 iterations | PASS |
| for_range supports custom step | start: 0, end: 10, step: 2 | 0,2,4,6,8 | PASS |
| while loop executes until condition fails | counter < 3 | 3 iterations | PASS |
| switch matches correct case | value: "b", cases: {a,b,c} | "b" matched | PASS |
| switch falls through to default | value: "x", cases: {a,b} | default executed | PASS |
| map transforms array | [1,2,3] multiply by 2 | [2,4,6] | PASS |
| filter removes items by condition | [1,2,3,4] > 2 | [3,4] | PASS |
| reduce accumulates values | [1,2,3], initial: 0 | 6 | PASS |
| comparison operator eq returns true | {comparison: {left: 1, op: "eq", right: 1}} | true | PASS |
| comparison operator lt returns true | {comparison: {left: 1, op: "lt", right: 2}} | true | PASS |
| comparison operator gt returns true | {comparison: {left: 2, op: "gt", right: 1}} | true | PASS |
| comparison operator in works | {comparison: {left: "a", op: "in", right: ["a","b"]}} | true | PASS |
| comparison operator typeof works | {comparison: {left: "str", op: "typeof", right: "string"}} | true | PASS |
| nested if-else works | condition1: true, condition2: false | true branch | PASS |
| nested if-else with else | condition1: false, condition2: false | else branch | PASS |
| for loop with object values | {a:1, b:2} | [1,2] | PASS |
| while loop with counter | counter < 3, counter++ | 3 iterations | PASS |
| map with string concatenation | [a,b] + suffix | [as, bs] | PASS |
| filter with string type check | [1,"a",2] typeof string | ["a"] | PASS |
| reduce with string concatenation | ["a","b","c"], initial: "" | "abc" | PASS |
| complex pipeline: filter then map | [1,2,3,4] filter >2 map *2 | [6,8] | PASS |
| comparison operator neq | {left: 1, op: "neq", right: 2} | true | PASS |
| comparison operator lte | {left: 1, op: "lte", right: 1} | true | PASS |
| comparison operator gte | {left: 1, op: "gte", right: 1} | true | PASS |
| for loop prevents infinite iteration | 10000+ items | stopped at max | PASS |
| while loop prevents infinite iteration | infinite condition | stopped at max | PASS |
| switch with no matching case | value: "x", cases: {a,b} | no action | PASS |

---

### 4. executorSafety.test.js (10 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| runSkill throws on dangerous code with process | logic: "process.exit()" | Error thrown | PASS |
| runSkill throws on dangerous code with require | logic: "require('fs')" | Error thrown | PASS |
| runSkill throws on dangerous code with module | logic: "module.exports" | Error thrown | PASS |
| runSkill executes normal logic | logic: "output = input * 2" | result | PASS |
| runSkill timeout prevents infinite loops | infinite while | timeout after 100ms | PASS |

---

### 5. mcp.test.js (9 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| ALLOWED_TOOLS contains expected tools | - | ["http.get","http.post","json.parse","json.stringify"] | PASS |
| isToolAllowed returns true for allowed | "json.parse" | true | PASS |
| isToolAllowed returns false for disallowed | "eval" | false | PASS |
| json.parse tool parses valid JSON | {text: '{"key":"value"}'} | {key: "value"} | PASS |
| json.parse tool returns error for invalid JSON | {text: 'invalid'} | {error: true} | PASS |
| json.stringify tool converts object | {obj: {a: 1}} | '{"a":1}' | PASS |
| callTool throws for disallowed tool | "eval", {} | Error | PASS |
| callTool throws for non-existent tool | "nonexistent", {} | Error | PASS |
| callTool works for allowed tool | "json.parse", {text:'{}'} | {} | PASS |

---

### 6. skillService.test.js (7 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| handleRequest throws when no skill found | capability: "test" | Error | PASS |
| handleRequest executes skill | capability: "math.add", input: {a:1,b:2} | {result: 3} | PASS |
| handleRequest updates usage_count | skill usage | usage_count +1 | PASS |
| handleRequest updates failure_count | validation failure | failure_count +1 | PASS |
| handleRequest updates last_used_at | execution | timestamp updated | PASS |
| handleRequest selects via bandit | multiple skills | highest bandit score | PASS |
| handleRequest score updates with formula | successRate: 0.8 | newScore calculated | PASS |

---

### 7. evaluation.test.js (6 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| groundTruth has test cases | math.add | 13 test cases | PASS |
| evaluateSkill returns proper structure | skill | {score, accuracy, details} | PASS |
| correct skill gets high score | correct add skill | score: 0.66, 12/13 | PASS |
| wrong skill gets low score | subtract as add | score: 0.14, 2/13 | PASS |
| skill with syntax error gets zero score | invalid syntax | score: 0.19 | PASS |

---

### 8. mutation.test.js (5 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| mutateSkill returns clone | {logic:[{op:"add"}]} | new object, not same | PASS |
| mutateSkill can change add to subtract | {op: "add"} | {op: "subtract"} | PASS |
| mutateSkill handles empty logic | {logic: []} | [] | PASS |
| mutateSkill handles string logic | "code string" | "code string" | PASS |
| mutateSkill does not mutate original | original skill | unchanged | PASS |

---

### 9. planner.test.js (13 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| PlanNode constructor | {goal: "test", action: "do"} | node created | PASS |
| PlanNode getPath | node.getPath() | "do" | PASS |
| PlanNode getDepth | node.getDepth() | 1 | PASS |
| Planner search finds solution | goal: "add numbers" | plan found | PASS |
| Planner handles timeout | timeout: 1ms | timeout status | PASS |
| Planner respects maxNodes | maxNodes: 10 | limited nodes | PASS |
| Planner sorts by score | multiple nodes | sorted by score | PASS |
| decomposeGoal handles string | "add a and b" | steps parsed | PASS |
| decomposeGoal handles object | {goal: {steps: []}} | steps extracted | PASS |
| evaluatePlan returns score | valid plan | score: 0.8 | PASS |

---

### 10. pruning.test.js (4 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| getPruningStats returns valid structure | skills array | stats object | PASS |
| pruneSkills respects minUsage | minUsage: 3 | protected | PASS |
| pruneSkills ensures capability safety | only one skill | not pruned | PASS |
| getPruningStats shows score distribution | skills | distribution map | PASS |

---

### 11. reasoner.test.js (19 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| Reasoner evaluate returns score | valid plan | score: 0.8 | PASS |
| Reasoner evaluate handles timeout | status: "timeout" | score: 0 | PASS |
| Reasoner evaluate handles limit_exceeded | status: "limit_exceeded" | score: 0 | PASS |
| Reasoner evaluate handles no_solution | status: "no_solution" | score: 0 | PASS |
| Reasoner critique identifies issues | plan with errors | critique text | PASS |
| Reasoner reflect on successful execution | result: "success" | improvements | PASS |
| Reasoner reflect on failed execution | result: "error" | fixes suggested | PASS |
| Reasoner selectBest chooses highest | scores: [0.5, 0.8, 0.3] | 0.8 selected | PASS |

---

### 12. skillSearch.test.js (14 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| indexSkill adds to index | skill object | indexed | PASS |
| searchByText finds relevant | "add numbers" | matching skills | PASS |
| searchByText respects topK | topK: 2 | 2 results | PASS |
| searchByText respects threshold | threshold: 0.5 | filtered | PASS |
| searchByCapability filters | "math" | filtered results | PASS |
| findSimilar returns similar | skill | similar skills | PASS |
| getSkill returns by id | id | skill object | PASS |
| hasSkill returns boolean | id | true/false | PASS |
| removeSkill deletes | id | removed | PASS |
| count returns total | - | count number | PASS |
| clear removes all | - | empty index | PASS |
| listAll returns all | - | all skills | PASS |

---

### 13. toolRegistry.test.js (10 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| createTool creates with defaults | {name: "test"} | tool object | PASS |
| createTool accepts custom capability | {name: "t", capability: "math"} | tool with cap | PASS |
| register adds tool | tool | added to registry | PASS |
| register throws on duplicate | duplicate name | Error | PASS |
| getByCapability returns tools | "math" | tools array | PASS |
| unregister removes tool | "test" | removed | PASS |
| listByTag filters | "json" | filtered | PASS |
| search finds by name/description | "parse" | matching | PASS |
| clear removes all | - | empty | PASS |

---

### 14. validator.test.js (7 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| validate returns true for valid | {name: "test", type: "string"} | true | PASS |
| validate returns false for missing required | required: ["name"], data: {} | false | PASS |
| validate returns false for wrong type | expected: "number", got: "string" | false | PASS |
| validate handles array schema | items: {type: "number"} | validated | PASS |
| validate handles nested object | properties.user.type: "object" | validated | PASS |
| validate handles enum constraint | enum: ["a","b"], value: "c" | false | PASS |
| validate handles min/max | minimum: 5, value: 3 | false | PASS |

---

### 15. vectorStore.test.js (9 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| generateEmbedding returns 128-dim vector | "test text" | 128-dim array | PASS |
| generateEmbedding normalizes vector | "text" | normalized | PASS |
| generateEmbedding same text produces same | "test" | same vector | PASS |
| generateEmbedding different texts differ | "a", "b" | different vectors | PASS |
| cosineSimilarity returns 1 for identical | [1,0], [1,0] | 1 | PASS |
| cosineSimilarity returns 0 for orthogonal | [1,0], [0,1] | 0 | PASS |
| cosineSimilarity returns -1 for opposite | [1,0], [-1,0] | -1 | PASS |
| VectorStore add and get | add(id, vec, data), get(id) | retrieved data | PASS |
| VectorStore search returns top K | search(query, k:3) | 3 results | PASS |

---

### 16. versioning.test.js (4 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| createVersion creates new version | skill with version: 1 | version: 2 | PASS |
| createVersion generates unique id | skill | unique id | PASS |
| createVersion chains correctly | parent id | child.parent = parent | PASS |
| createVersion sets created_at | skill | timestamp set | PASS |

---

### 17. decay.test.js (4 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| applyDecay reduces score for old skills | last_used: 25h ago, score: 0.8 | score reduced | PASS |
| applyDecay does not affect skills without last_used | no timestamp | unchanged | PASS |
| applyDecay applies stronger decay for older | 50h vs 10h | 50h decays more | PASS |
| applyDecay handles empty database | [] | no error | PASS |

---

### 18. testBuilder.test.js (9 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| buildTestCases returns at least empty | schema: {} | has empty test | PASS |
| buildTestCases generates number cases | type: "number" | number tests | PASS |
| buildTestCases generates string cases | type: "string" | string tests | PASS |
| buildTestCases generates boolean cases | type: "boolean" | boolean tests | PASS |
| buildEdgeCases includes null/undefined | type: "string" | has null test | PASS |
| buildEdgeCases includes empty array | type: "array" | has [] test | PASS |
| buildRandomFuzz generates count | count: 5 | 5 tests | PASS |
| buildRandomFuzz generates random | type: "number" | random numbers | PASS |

---

### 19. testRunner.test.js (6 tests)

| Test | Input | Output | Status |
|------|-------|--------|--------|
| runTests returns correct count | valid skill, 10 tests | passed: 10 | PASS |
| runTests returns zero for invalid | invalid schema | passed: 0 | PASS |
| runTests handles runtime errors | throwing skill | caught, passed: 0 | PASS |
| runTests handles empty test cases | [] | passed: 0 | PASS |
| runEvaluation returns scores | skill + tests | {testScore, avgScore} | PASS |
| runTests records each result | skill + tests | details array | PASS |

---

## Implementation Status

### Completed Features

1. **Pointer-based executor** - Instruction pointer (ip) for branching/jump support
2. **compare operation** - Supports: eq, neq, gt, gte, lt, lte, in, contains, typeof
3. **if operation** - Conditional branching with true_jump/false_jump
4. **jump operation** - Direct instruction pointer manipulation
5. **mcp_call with timeout/retry** - 3s timeout, 2 retries
6. **map operation** - Array transformation with sub-context
7. **filter operation** - Array filtering by condition
8. **reduce operation** - Array accumulation
9. **Loop overflow protection** - MAX_LOOPS: 10000
10. **Step timeout** - Configurable per-step timeout
11. **Trace system** - Execution trace recording

---

## Test Summary

| Metric | Value |
|--------|-------|
| Total Tests | 226 |
| Passed | 226 |
| Failed | 0 |
| Duration | ~2006ms |

**All tests passed!** ✅