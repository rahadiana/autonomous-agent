# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### 1. Unified Orchestrator Loop
**File:** `core/coordinator.js`

Implementasi global loop yang menyatukan planner → executor → reasoner → learning:

```javascript
// Main loop structure
async processGoal(goal, context = {}) {
  while (shouldContinue && iteration < this.maxIterations) {
    // 1. Goal selection & planning
    planningResult = await this.executePlanning({...});
    
    // 2. Execution
    execResult = await this.executeAction({...});
    
    // 3. Critic/Evaluation
    reasonResult = await this.executeReasoning({...});
    
    // 4. Learning
    if (this.learningEnabled && reasonResult.evaluation?.score >= 0.6) {
      await this.learn(goal, planningResult.plan, execResult, score);
    }
    
    iteration++;
  }
}
```

**Test Output:**
```
# Subtest: /home/runner/work/autonomous-agent/autonomous-agent/test/coordinator_test.js
ok 1 - /home/runner/work/autonomous-agent/autonomous-agent/test/coordinator_test.js
  ---
  duration_ms: 184.095986
```

---

#### 2. Executor DSL + Safety (Timeout, Step Limit)
**File:** `core/executor.js`

Fitur keamanan:
- `stepTimeoutMs: 100` - timeout per step
- `maxSteps: 20` - batas maksimal step
- `maxRetries: 2` - retry attempt
- Whitelist operations (`allowedOps`)
- Dangerous code detection

```javascript
const EXECUTOR_CONFIG = {
  stepTimeoutMs: 100,
  maxSteps: 20,
  maxRetries: 2,
  dangerousKeywords: ["process", "require", "module", "exports"],
  allowedOps: new Set(["set", "get", "add", "subtract", "multiply", "divide",
    "concat", "mcp_call", "call_skill", "call_skill_map",
    "if", "switch", "for", "for_range", "while", "map", "filter", "reduce"])
};
```

**Test Output:**
```
# Subtest: runSkill executes set operation
ok 1 - runSkill executes set operation
  ---
  duration_ms: 2.559953
...
# Subtest: runSkill executes mcp_call to json.parse
ok 8 - runSkill executes mcp_call to json.parse
  ---
  duration_ms: 0.942103
...
# Subtest: runSkill rejects disallowed tool
ok 9 - runSkill rejects disallowed tool
  ---
  duration_ms: 21.644495
```

---

#### 3. Skill Selection (Bandit)
**File:** `core/bandit.js`

Implementasi UCB1 (Upper Confidence Bound) untuk selection pressure:

```javascript
export function banditScore(skill, total) {
  const c = 1.2;
  const exploit = skill.score;
  const explore = c * Math.sqrt(Math.log(total + 1) / (skill.usage_count + 1));
  return exploit + explore;
}

export function selectSkill(skills) {
  const total = skills.reduce((a, b) => a + b.usage_count, 0);
  // Select skill with highest bandit score
}
```

**Test Input/Output:**
```javascript
// Test 1: unexplored skills get higher score
const skills = [
  { name: "explored", score: 0.8, usage_count: 10 },
  { name: "unexplored", score: 0.8, usage_count: 0 }
];
// banditScore(unexplored) > banditScore(explored) ✓

// Test 2: higher base score wins when usage equal
const skills = [
  { name: "high", score: 0.9, usage_count: 5 },
  { name: "low", score: 0.5, usage_count: 5 }
];
// selectSkill returns "high" ✓
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

#### 4. Learning Loop (Feedback ke Planner)
**File:** `core/coordinator.js`

Closed-loop learning dengan feedback ke planner:

```javascript
async learn(goal, plan, result, score = 0.8) {
  // Create episode untuk reuse
  await this.episodicMemory.createEpisode(goal, plan.bestPath, result.results);
  
  // Extract template jika score >= 0.6
  if (score >= 0.6) {
    const template = await this.episodicMemory.templateStore.createTemplate(latestEpisode);
    console.log("[LEARN] Extracted template:", template.id);
  }
}

// Feedback ke planner jika score rendah
if (critique.score < 0.7) {
  await plannerLLM({ goal, feedback: critique.suggestions });
}
```

**Test Output:**
```
# [LEARN] Created episode for: test.do
# [LEARN] Extracted template: tpl_1775525052005_0x551wh pattern: test.do
```

---

#### 5. Blackboard Stabilization (Version, Lock)
**File:** `core/blackboard.js`

Implementasi:
- Version control per zone
- Lock mechanism dengan timeout
- Safe set dengan optimistic concurrency

```javascript
class Blackboard {
  async write(zoneName, data, writer) {
    const acquired = await this.acquireLock(zoneName, writer);
    if (!acquired) {
      throw new Error(`Failed to acquire lock on zone: ${zoneName}`);
    }
    // ... write with version increment
    zone.version++;
  }

  safeSet(zoneName, patch, expectedVersion, writer) {
    if (zone.version !== expectedVersion) {
      throw new Error(`State conflict: expected version ${expectedVersion}`);
    }
    return this.write(zoneName, patch, writer);
  }
}
```

---

### Test Summary

**All Tests Pass: 226/226**

```
# tests 226
# pass 226
# fail 0
# duration_ms: 1934.74587
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
