# CHANGELOG

## Test Results - All 226 tests PASSED

### Bandit Selection Tests (test/bandit.test.js)
```
Input: skills with score and usage_count
Output: banditScore calculation with exploration bonus for unexplored skills

Test Cases:
- banditScore: unexplored skill gets higher score (score: 0.9, usage: 10 vs score: 0.7, usage: 1)
- banditScore: higher base score when usage equal
- banditScore: exploration decreases as usage increases
- selectSkill: picks skill with highest bandit score
- selectSkill: prefers unexplored skills when scores equal
- selectSkill: returns null for empty array
- selectSkill: returns only skill in array
```

### Call Skill Tests (test/callSkill.test.js)
```
Input: { skill_name, input }
Output: { result, _meta }

Test Cases:
- call_skill: executes nested skill
- call_skill: passes input correctly
- call_skill: throws when skill not found
- call_skill: uses memory reference for skill name
- call_skill_map: executes skill for each item in array
- call_skill_map: with empty array
- call_skill chain: output of one becomes input of another
- call_skill validates output schema
- SkillRunner can register and list skills
```

### Decay Tests (test/decay.test.js)
```
Input: skills with last_used_at timestamps
Output: score reduced based on age

Test Cases:
- applyDecay: reduces score for old skills (59.26ms)
- applyDecay: does not affect skills without last_used_at (19.74ms)
- applyDecay: applies stronger decay for older skills (33.59ms)
- applyDecay: handles empty database (13.40ms)
```

### Evaluator Tests (test/evaluator.test.js)
```
Input: skill with test cases
Output: { score, accuracy, passed, total, details }

Test Cases:
- correct skill: score 0.66, accuracy 0.92, passed 12/13
- wrong skill: score 0.14, accuracy 0.15, passed 2/13
- skill with syntax error: score 0.19, accuracy 0.15, passed 2/13

Example Input:
{ "a": 5, "b": 3 }

Correct Output:
{ "result": 8 }

Wrong Output:
{ "result": 2 }
```

### Executor DSL Tests (test/executorDSL.test.js)
```
Input: DSL skill with logic steps
Output: { result, _meta, trace }

Test Cases:
- runSkill: executes basic logic and returns output
- runSkill: handles string operations
- runSkill: handles conditional logic
- runSkill: handles array operations
- runSkill: handles memory object
- runSkill: throws on invalid JS syntax
- runSkill: throws on undefined variable access
- runSkill: handles nested object output
- runSkill: executes set/get/add/subtract/multiply/divide/concat operations
- runSkill: executes mcp_call to json.parse
- runSkill: rejects disallowed tool
- runSkill: resolves memory reference in mcp_call args
- runSkill: executes if branching (true/false branch)
- runSkill: uses memory value in condition
- runSkill: handles nested path in set
- runSkill: throws on unknown operation
```

### Executor DSL Advanced Tests (test/executorDSLAdvanced.test.js)
```
Input: DSL skill with advanced logic
Output: { result, trace }

Test Cases:
- for loop: iterates over array, processes each item, tracks index
- for_range: loops from start to end, supports custom step size
- while loop: executes until condition fails
- switch: matches correct case, falls through to default
- map: transforms array
- filter: removes items by condition
- reduce: accumulates values
- comparison operators: eq, lt, gt, neq, lte, gte, in, typeof
- nested if-else: works correctly
- complex pipeline: filter then map
- infinite loop protection: MAX_LOOP prevents endless iteration
```

### Executor Safety Tests (test/executorSafety.test.js)
```
Input: skill with dangerous code
Output: Error thrown

Test Cases:
- runSkill: throws on dangerous code with process
- runSkill: throws on dangerous code with require
- runSkill: throws on dangerous code with module
- runSkill: executes normal logic
- runSkill: timeout prevents infinite loops (101.48ms)
- ALLOWED_TOOLS: contains expected tools
- isToolAllowed: returns true for allowed tools
- isToolAllowed: returns false for disallowed tools
```

### Tool Tests (test/toolRegistry.test.js)
```
Input: tool registration data
Output: tool execution results

Test Cases:
- json.parse: parses valid JSON
- json.parse: returns error for invalid JSON
- json.stringify: converts object to string
- callTool: throws for disallowed tool
- callTool: throws for non-existent tool
- callTool: works for allowed tool
```

### Mutation Tests (test/mutation.test.js)
```
Input: skill to mutate
Output: mutated skill clone

Test Cases:
- mutateSkill: returns clone with same structure
- mutateSkill: can change add to subtract
- mutateSkill: handles empty logic array
- mutateSkill: handles string logic (passthrough)
- mutateSkill: does not mutate original
```

### Planner Tests (test/planner.test.js)
```
Input: goal, initial state, available skills
Output: plan with bestPath

Test Cases:
- PlanNode: constructor initializes correctly
- PlanNode: getPath returns action path
- PlanNode: getDepth returns correct depth
- Planner: search finds solution for simple goal (0.95ms)
- Planner: handles timeout (1.97ms)
- Planner: respects maxNodes limit (0.29ms)
- Planner: sorts by score (11.38ms)
- decomposeGoal: handles string goal, object goal with steps
- evaluatePlan: returns score for valid plan
- createPlan: returns planner result
- Planner: countNodes counts all nodes
- Planner: visualize returns string
```

### Pruning Tests (test/pruning.test.js)
```
Input: skill database
Output: { pruned, protected, revived, errors, success }

Test Cases:
- pruneSkills: respects minUsage protection (55.22ms)
- pruneSkills: ensures capability safety (55.66ms)
- getPruningStats: shows score distribution (47.99ms)

Example:
- Protected: new-bad-skill (uses: 3)
- Soft-deleted: old-bad-skill (score: 0.20, uses: 10)
- Revived: math.subtract - only-subtract-skill (score: 0.25)
```

### Reasoner Tests (test/reasoner.test.js)
```
Input: plan, execution history
Output: { score, critique, suggestions }

Test Cases:
- Reasoner: evaluate returns score for valid plan (3.18ms)
- Reasoner: evaluate handles timeout status
- Reasoner: evaluate handles limit_exceeded status
- Reasoner: evaluate handles no_solution status
- Reasoner: evaluate handles invalid plan
- Reasoner: critique identifies issues
- Reasoner: critique identifies strengths for diverse actions
- Reasoner: critique handles long/short plans
- Reasoner: reflect on successful/failed execution
- Reasoner: selectBest chooses highest score
- createCritic: returns review and suggest functions
```

### Scoring Tests (test/scoring.test.js)
```
Input: evaluation result
Output: numerical score

Test Cases:
- evaluate: returns 1.0 for valid result
- evaluate: returns 0.0 for invalid result
- scoreFromEvaluation: extracts score from eval result
- scoreFromEvaluation: handles null
- scoreFromEvaluation: handles missing score
```

### Skill Search Tests (test/skillSearch.test.js)
```
Input: skill data, search query
Output: search results

Test Cases:
- SkillSearch: indexSkill adds skill to index (3.56ms)
- SkillSearch: searchByText finds relevant skills (0.91ms)
- SkillSearch: searchByText respects topK
- SkillSearch: searchByText respects threshold
- SkillSearch: searchByCapability filters by capability (2.15ms)
- SkillSearch: findSimilar returns similar skills
- SkillSearch: getSkill returns skill by id
- SkillSearch: hasSkill returns correct boolean
- SkillSearch: removeSkill removes from index
- SkillSearch: count returns total indexed skills
- SkillSearch: clear removes all skills
- SkillSearch: listAll returns all skills
- SkillSearch: with no matches returns empty array
- SkillSearch: handles duplicate id updates
```

### Skill Service Tests (test/skillService.test.js)
```
Input: request with skill name and input
Output: execution result

Test Cases:
- handleRequest: throws when no skill found (58.28ms)
- handleRequest: executes skill and returns result (84.21ms)
- handleRequest: updates usage_count after execution (39.40ms)
- handleRequest: updates failure_count on validation failure (23.12ms)
- handleRequest: updates last_used_at timestamp (32.77ms)
- handleRequest: selects via bandit when multiple skills exist (34.73ms)
- handleRequest: score updates with reinforcement formula (23.15ms)
```

### Test Builder Tests (test/testBuilder.test.js)
```
Input: schema for skill input/output
Output: array of test cases

Test Cases:
- buildTestCases: returns at least empty input test
- buildTestCases: generates number test cases
- buildTestCases: generates string test cases
- buildTestCases: generates boolean test cases
- buildEdgeCases: includes null and undefined
- buildEdgeCases: includes empty array and string
- buildRandomFuzz: generates specified count
- buildRandomFuzz: generates random values
- buildTestCases: handles no schema
```

### Test Runner Tests (test/testRunner.test.js)
```
Input: skill and test cases
Output: test results

Test Cases:
- runTests: returns correct passed count for valid skills (53.26ms)
- runTests: returns zero for invalid schema (2.17ms)
- runTests: handles runtime errors gracefully (2.03ms)
- runTests: handles empty test cases (1.87ms)
- runEvaluation: returns testScore and avgScore (3.01ms)
- runTests: records each test result (3.88ms)
```

### Tool Registry Tests (test/toolRegistry.test.js)
```
Input: tool definition
Output: registered tool

Test Cases:
- createTool: creates tool with defaults
- createTool: accepts custom capability
- ToolRegistry: register adds tool
- ToolRegistry: register throws on duplicate
- ToolRegistry: register throws on missing name/handler
- ToolRegistry: getByCapability returns tools
- ToolRegistry: unregister removes tool
- ToolRegistry: listByTag filters correctly
- ToolRegistry: search finds by name/description/capability
- ToolRegistry: clear removes all
```

### Validator Tests (test/validator.test.js)
```
Input: data and schema
Output: validation result

Test Cases:
- validate: returns true for valid data (48.86ms)
- validate: returns false for missing required field (1.25ms)
- validate: returns false for wrong type (2.55ms)
- validate: handles array schema (1.06ms)
- validate: handles nested object schema (1.88ms)
- validate: handles enum constraint (1.58ms)
- validate: handles minimum and maximum constraints (1.65ms)
```

### Vector Store Tests (test/vectorStore.test.js)
```
Input: vectors with metadata
Output: search results

Test Cases:
- generateEmbedding: returns 128-dim vector (2.21ms)
- generateEmbedding: normalizes vector (0.49ms)
- generateEmbedding: same text produces same embedding
- generateEmbedding: different texts produce different embeddings
- cosineSimilarity: returns 1 for identical vectors (0.30ms)
- cosineSimilarity: returns 0 for orthogonal vectors (0.20ms)
- cosineSimilarity: returns -1 for opposite vectors (0.34ms)
- cosineSimilarity: returns 0 for different length vectors (0.16ms)
- VectorStore: add and get (0.30ms)
- VectorStore: search returns top K results (0.48ms)
- VectorStore: search respects threshold (0.26ms)
- VectorStore: remove deletes entry (0.23ms)
- VectorStore: size returns correct count (0.22ms)
- VectorStore: clear removes all entries (0.22ms)
- VectorStore: throws on dimension mismatch (0.42ms)
- createSkillEmbedding: generates embedding from skill (0.30ms)
- createSkillEmbedding: same skill produces same embedding (1.02ms)
```

### Versioning Tests (test/versioning.test.js)
```
Input: skill with version history
Output: new version

Test Cases:
- createVersion: creates new skill with incremented version (36.10ms)
- createVersion: generates unique id for each version (16.75ms)
- createVersion: chains versions correctly (16.74ms)
- createVersion: sets created_at timestamp (12.07ms)
```

## Summary
- Total Tests: 226
- Pass: 226
- Fail: 0
- Duration: 2023.96ms

## Architecture Status
All 8 critical issues from next_plan.md have been addressed:
1. ✅ Central Orchestrator - implemented in core/orchestrator.js
2. ✅ Executor with trace + error safe - implemented in core/executor.js
3. ✅ Skill system with bandit selection - implemented in core/bandit.js
4. ✅ Controlled Mutation - implemented in core/mutation.js
5. ✅ Capability Validation Layer - implemented in core/capabilityNormalization.js
6. ✅ Immutable Patch System (Blackboard) - implemented in core/blackboard.js
7. ✅ Fallback Strategy - implemented in core/resilience.js
8. ✅ Code Generation Sandbox - implemented in core/executor.js with ALLOWED_TOOLS
