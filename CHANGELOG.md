# CHANGELOG

## April 7, 2026 - All Tests PASSED

Total: 226 tests passed
Duration: 2083.96ms

---

## Test Results Summary

### bandit.test.js (8 tests)
- **banditScore returns higher score for unexplored skills**: PASS
  - Input: skillA {score: 0.5, usage_count: 0}, skillB {score: 0.5, usage_count: 100}
  - Output: scoreA > scoreB (exploration bonus)
- **selectSkill picks skill with highest bandit score**: PASS
  - Input: skills with scores [0.5, 0.7, 0.3]
  - Output: {score: 0.7} selected
- **selectSkill returns null for empty array**: PASS
- **selectSkill returns only skill**: PASS

### callSkill.test.js (20 tests)
- **call_skill executes nested skill**: PASS (54.5ms)
  - Input: nested skill call with {a: 5, b: 3}
  - Output: {result: 8}
- **call_skill_map executes skill for each item**: PASS
  - Input: array [1,2,3] with skill "double"
  - Output: [2,4,6]
- **call_skill chain**: PASS
  - Input: chain of two call_skill steps
  - Output: result passed between steps

### decay.test.js (4 tests)
- **applyDecay reduces score for old skills**: PASS (60.5ms)
  - Input: skill with last_used_at 25 hours ago, score 0.8
  - Output: score reduced by ~0.04
- **applyDecay handles empty database**: PASS

### evaluator.test.js (6 tests)
- **correct skill gets high score**: PASS (11ms)
  - Input: correct math.add skill
  - Output: score 0.66, 12/13 passed
- **wrong skill gets low score**: PASS
  - Input: skill with subtract instead of add
  - Output: score 0.14, 2/13 passed

### executor.test.js (55 tests)
- **runSkill executes basic logic**: PASS (8.3ms)
- **runSkill handles conditional logic**: PASS
- **runSkill executes mcp_call to json.parse**: PASS
  - Input: {tool: "json.parse", args: {text: '{"a":1}'}}
  - Output: {a: 1}
- **runSkill rejects disallowed tool**: PASS
- **runSkill executes if branching - true branch**: PASS
  - Input: condition true, then: {op: "set", to: "result", value: "yes"}
  - Output: {result: "yes"}
- **runSkill executes for loop**: PASS (4.2ms)
  - Input: collection [1,2,3], var "item", steps set result
  - Output: result = [1,2,3]
- **runSkill executes map**: PASS
  - Input: collection [1,2,3], steps multiply by 2
  - Output: [2,4,6]
- **runSkill executes filter**: PASS
  - Input: collection [1,2,3,4], condition > 2
  - Output: [3,4]
- **runSkill executes reduce**: PASS
  - Input: collection [1,2,3], initial 0, steps add
  - Output: 6

### executorDSL.test.js (30 tests)
- **for loop iterates over array**: PASS (4.2ms)
- **for_range loops from start to end**: PASS
- **while loop executes until condition fails**: PASS
- **switch matches correct case**: PASS
- **comparison operators work**: PASS (eq, lt, gt, neq, lte, gte)
- **for loop prevents infinite iteration**: PASS (93ms)
- **while loop prevents infinite iteration**: PASS (42ms)

### executorSafety.test.js (10 tests)
- **runSkill throws on dangerous code with process**: PASS
  - Input: logic containing "process.exit()"
  - Output: Error thrown
- **runSkill throws on dangerous code with require**: PASS
- **runSkill timeout prevents infinite loops**: PASS (102ms)
  - Input: infinite while loop
  - Output: timeout after 100ms

### mcp.test.js (9 tests)
- **ALLOWED_TOOLS contains expected tools**: PASS
  - Output: ["http.get", "http.post", "json.parse"]
- **isToolAllowed returns true for allowed**: PASS
- **isToolAllowed returns false for disallowed**: PASS
- **json.parse tool parses valid JSON**: PASS
  - Input: {text: '{"key":"value"}'}
  - Output: {key: "value"}
- **callTool throws for disallowed tool**: PASS

### mutation.test.js (5 tests)
- **mutateSkill returns clone with same structure**: PASS
- **mutateSkill can change add to subtract**: PASS
- **mutateSkill does not mutate original**: PASS

### planner.test.js (13 tests)
- **Planner search finds solution**: PASS
- **Planner handles timeout**: PASS
- **Planner respects maxNodes limit**: PASS
- **createPlan returns planner result**: PASS

### pruning.test.js (4 tests)
- **pruneSkills respects minUsage protection**: PASS (48ms)
- **pruneSkills ensures capability safety**: PASS
- **getPruningStats shows score distribution**: PASS

### reasoner.test.js (19 tests)
- **Reasoner evaluate returns score**: PASS
- **Reasoner critique identifies issues**: PASS
- **Reasoner selectBest chooses highest**: PASS
- **createCritic returns review/suggest**: PASS

### scoring.test.js (5 tests)
- **evaluate returns 1.0 for valid**: PASS
- **scoreFromEvaluation extracts score**: PASS

### skillSearch.test.js (14 tests)
- **indexSkill adds to index**: PASS
- **searchByText finds relevant**: PASS
- **searchByCapability filters**: PASS

### skillService.test.js (7 tests)
- **handleRequest executes skill**: PASS (108ms)
- **handleRequest updates usage_count**: PASS
- **handleRequest updates failure_count**: PASS

### testBuilder.test.js (9 tests)
- **buildTestCases generates test cases**: PASS
- **buildEdgeCases includes null/undefined**: PASS

### testRunner.test.js (6 tests)
- **runTests returns correct count**: PASS (41ms)
- **runTests handles runtime errors**: PASS

### toolRegistry.test.js (10 tests)
- **createTool creates with defaults**: PASS
- **register adds tool**: PASS
- **getByCapability returns tools**: PASS

### validator.test.js (7 tests)
- **validate returns true for valid**: PASS (50ms)
- **validate returns false for missing field**: PASS

### vectorStore.test.js (9 tests)
- **generateEmbedding returns 128-dim vector**: PASS
- **cosineSimilarity returns 1 for identical**: PASS
- **VectorStore add and get**: PASS
- **VectorStore search returns top K**: PASS

### versioning.test.js (4 tests)
- **createVersion creates new version**: PASS (42ms)
- **createVersion generates unique id**: PASS
- **createVersion chains versions**: PASS