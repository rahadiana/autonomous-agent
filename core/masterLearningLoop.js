/**
 * Master Learning Loop - Core Orchestration
 * 
 * Ini adalah closed-loop learning system yang menyatukan semua komponen:
 * - Planner (LLM + memory + bandit)
 * - Executor (DSL + MCP + code)
 * - Evaluator (REAL scoring)
 * - Learning (skill stats + mutation + versioning + memory)
 * - Selection (bandit)
 * 
 * Setiap cycle: goal → plan → execute → evaluate → learn → memory → repeat
 */

import { IntegratedPlanner } from "./integratedPlanner.js";
import { UnifiedExecutor } from "./unifiedExecutor.js";
import { UnifiedEvaluator } from "./unifiedEvaluator.js";
import { LearningPhase } from "./learningPhase.js";
import { PlanSelector } from "./planSelector.js";
import { EpisodicMemory } from "./episodicMemory.js";
import { SkillRegistry } from "./skillRegistry.js";
import { createBlackboard } from "./blackboard.js";

/**
 * Konfigurasi utama master loop
 */
export const MASTER_LOOP_CONFIG = {
  maxCycles: 5,                    // Max iterations per goal
  maxMutations: 3,                 // Max skill mutations
  maxPlans: 4,                     // Max plan candidates
  successThreshold: 0.8,           // Score untuk dianggap sukses
  doneThreshold: 0.9,              // Score untuk stop loop
  failThreshold: 0.3,              // Score di bawah ini = gagal total
  failLimit: 3,                    // Max consecutive failures sebelum fallback
  explorationRate: 0.2,            // Probability explore vs exploit
  useMemory: true,                 // Enable episodic memory
  useMutation: true,              // Enable skill mutation
  useVersioning: true,            // Enable skill versioning
  enableParallelExecution: false  // Enable parallel plan execution
};

/**
 * State untuk tracking progress
 */
export class LoopState {
  constructor(input) {
    this.input = input;
    this.goal = input.goal || input;
    this.context = input.context || {};
    this.cycles = 0;
    this.consecutiveFailures = 0;
    this.lastScore = 0;
    this.executionHistory = [];
    this.episodes = [];
    this.finalResult = null;
    this.isDone = false;
    this.isFailed = false;
  }

  updateScore(score) {
    this.lastScore = score;
    if (score < MASTER_LOOP_CONFIG.failThreshold) {
      this.consecutiveFailures++;
    } else {
      this.consecutiveFailures = 0;
    }
  }

  shouldContinue() {
    if (this.isDone) return false;
    if (this.isFailed) return false;
    if (this.cycles >= MASTER_LOOP_CONFIG.maxCycles) return false;
    if (this.consecutiveFailures >= MASTER_LOOP_CONFIG.failLimit) return false;
    return true;
  }
}

/**
 * Master Learning Loop - Core System
 * 
 * @param {Object} input - { goal, context, capabilities }
 * @param {Object} options - Konfigurasi override
 * @returns {Object} - { result, score, episodes, history }
 */
export async function masterLoop(input, options = {}) {
  const config = { ...MASTER_LOOP_CONFIG, ...options };
  
  console.log("[MASTER LOOP] Starting with goal:", input.goal);
  
  // Initialize state
  const state = new LoopState(input);
  
  // Initialize components
  const blackboard = createBlackboard({ name: "master_loop", maxHistory: 50 });
  const memory = new EpisodicMemory({
    reuseThreshold: { min: 0.5, max: 0.9, current: config.reuseThreshold || 0.7 }
  });
  const skillRegistry = new SkillRegistry();
  const planner = new IntegratedPlanner({ memory, skillRegistry, config });
  const executor = new UnifiedExecutor({ blackboard, config });
  const evaluator = new UnifiedEvaluator({ config });
  const planSelector = new PlanSelector({ config });
  const learning = new LearningPhase({ memory, config });

  // Load skills if provided
  if (input.skills) {
    for (const skill of input.skills) {
      skillRegistry.register(skill);
    }
  }

  // Main loop
  while (state.shouldContinue()) {
    state.cycles++;
    console.log(`[MASTER LOOP] Cycle ${state.cycles}/${config.maxCycles}`);

    try {
      // PHASE 1: Goal Selection
      const currentGoal = selectGoal(state, config);
      await blackboard.write("goal", currentGoal, "master_loop");

      // PHASE 2: Memory Retrieval
      let relevantEpisodes = [];
      if (config.useMemory && memory) {
        try {
          relevantEpisodes = await memory.findRelevantEpisodes(currentGoal, 5);
        } catch (e) {
          console.log("[MASTER LOOP] Memory retrieval error (non-fatal):", e.message);
          relevantEpisodes = [];
        }
        await blackboard.write("episodes", relevantEpisodes, "master_loop");
        console.log(`[MASTER LOOP] Found ${relevantEpisodes.length} relevant episodes`);
      }

      // PHASE 3: Planning
      const planningResult = await planner.generate({
        goal: currentGoal,
        context: state.context,
        episodes: relevantEpisodes,
        capabilities: skillRegistry.list()
      });

      if (!planningResult.plans || planningResult.plans.length === 0) {
        console.log("[MASTER LOOP] No plans generated");
        state.updateScore(0);
        continue;
      }

      await blackboard.write("plans", planningResult.plans, "master_loop");

      // PHASE 4: Plan Selection (Bandit)
      const selectedPlan = planSelector.select(planningResult.plans, state);
      console.log(`[MASTER LOOP] Selected plan:`, selectedPlan.id || 'generated');
      await blackboard.write("selectedPlan", selectedPlan, "master_loop");

      // PHASE 5: Execution
      const execContext = { 
        ...state.context, 
        goal: currentGoal,
        capability: selectedPlan.capability
      };
      let execResult;
      try {
        execResult = await executor.run(selectedPlan, currentGoal, execContext);
        console.log(`[MASTER LOOP] Execution result:`, execResult.success ? 'SUCCESS' : 'FAILURE', execResult);
      } catch (execError) {
        console.error("[MASTER LOOP] Execution error:", execError.message);
        execResult = { success: false, error: execError.message };
      }
      await blackboard.write("execution", execResult, "master_loop");

      // PHASE 6: Evaluation (REAL scoring)
      const evaluation = evaluator.evaluate({
        goal: currentGoal,
        plan: selectedPlan,
        result: execResult,
        context: state.context
      });

      console.log(`[MASTER LOOP] Evaluation score: ${evaluation.score.toFixed(3)}`);
      await blackboard.write("evaluation", evaluation, "master_loop");

      // Update state
      state.updateScore(evaluation.score);
      state.executionHistory.push({
        cycle: state.cycles,
        goal: currentGoal,
        plan: selectedPlan.id,
        result: execResult,
        evaluation
      });

      // Check done condition
      if (evaluation.score >= config.doneThreshold) {
        console.log(`[MASTER LOOP] Done! Score ${evaluation.score} >= threshold ${config.doneThreshold}`);
        state.isDone = true;
        state.finalResult = execResult;
        break;
      }

      // PHASE 7: Learning
      if (config.useMutation || config.useVersioning) {
        await learning.execute({
          plan: selectedPlan,
          result: execResult,
          evaluation,
          skillRegistry
        });
      }

      // PHASE 8: Memory Update
      if (config.useMemory && evaluation.score >= config.successThreshold) {
        await memory.createEpisode(currentGoal, selectedPlan, execResult);
        state.episodes.push({ goal: currentGoal, plan: selectedPlan, score: evaluation.score });
      }

      // Update context for next cycle
      state.context = {
        ...state.context,
        lastGoal: currentGoal,
        lastScore: evaluation.score,
        lastPlan: selectedPlan,
        suggestions: evaluation.suggestions || []
      };

    } catch (error) {
      console.error("[MASTER LOOP] Error in cycle:", error.message);
      state.consecutiveFailures++;
      
      if (state.consecutiveFailures >= config.failLimit) {
        state.isFailed = true;
        console.log("[MASTER LOOP] Failed - too many consecutive failures");
        break;
      }
    }
  }

  // Fallback if failed
  if (state.isFailed && state.executionHistory.length > 0) {
    const bestHistory = state.executionHistory.reduce((best, curr) => 
      curr.evaluation.score > best.evaluation.score ? curr : best
    );
    state.finalResult = bestHistory.result;
    console.log("[MASTER LOOP] Using fallback result from best history");
  }

  return {
    result: state.finalResult,
    score: state.lastScore,
    cycles: state.cycles,
    episodes: state.episodes,
    history: state.executionHistory,
    isDone: state.isDone,
    isFailed: state.isFailed
  };
}

/**
 * Goal Selection - bisa dari external atau generate
 */
function selectGoal(state, config) {
  if (state.context.externalGoal) {
    return state.context.externalGoal;
  }
  return state.goal;
}

/**
 * Execute multiple plans in parallel (optional)
 */
export async function executeParallel(plans, input, executor, evaluator) {
  const results = await Promise.all(
    plans.map(async (plan) => {
      const execResult = await executor.run(plan, input, {});
      const evaluation = evaluator.evaluate({
        goal: input,
        plan,
        result: execResult,
        context: {}
      });
      return { plan, execResult, evaluation };
    })
  );

  return results.sort((a, b) => b.evaluation.score - a.evaluation.score);
}

/**
 * Reset loop state
 */
export function resetLoopState() {
  return {
    cycles: 0,
    consecutiveFailures: 0,
    lastScore: 0,
    executionHistory: [],
    episodes: [],
    finalResult: null,
    isDone: false,
    isFailed: false
  };
}

export default masterLoop;