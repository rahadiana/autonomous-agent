# CHANGELOG

## Test Results - All 226 tests PASSED

### New Features Implemented

#### 1. Unified Learning Loop (core/learningLoop.js)
Input: `{ input, availableSkills[] }`
Output: `{ output, trace, skillUsed, valid }`
- Combines: vector search, bandit selection, DSL execution, validation, reinforcement, exploration

#### 2. Planner Feedback Loop (core/plannerFeedback.js)
Input: `{ goal, input, executionFn }`
Output: `{ plan, result, critique, feedback }`
- Integrates planner with critic for feedback-driven improvement
- Tracks execution history for learning

#### 3. Control Scheduler (core/scheduler.js)
Input: `{ blackboard, maxCycles, cycleDelay }`
Output: `{ cycles, status, converged }`
- Global control loop for blackboard-based orchestration
- Agent selection based on status priorities

#### 4. Tournament Selection (core/bandit.js)
Input: `{ skills[], tournamentSize }`
Output: Best skill from tournament
- Random sample of skills compete
- Returns highest-scoring from sample
- Avoids global max stagnation

#### 5. Failure-Driven Mutation (core/mutation.js)
Input: `{ skill, feedback }`
Output: Mutated skill clone
- Guided by critic feedback
- Targeted mutations based on issues

### Test Results Summary

#### bandit.test.js
```
Input: skills with score and usage_count
Output: banditScore calculation with exploration bonus

Test Cases:
- banditScore: unexplored skill gets higher score
- banditScore: higher base score when usage equal
- banditScore: exploration decreases as usage increases
- banditScore: balances exploit vs explore
- selectSkill: picks skill with highest bandit score
- selectSkill: prefers unexplored skills when scores equal
- selectSkill: returns null for empty array
- selectSkill: returns only skill in array
- selectBestSkill: tournament selection works
```

#### callSkill.test.js
```
Input: { skill_name, input }
Output: { result, _meta }

Test Cases:
- call_skill: executes nested skill
- call_skill: passes input correctly
- call_skill: throws when skill not found
- call_skill_map: executes skill for each item
```

#### executor.test.js
```
Input: DSL skill with logic steps
Output: { result, _meta, trace }

Test Cases:
- runSkill: executes basic logic
- runSkill: handles string operations
- runSkill: handles conditional logic
- runSkill: handles array operations
- runSkill: executes set/get/add/subtract/multiply/divide/concat
- runSkill: executes mcp_call
- runSkill: rejects disallowed tool
- runSkill: executes if branching
```

#### mutation.test.js
```
Input: skill to mutate
Output: mutated skill clone

Test Cases:
- mutateSkill: returns clone with same structure
- mutateSkill: can change add to subtract
- mutateSkill: handles empty logic array
- mutateSkillWithFeedback: guided mutation works
- mutateFromFailure: failure-driven mutation
```

#### scheduler.test.js
```
Input: blackboard with control state
Output: { cycles, status, converged }

Test Cases:
- ControlScheduler: runs cycles
- ControlScheduler: selects agent by priority
- ControlScheduler: stops on done status
- ControlScheduler: handles timeout
```

#### planner.test.js
```
Input: goal, initial state, available skills
Output: plan with bestPath

Test Cases:
- Planner: search finds solution
- Planner: handles timeout
- Planner: respects maxNodes limit
- Planner: sorts by score
```

### Summary
- Total Tests: 226
- Pass: 226
- Fail: 0
- Duration: ~1842ms

### Architecture Status
All 10 critical improvements from next_plan.md addressed:
1. ✅ Unified Learning Loop - implemented in core/learningLoop.js
2. ✅ DSL Executor with trace + validation - implemented in core/executor.js
3. ✅ Bandit Selection - implemented in core/bandit.js
4. ✅ Failure-Driven Mutation - implemented in core/mutation.js
5. ✅ Planner Feedback Loop - implemented in core/plannerFeedback.js
6. ✅ Control Scheduler - implemented in core/scheduler.js (ControlScheduler)
7. ✅ Tournament Selection - implemented in core/bandit.js (selectBestSkill)
8. ✅ Safe MCP Call - timeout wrapper in executor.js
9. ✅ Step Validation - validateStep in executor.js
10. ✅ Trace Logging - frame.trace in executor.js
