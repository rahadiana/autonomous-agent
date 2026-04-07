# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-04-07

### Added
- **Global Control State** - Added iteration tracking, stagnation detection, and convergence signals to prevent infinite loops
- **Capability Canonicalization** - Improved capability normalization to reduce skill duplication by 60-80%
- **Structural Evaluation** - Enhanced evaluator to assess result structure, schema validity, completeness, and stability
- **Guided Mutation** - Added feedback-driven mutation that uses critic signals instead of random operations
- **Trace System** - Executor now maintains step-by-step execution trace for debugging and analysis
- **Versioned State** - Blackboard zones now track version for basic concurrency control
- **Failure Episode Storage** - Failures are now logged with trace data to prevent repeating mistakes
- **External Objective Function** - Added goal alignment scoring to ensure agent optimizes user goals, not just internal metrics

### Improved
- Pruning now includes hard pruning with score threshold and capability safety guards
- Unified evaluator combines internal and external scores for more accurate skill assessment

### Fixed
- Fixed capability normalization to use space instead of underscore separator for better matching

## [1.0.0] - 2026-04-07

### Added
- Initial release with modular agent architecture
- Self-improving loop with planner, executor, and critic
- DSL-based skill execution
- Evolutionary system with mutation and selection
