# Changelog

All notable changes to this autonomous agent system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.6.0] - 2026-04-06

### Summary
Implemented all critical missing components from the architectural diagnosis - closed learning loop, real evaluator, duplicate detection, capability normalization, and failure memory.

### Added

#### Learning Orchestrator (NEW)
- **`core/learningOrchestrator.js`** - Central learning loop
  - Phase 1: Goal/Input retrieval
  - Phase 2: Skill retrieval with bandit
  - Phase 3: Skill selection (UCB)
  - Phase 4: Execution (DSL)
  - Phase 5: Output validation
  - Phase 6: Real reward computation
  - Phase 7: Skill stats update
  - Phase 8: Exploration (15% probability)
  - Phase 9: Episodic memory save
  - Integrates: executor, validator, skillRegistry, bandit, testRunner, episodicMemory

#### Real Evaluator (NEW)
- **`core/unifiedEvaluator.js`** - Added `computeReward()` function
  - Schema validity: 30%
  - Output richness: 20%
  - Determinism check (usage > 3): 20%
  - Latency penalty (<100ms): 10%
  - Historical success rate: 20%
  - Bounded to [0, 1] range

#### Duplicate Detection (NEW)
- **`core/duplicateDetection.js`** - Prevents skill explosion
  - `isDuplicateSkill(newSkill, existingSkills)` - JSON logic comparison
  - `isDuplicateCapability(skill, existingSkills)` - Normalized capability comparison
  - `normalizeCapability(text)` - Helper for text normalization

#### Capability Normalization (NEW)
- **`core/capabilityNormalization.js`** - Standardizes skill capabilities
  - `normalizeCapability(text)` - lowercase, alphanumeric only, underscore format
  - `enforceCapabilityNormalization(skill)` - Applies normalization to skill

#### Failure Memory (NEW)
- **`core/failureMemory.js`** - Tracks failures for better learning
  - `logFailure(input, skill, error)` - Stores failure entries
  - `tooManyFailures(skill)` - Checks failure threshold (3)
  - `applyFailurePenalty(skill)` - 50% score penalty on too many failures
  - Storage: In-memory Map

### Architecture Changes

```
NOW (CLOSED LOOP):
  Goal → Retrieve → Select (Bandit) → Execute → Validate → 
  Compute Reward → Update Stats → Explore → Memory → Repeat
```

---

## [1.5.1] - 2026-04-07

### Summary
Production-grade DSL executor with proper safety, determinism, and extensibility.

### Added

#### Executor Rewrite (ENHANCED)
- **`core/executor.js`** - Complete rewrite with production features:

  **Execution Frame Model**
  ```javascript
  {
    stepIndex: 0,
    memory: {},      // Path-based storage
    output: {},
    trace: [],       // Execution trace
    error: null,
    metadata: { startedAt, stepsExecuted }
  }
  ```

  **Path-Based Memory**
  - `getPath(obj, "a.b.c")` - Get nested value
  - `setPath(obj, "a.b.c", value)` - Set nested value

  **$ Reference System**
  - `$memory.path` → memory reference
  - `$input.path` → input reference
  - Replaces legacy `input.X` and `memory.X`

  **Step Validator**
  - Whitelist of allowed operations
  - Blocks invalid/unsafe ops
  - Error on missing `op` field

  **Timeout + Retry**
  - Per-step timeout (default 100ms)
  - Retry on failure (default 2 retries)
  - Config: `EXECUTOR_CONFIG`

  **Trace System**
  - Records: stepIndex, op, timestamp
  - Available in `_meta.trace`

  **Output Schema Validation**
  - Validates against `skill.output_schema`
  - Required fields check
  - Type checking

  **Hard Limits**
  - Max steps: 20 (configurable)
  - Breaks on limit exceeded

### Configuration
```javascript
const EXECUTOR_CONFIG = {
  stepTimeoutMs: 100,
  maxSteps: 20,
  maxRetries: 2,
  retryDelayMs: 10,
  allowedOps: new Set([...])
}
```

### Features Tested
- Path-based memory: ✅ getPath/setPath work
- $ reference: ✅ $input.a, $memory.x resolve correctly
- Step validator: ✅ blocks invalid ops
- Multi-step execution: ✅ (5+3)*2 = 16 works
- Trace: ✅ records stepsExecuted=2

---

## [1.5.0] - 2026-04-07

### Summary
Implemented **closed-loop learning system** - unifying all components into a single adaptive learning architecture.

### Added

#### Master Learning Loop (NEW)
- **`core/masterLearningLoop.js`** - Core orchestration layer
  - Phase 1: Goal selection
  - Phase 2: Memory retrieval (episodic memory)
  - Phase 3: Planning with memory + bandit
  - Phase 4: Bandit-based plan selection
  - Phase 5: Execution (DSL/MCP/Code)
  - Phase 6: Real evaluation (ground truth based)
  - Phase 7: Learning (skill update, mutation, versioning)
  - Phase 8: Memory update
  - Config: maxCycles=5, successThreshold=0.8, failLimit=3

#### Learning Phase (NEW)
- **`core/learningPhase.js`** - Closed-loop learning mechanism
  - `updateSkillStatsWithFeedback()` - Updates skill usage, success count, confidence
  - `createSkillVersion()` - Creates new version on improvement
  - `attemptSkillMutation()` - Exploration with validation
  - `applySkillDecay()` - Time-based score decay
  - `pruneLowQualitySkills()` - Removes underperforming skills
  - Config: improvementThreshold=0.1, minUsageForMutation=3

#### Unified Evaluator (NEW)
- **`core/unifiedEvaluator.js`** - Real task-specific scoring
  - Ground truth based scoring (not dummy)
  - Task-specific score functions per capability
  - Multi-factor scoring: taskCorrectness(60%) + schemaValidity(15%) + robustness(15%) + efficiency(10%)
  - Test-case based evaluation (normal + edge + random cases)
  - Generates improvement suggestions

#### Integrated Planner (NEW)
- **`core/integratedPlanner.js`** - Memory-aware planning
  - `tryMemoryReuse()` - Reuses plans from episodic memory
  - `generateNewPlans()` - Generates plans with capability filtering
  - `enhanceWithContext()` - Adds relevant episode context to plans
  - `extractCapability()` - Detects capability from goal text

#### Plan Selector (NEW)
- **`core/planSelector.js`** - Bandit-based selection
  - UCB (Upper Confidence Bound) algorithm
  - Prevents local optimum trap
  - Config: explorationConstant=1.2, enableEpsilonGreedy=false
  - Supports diversity checking and parallel selection

#### Unified Executor (NEW)
- **`core/unifiedExecutor.js`** - Multi-mode execution
  - DSL execution (skill with logic)
  - MCP execution (external API calls)
  - Code execution (sandboxed - placeholder)
  - Output normalization to consistent format: `{ status, data, error, type }`

#### Skill Registry (NEW)
- **`core/skillRegistry.js`** - Skill management with bandit
  - `register()` / `unregister()` - Skill lifecycle
  - `updateStats()` - Updates score based on execution feedback
  - `selectWithBandit()` - UCB-based skill selection
  - Version tracking for each skill

### Fixed

#### Executor DSL Format
- **Changed** from `params: ["a", "b"]` to correct format:
  ```javascript
  { op: "add", a: "input.a", b: "input.b", to_output: "result" }
  ```

#### resolveValue Function
- **Fixed** to properly handle `input.X` and `memory.X` references
- Added null/undefined check at start

### Architecture Change

```
BEFORE (Fragmented):
  Planner → execute separately
  Executor → separate
  Evaluator → dummy scoring
  Learning → isolated
  Memory → not integrated

AFTER (Unified Closed-Loop):
  Goal → Plan → Execute → Evaluate → Learn → Memory → Repeat
```

### Testing
- Integration test: 6/6 passing
- Direct execution: add 5+3=8 ✅, multiply 4*6=24 ✅
- Evaluator: runs and produces scores
- Skill Registry: bandit selection works

---

## Architecture Analysis (2026-04-07)

### What's Already Implemented (✅)

| Component | Status | Notes |
|-----------|--------|-------|
| EpisodicMemory | ✅ | Episode stores: goal, plan, result, score, embedding |
| Plan Reuse | ✅ | `findReusablePlan()` - episode/template lookup by similarity |
| Template Abstraction | ✅ | generalizeGoal, injectVariables, TemplateStore |
| Ground Truth + Evaluator | ✅ | testRunner.js - skill-level evaluation |
| Cost Tracking | ✅ | production.js - RealCostTracker |

### Identified Gaps (❌)

| Issue | Status | Impact |
|-------|--------|--------|
| **Global objective function** | ✅ Fixed | Multi-level evaluation layer (step/plan/goal) |
| **Task-aware evaluation** | ✅ Fixed | TaskType + evaluateTask() for exact/numeric/partial |
| **Plan adaptation** | ✅ Fixed | adaptPlan() for reusing plans with new inputs |
| **Directed mutation** | ✅ Fixed | shouldMutate() gating + acceptMutation() threshold |
| **Cost-aware planning** | ⚠️ Partial | Latency tracking, cost scoring - belum terintegrasi penuh |
| **Blackboard versioning** | ⚠️ | Locking exists, no transaction/versioning |

### Flow Analysis

```
CURRENT (Skill-Level Only):
  goal → classify → plan → execute → reasoner.evaluate(skill)
                                                    ↓
                              SKILL evaluation (correctness, schema)

NEEDED (End-to-End):
  goal → classify → plan → execute → evaluateGoal(goal, result)
                                                    ↓
                              GLOBAL evaluation (success, cost, latency, correctness)
```

### Next Priority Implementation

1. **Add `evaluateGoal(goal, result)`** - Global end-to-end scoring
2. **Integrate cost/latency** into plan selection
3. **Directed mutation** - failure-based, not random
4. **Blackboard transaction** - versioning + rollback

---

## [1.4.0] - 2026-04-07

### Summary
Added context-aware skill selection with versioning and race condition prevention.

### Added

#### Context-Aware Selection (NEW)
- **`models/skill.js`** - Added context signature fields
  - `context_capability` - e.g., "array.filter"
  - `context_operation` - e.g., "filter", "map", "reduce"
  - `context_input_type` - e.g., "array", "object", "number"
  - `context_constraints` - JSON array of constraints
  - `version_lock` - For optimistic locking

- **`services/skillService.js`** - Context-aware selection
  - `calculateContextMatch()` - Multi-factor context matching
  - `extractContext()` - Extract context from capability/input
  - `selectWithContext()` - Combined similarity + score + context
  - Hard filter: minContextMatch >= 0.5
  - Weights: similarity(0.4) + score(0.3) + context(0.3)
  - Version locking functions for race condition prevention

### Changed
- Skill selection now uses 3-factor scoring
- Context matching is mandatory (hard filter)

### Context Weights
```javascript
capability: 0.4,    // Must match capability
operation: 0.3,    // Must match operation type  
inputType: 0.2,    // Input type should match
constraints: 0.1  // Constraint overlap bonus
```

---

## [1.3.0] - 2026-04-07

### Summary
Added task-aware test suite evaluation with thresholds and test case categorization.

### Added

#### Real Evaluation System (ENHANCED)
- **`core/evaluation.js`** - Extended with thresholds and test suite evaluation
  - `EVAL_THRESHOLDS` - Constants: REJECT (<0.6), ACCEPT (>=0.8), MIN_TESTS (3)
  - `TestCaseType` - VALID, EDGE, INVALID categories
  - `evaluateTestSuite()` - Runs full test suite with pass/fail decision
  - Returns: { score, passed, failed, total, decision, reason, details }

#### Test Case Categorization (NEW)
- **`core/groundTruth.js`** - Added type and taskType to each test case
  - `type`: "valid" | "edge" | "invalid"
  - `taskType`: "exact" | "numeric" | "partial" | "boolean"
  - All capabilities now have proper test case distribution

### Decision Logic
```javascript
if (score < 0.6)  → reject    // skill not good enough
if (score >= 0.8) → accept    // skill is good
else              → needs_refinement
```

---

## [1.2.0] - 2026-04-07

### Summary
Added task-aware evaluation, plan adaptation, and mutation control system.

### Added

#### Task-Aware Evaluation (NEW)
- **`core/evaluation.js`** - Extended with task types
  - `TaskType` enum: EXACT, NUMERIC, PARTIAL, BOOLEAN
  - `evaluateTask()` - Task-aware evaluation function
  - `numericEqual()` - Floating point comparison with tolerance
  - `partialSimilarity()` - Similarity for complex objects

#### Plan Adaptation (NEW)
- **`core/episodicMemory.js`** - Added adaptation functions
  - `adaptPlan()` - Adapts plan to new input by overriding parameters
  - `extractEpisodeContext()` - Extracts input/output schema for matching

#### Mutation Control (NEW)
- **`core/mutation.js`** - Complete rewrite with control system
  - `shouldMutate()` - Gating based on usage, budget, cooldown, percentile
  - `acceptMutation()` - Only accepts if improvement >= 0.1 threshold
  - `mutateWithControl()` - Full mutation with lineage tracking
  - Config: minUsageForMutation=5, improvementThreshold=0.1, maxMutationsPerSkill=3

### Changed
- Mutation now requires minimum 5 uses before allowed
- Only top 30% skills by score can be mutated
- New score must be at least 0.1 better than old to be accepted
- Rejects mutations that cause regression

---

## [1.1.0] - 2026-04-07

### Summary
Implemented multi-level evaluation layer with step/plan/goal evaluation + plan validation.

### Added

#### Evaluation Layer (NEW)
- **`core/evaluation.js`** - Multi-level evaluation system
  - `evaluateStep()` - Low-level step evaluation (correctness, latency, cost)
  - `evaluatePlan()` - Mid-level plan evaluation (success rate, failed steps)
  - `evaluateGoal()` - High-level end-to-end goal evaluation
  - `computeFinalScore()` - Combines goal + plan scores (70% goal, 30% plan)
  - `validatePlan()` - Validates plan capabilities against registry
  
- **Score composition:**
  ```javascript
  goalScore = correctness(60%) + latency(20%) + cost(10%) + efficiency(10%)
  finalScore = goalScore * 0.7 + planSuccessRate * 0.3
  ```

#### Executor Latency Tracking (NEW)
- **`core/executor.js`** - Added `_meta.latency` to all skill outputs
  - Measures execution time for each skill
  - Used by evaluation layer for latency penalty

#### Plan Validation (NEW)
- **`core/coordinator.js`** - Added `validatePlan()` check before execution
  - Validates all step capabilities exist in registry
  - Prevents planner hallucination
  - Added `getSkillRegistry()` method for capability lookup

### Changed
- **`core/coordinator.js`** - Integrated validation before execution
- Updated import to include evaluation.js

### Fixed
- Executor now returns latency metadata for scoring

---

## [1.0.0] - 2026-04-07

### Summary
Critical fixes to evaluator system and implementation of proper UCB bandit skill selection.

### Fixed (CRITICAL)
- **Evaluator was returning fake scores of 1.0** - Core bottleneck causing fake learning
  - Root cause: scoring.js always returned 1.0 regardless of actual skill correctness
  - Fixed by implementing proper ground truth comparison in testRunner.js

### Added

#### Core Evaluator System
- **`core/groundTruth.js`** - Ground truth test cases for math capabilities
  - Test cases for: math.add, math.multiply, math.subtract, math.divide
  - Includes normal cases, edge cases, adversarial cases (large numbers, floating point)
  - Error cases (null input, invalid type)

- **`core/testRunner.js`** - Enhanced skill evaluation
  - Schema validation (hard gate)
  - Functional correctness (exact match with floating point tolerance)
  - Consistency check (run 3x, output must be identical)
  - Soft penalty for low accuracy (< 0.5)
  - Returns detailed results: score, accuracy, stable, degraded, details[]

- **`core/scoring.js`** - Simplified scoring helper
  - Binary scoring (valid = 1.0, invalid = 0.0)
  - Backward compatibility wrapper

#### Pruning System
- **`core/pruning.js`** - Skill pruning with safety guardrails
  - Min usage protection (skip if usage < 5)
  - Score threshold (prune if score < 0.3 AND usage >= 5)
  - Capability safety (keep at least 1 skill per capability)
  - Soft delete (status = "inactive", not hard delete)
  - Auto-revival (revive best inactive if capability empty)

- **`models/skill.js`** - Added status field
  - New field: `status` (active, inactive, deprecated)
  - New field: `last_evaluated_at` (for re-eval cooldown)

#### Skill Selection & Evolution
- **`services/skillService.js`** - Enhanced skill handling
  - Re-evaluation trigger (every 5 uses)
  - Freshness decay (2% per day idle)
  - Score smoothing (70% old + 30% new)
  - Soft floor (push down, not clamp up)
  - Uncertainty-aware exploration (10% random from top 50%)
  - Confidence metric (usage/20 for final score blend)
  - Full monitoring metrics export
  
#### NEW: Additional Stabilization Fixes
- **Skill cooldown** - 5 minute cooldown for newly created skills
  - Prevents newly created skills from being overused immediately
  - Prevents "flash in the pan" effect
  
- **Normalized bandit scoring** - Score normalization for fair comparison
  - Maps scores to [0, 1] range before UCB calculation
  - Prevents bias from absolute score differences
  
- **Constrained mutation** (disabled but implemented)
  - mutationMinUsage: 5 (minimum uses before mutation allowed)
  - mutationTopPercent: 30 (only mutate top 30% skills)
  - Lineage safety: doesn't mutate bad or unproven skills

#### Configuration
- **All parameters centralized in CONFIG object:**
  ```javascript
  {
    reEvalInterval: 5,         // Re-evaluate every 5 uses
    decayRate: 0.02,           // 2% score decay per day
    mutationRate: 0.0,         // DISABLED
    
    // Selection strategy (NEW: UCB bandit)
    selectionStrategy: 'ucb',  // 'greedy' | 'ucb' | 'thompson'
    ucbConstant: 1.414,         // sqrt(2) - standard exploration constant
    
    scoreInertia: 0.7,          // 70% old, 30% new
    reEvalCooldown: 3600000,    // 1 hour between re-evals
    confidenceCap: 20,          // Full confidence at 20 uses
    confidenceWeight: 0.2,      // 20% confidence in score
    
    // Stabilization
    skillCooldown: 300000,      // 5 min cooldown for new skills
    mutationMinUsage: 5,       // Min uses before mutation
    mutationTopPercent: 30,     // Only mutate top 30%
    scoreNormalization: true    // Normalize scores for bandit
  }
  ```

### Changed

- **`core/executor.js`** - No changes, but now integrated with evaluator
- **`core/bandit.js`** - No longer imported in skillService (UCB implemented directly)
- **`services/skillService.js`** - Complete rewrite with UCB bandit selection
  - Replaced manual exploration/exploitation with proper UCB1 algorithm
  - Added Thompson Sampling as alternative
  - Log output shows UCB breakdown (exploitation vs exploration)
- **`models/skill.js`** - Added `status` and `last_evaluated_at` fields

### Removed

- Hard floor clamping (was: `Math.max(score, 0.2)`, now: soft push for low scores)
- Random exploration from ALL skills (now: from top 50% only)
- Unconstrained mutation (now: disabled)

### Fixed

- Floating point comparison (added tolerance: 1e-9)
- Score oscillation (now: 70% inertia prevents wild swings)
- Exploration picking bad skills (now: weighted by uncertainty)
- False positive detection (added confidence check)
- Floor effect detection (added monitoring for stuck skills)

---

## [0.x.x] - Earlier Versions

See git history for details on earlier iterations.

---

## System Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    skillService.js                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Selection Layer                                      │    │
│  │  - Confidence-aware scoring                         │    │
│  │  - Uncertainty-aware exploration (10%)             │    │
│  │  - Soft floor for low scores                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Evaluation Layer                                     │    │
│  │  - groundTruth.js: test cases                      │    │
│  │  - testRunner.js: evaluator (schema + correctness)│    │
│  │  - scoring.js: simple helper                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Evolution Layer                                     │    │
│  │  - pruning.js: natural selection                   │    │
│  │  - Mutation: DISABLED (not ready)                  │    │
│  │  - Re-evaluation: every 5 uses + 1hr cooldown     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing

All tests pass:
- Evaluator tests: 6/6
- Pruning tests: 4/4
- Scoring tests: 5/5

**Total: 15/15 tests passing**

---

## Next Steps (for future development)

1. Run system for 24-48 hours to collect metrics
2. Monitor:
   - Score distribution
   - Exploration success rate
   - False positive candidates
   - Floor effect count
3. If metrics healthy → consider enabling mutation
4. If stable → consider UCB bandit for smarter exploration

---

## Known Limitations

- Mutation is disabled (not stable enough)
- Domain is limited to math operations
- No persistence layer for ground truth test cases (hardcoded)
- No multi-capability testing yet (only math.*)

---

## Credits

System designed with guidance from system engineering principles for adaptive learning systems.