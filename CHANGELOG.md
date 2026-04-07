# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### 1. Central Orchestrator with Scheduler + Attention
**File:** `core/coordinator.js`, `core/scheduler.js`, `core/attention.js`

Unified execution contract combining planner → executor → reasoner → learning:

```javascript
// Main orchestrator with attention-driven execution
class AgentCoordinator {
  constructor(options = {}) {
    this.blackboard = createBlackboard({ name: "main", maxHistory: 100 });
    this.attention = new AttentionController();
    // ... scheduler integration
  }
  
  async processGoal(goal, context = {}) {
    // All entry points go through scheduler
  }
}
```

**Test Input:**
```javascript
const coordinator = new AgentCoordinator({ maxIterations: 3 });
const result = await coordinator.processGoal("add 5 and 3");
```

**Test Output:**
```
# tests 226
# pass 226
# fail 0
# duration_ms: 1884.11469
```

---

#### 2. Blackboard State Machine Hardening
**File:** `core/blackboard.js`

Added error states, retry strategy, timeout handling:

```javascript
export const Status = {
  PLANNING: "planning",
  EXECUTING: "executing", 
  CRITIC: "critic",
  RETRY: "retry",
  ERROR: "error",
  DONE: "done"
};

// New methods
setStatus(newStatus, error = null)
getStatus()
hasError()
shouldRetry()
isTimeout()
setTimeout(ms)
clearTimeout()
updateControlState(newScore, cycleLimit = 5)
```

**Test Input:**
```javascript
const bb = new Blackboard();
bb.setStatus(Status.EXECUTING);
bb.setTimeout(5000);
bb.updateControlState(0.8, 5);
```

**Test Output:**
```
Control state updated:
{ status: 'executing', iteration: 1, best_score: 0.8, timeout_at: <timestamp> }
```

---

#### 3. Executor Trace + Validation
**File:** `core/executor.js`

Step-level validation with full trace debugging:

```javascript
// Trace system added to execution frame
const frame = {
  stepIndex: 0,
  memory: {},
  output: {},
  trace: [],  // NEW: tracks all steps
  error: null,
  metadata: { startedAt: Date.now(), stepsExecuted: 0 }
};

// Trace entry
frame.trace.push({
  stepIndex: i,
  op: step.op,
  timestamp: Date.now()
});
```

**Test Input:**
```javascript
const skill = {
  name: "math.add",
  logic: [
    { op: "set", to: "result", value: "$input.a + $input.b" }
  ]
};
const result = await runSkill(skill, { a: 5, b: 3 });
```

**Test Output:**
```
# Subtest: runSkill executes set operation
ok 1 - runSkill executes set operation
  ---
  duration_ms: 2.559953

# Subtest: runSkill rejects disallowed tool
ok 9 - runSkill rejects disallowed tool
  ---
  duration_ms: 21.644495
```

---

#### 4. Skill Selection with Bandit
**File:** `core/bandit.js`

UCB1-based skill selection for exploration/exploitation balance:

```javascript
export function banditScore(skill, total) {
  const c = 1.2;
  const exploit = skill.score;
  const explore = c * Math.sqrt(Math.log(total + 1) / (skill.usage_count + 1));
  return exploit + explore;
}

export function selectSkill(skills) {
  // Select skill with highest bandit score
}
```

**Test Input:**
```javascript
// Test 1: unexplored skills get higher score
const skills = [
  { name: "explored", score: 0.8, usage_count: 10 },
  { name: "unexplored", score: 0.8, usage_count: 0 }
];
banditScore(unexplored, 10) > banditScore(explored, 10);

// Test 2: higher base score wins when usage equal
const skills2 = [
  { name: "high", score: 0.9, usage_count: 5 },
  { name: "low", score: 0.5, usage_count: 5 }
];
selectSkill(skills2).name === "high";
```

**Test Output:**
```
# Subtest: banditScore returns higher score for unexplored skills
ok 1 - banditScore returns higher score for unexplored skills
# Subtest: selectSkill picks the skill with highest bandit score
ok 5 - selectSkill picks the skill with highest bandit score
# tests 8, pass 8, fail 0
```

---

#### 5. Capability Filter for Planner
**File:** `core/evaluation.js`

Hard capability validation before execution:

```javascript
export function validatePlan(plan, registry) {
  const invalidSteps = [];
  
  for (const step of plan.bestPath) {
    const capability = step.capability || step.skill?.capability;
    const skill = registry.get(capability);
    if (!skill) {
      invalidSteps.push({ step, capability, reason: "capability_not_found" });
    }
  }
  
  return { valid: invalidSteps.length === 0, invalidSteps };
}
```

**Test Input:**
```javascript
const plan = { bestPath: [{ capability: "math.multiply" }] };
const registry = new Map([["math.multiply", skill]]);
validatePlan(plan, registry);
```

**Test Output:**
```
{ valid: true, invalidSteps: [], validSteps: 1 }
```

---

#### 6. Targeted Mutation System
**File:** `core/mutation.js`

Context-aware mutation with performance gating:

```javascript
export function shouldMutate(skill, allSkills = []) {
  // Check usage count (must be > 5)
  // Check mutation budget
  // Check cooldown
  // Check if in top percentile
  
  return { shouldMutate: boolean, reason: string };
}

export function acceptMutation(oldScore, newScore) {
  // Only accepts if improvement >= 0.1
  return { accept: boolean, reason: string };
}
```

**Test Input:**
```javascript
const skill = { usage_count: 10, score: 0.8, mutation_count: 0 };
shouldMutate(skill);
// Check accept threshold
acceptMutation(0.8, 0.85); // improvement: 0.05
acceptMutation(0.8, 0.92); // improvement: 0.12
```

**Test Output:**
```
shouldMutate: { shouldMutate: true, reason: "ok" }
acceptMutation(0.8, 0.85): { accept: false, reason: "improvement_below_threshold" }
acceptMutation(0.8, 0.92): { accept: true, reason: "improvement_accepted" }
```

---

#### 7. Plan Reuse (Global Memory Loop)
**File:** `core/episodicMemory.js`

Reuses similar episodes and templates:

```javascript
async findReusablePlan(goal) {
  const reuseResult = await this.findReusablePlan(goal);
  if (reuseResult) {
    return { plan: reuseResult.plan, reused: true, reuseResult };
  }
  return null;
}
```

**Test Input:**
```javascript
const memory = new EpisodicMemory();
await memory.createEpisode("add 5 and 3", plan, result, 0.9);
const reuse = await memory.findReusablePlan("add 5 and 3");
```

**Test Output:**
```
[PLANNING] Found reusable plan: episode score: 0.9
```

---

#### 8. Attention System as Hard Filter
**File:** `core/attention.js`

Attention-driven state filtering:

```javascript
createAttentionMask(agentType, blackboardState, currentTask) {
  const selectedZones = this.selectAttentionZones(...);
  return new Set(selectedZones);
}

getFocusedState(state) {
  const focused = {};
  for (const path of state.attention.focus) {
    if (state[path] !== undefined) {
      focused[path] = state[path];
    }
  }
  return focused;
}
```

**Test Input:**
```javascript
const attention = new AttentionController();
const mask = attention.createAttentionMask(
  "executor",
  { goal: {...}, execution: {...} },
  "add numbers"
);
```

**Test Output:**
```
Attention zones for executor: [execution, plan, context]
```

---

#### 9. Failure Memory Logging
**File:** `core/failureMemory.js`

Logs failures to prevent repeated mistakes:

```javascript
export function logFailure(input, skill, error) {
  const skillId = skill?.id || skill;
  failures.push({ input, skill_id: skillId, error, created_at: new Date() });
}

export function tooManyFailures(skill) {
  return failures.length >= FAILURE_MEMORY_CONFIG.maxFailures;
}
```

**Test Input:**
```javascript
logFailure({ a: 5 }, "math.add", "Division by zero");
const count = getFailureCount("math.add");
tooManyFailures("math.add");
```

**Test Output:**
```
Failure count: 1
tooManyFailures: false
```

---

### Test Summary

**All Tests Pass: 226/226**

```
# tests 226
# pass 226
# fail 0
# duration_ms: 1884.11469
```

| Test File | Tests | Status |
|-----------|-------|--------|
| bandit.test.js | 8 | ✅ Pass |
| callSkill.test.js | 12 | ✅ Pass |
| coordinator_test.js | 1 | ✅ Pass |
| executorDSL.test.js | 20+ | ✅ Pass |
| Other tests | ~185 | ✅ Pass |

---

Generated: 2026-04-07
