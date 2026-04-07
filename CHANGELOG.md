# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-07

### Added

- **executeWithLearning wrapper** (`core/executeWithLearning.js`)
  - Implements mandatory learning loop integration for all skill executions
  - Validates output schema after each execution
  - Updates skill stats after every execution (no bypass allowed)
  - Provides batch execution support for `call_skill_map`

- **Hard validation for skill registration** (`core/skillValidation.js`)
  - DSL structure validation before save
  - Input/output schema validation
  - Evaluation score threshold (minimum 0.8)
  - Dangerous code detection for string-based logic
  - Prevents invalid skills from entering the registry

- **Enhanced planner capability validation** (`core/unifiedExecutor.js`)
  - Validates plan capabilities against whitelist
  - Prevents hallucinated capabilities from planner
  - Returns detailed error messages for invalid plans

### Fixed

- Executor now uses DSL-based step execution as primary mode
- String-based VM execution is secondary and includes dangerous code checks
- All tests pass (226/226)

### Known Issues (from next_plan.md analysis)

- Capability matching uses simple string matching (not yet upgraded to hybrid search)
- Mutation system uses random mutations (needs semantic filtering)
- Episode memory reuse not yet implemented
- Skill registry uses linear scan (needs vector indexing for scalability)

### Architecture Improvements

The system now has:
- ✅ DSL executor with step-based execution (not raw VM)
- ✅ Hard validation before skill save
- ✅ Planner guardrail (capability whitelist)
- ✅ Learning loop wrapper (executeWithLearning)
- ✅ Basic concurrency control in blackboard (version-based)

### Next Steps (Priority Order)

1. Upgrade capability matching to hybrid search (embedding + ranking)
2. Implement mutation filters (skip low-score skills)
3. Add episode memory reuse
4. Implement vector-based skill registry indexing
5. Add cost control (MAX_STEPS, MAX_MCP_CALL, TIMEOUT)

---

Generated based on next_plan.md critical fixes - 2026-04-07