# Changelog

All notable changes to this autonomous agent system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-07

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