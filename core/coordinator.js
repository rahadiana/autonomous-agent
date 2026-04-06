import { createBlackboard } from "./blackboard.js";
import { AttentionController } from "./attention.js";
import { createPlan } from "./planner.js";
import { runSkill } from "./executor.js";
import { Reasoner } from "./reasoner.js";
import { EpisodicMemory } from "./episodicMemory.js";
import { AutonomousGoalGenerator, GoalValidator, BudgetController, ValueFunction } from "./goalAutonomy.js";
import { MetaReasoningLayer } from "./metaReasoning.js";
import { RealCostTracker, ExecutionBudgetController, WorkerPool, ObservabilityLayer } from "./production.js";
import { ResilienceLayer } from "./resilience.js";
import { OperationalLayer } from "./operational.js";

export function classifyGoalCapability(goal) {
  if (!goal || typeof goal !== "string") return null;
  const g = goal.toLowerCase();
  
  // Math.multiply patterns - CHECK FIRST (more specific)
  if (/multiply|multiplied|times|product|×|what.*(times|multiplied)/i.test(g)) {
    return "math.multiply";
  }
  // Math.add patterns
  if (/add|sum|plus|total|calculate.*(sum|total)|what.*plus/i.test(g)) {
    return "math.add";
  }
  // Math.subtract patterns
  if (/subtract|minus/i.test(g)) {
    return "math.subtract";
  }
  // Math.divide patterns
  if (/divide|divided/i.test(g)) {
    return "math.divide";
  }
  return null;
}

function validateCapabilityMatch(plan, expectedCapability) {
  if (!expectedCapability || !plan?.bestPath?.[0]) return true;
  const usedCapability = plan.bestPath[0].capability || plan.bestPath[0].skill?.capability;
  return usedCapability === expectedCapability;
}

function extractNumbersFromGoal(goal) {
  if (!goal || typeof goal !== "string") return {};
  const numbers = goal.match(/\d+/g);
  if (!numbers || numbers.length < 2) return {};
  return { a: parseFloat(numbers[0]), b: parseFloat(numbers[1]) };
}

export class AgentCoordinator {
  constructor(options = {}) {
    this.blackboard = createBlackboard({ name: "main", maxHistory: 100 });
    this.attention = new AttentionController();
    this.operational = new OperationalLayer({
      reliability: { retry: { maxRetries: 3, baseDelay: 100, exponential: true, jitter: true }, circuit: { failureThreshold: 5, successThreshold: 2, timeout: 30000 } },
      loadControl: { maxQueueSize: 100, maxConcurrent: 10, backpressureThreshold: 0.8, degradationThreshold: 0.9 },
      alerting: { failureRateThreshold: 0.2, latencyThreshold: 2000, errorRateThreshold: 0.1, queueSizeThreshold: 80 },
      degradation: { latencyThreshold: 1000, failureThreshold: 0.3, maxSuccessiveFailures: 5 }
    });
    this.resilience = new ResilienceLayer({
      enableExplainability: options.enableExplainability !== false, qualityWeight: 0.6, costWeight: 0.3, speedWeight: 0.1, smoothingFactor: 0.8, maxChange: 0.1, maxConsecutiveFailures: 3
    });
    this.skills = [];
    this.agents = new Map();
    this.executionHistory = [];
    this.maxIterations = options.maxIterations || 3;
    this.learningEnabled = options.learningEnabled !== false;
    this.autonomyEnabled = options.autonomyEnabled || false;
    this.reuseThreshold = options.reuseThreshold || 0.7;
    this.episodicMemory = new EpisodicMemory({ reuseThreshold: { min: 0.5, max: 0.9, current: this.reuseThreshold } });
    if (this.autonomyEnabled) {
      this.goalGenerator = new AutonomousGoalGenerator({
        validator: new GoalValidator({ minRelevance: 0.3 }),
        budget: new BudgetController({ maxGoalsPerCycle: 3, explorationBudget: 5 }),
        valueFn: new ValueFunction()
      });
    }
    if (this.learningEnabled) {
      this.metaReasoning = new MetaReasoningLayer({ smoothingFactor: 0.8, maxChange: 0.1 });
    }
    this.costTracker = new RealCostTracker();
    this.executionBudget = new ExecutionBudgetController({ maxLatency: options.maxLatency || 30000, maxApiCalls: options.maxApiCalls || 100, maxCost: options.maxCost || 10 });
    this.workerPool = new WorkerPool({ minWorkers: 1, maxWorkers: options.maxWorkers || 4 });
    this.observability = new ObservabilityLayer({ enableTracing: true, enableAuditLog: true });
  }

  registerSkill(skill) {
    this.skills.push(skill);
  }

  registerAgent(name, agent, type, handler) {
    this.agents.set(name, { agent, type, handler });
  }

  async processGoal(goal, context = {}) {
    const spanId = this.observability.createSpan("processGoal");
    this.observability.addSpanEvent(spanId, `Starting goal: ${goal}`);
    this.observability.recordAudit("goal_start", { goal, context });
    if (this.executionBudget.isExhausted()) {
      this.observability.addSpanEvent(spanId, "Budget exhausted - rejecting goal");
      return { success: false, error: "Execution budget exhausted" };
    }
    if (!this.executionBudget.reserveBudget(1)) {
      this.observability.addSpanEvent(spanId, "Insufficient budget");
      return { success: false, error: "Insufficient execution budget" };
    }
    const expectedCapability = classifyGoalCapability(goal);
    const executionBlackboard = createBlackboard({ name: `exec_${spanId}`, maxHistory: 10 });
    const goalStartTime = Date.now();
    await executionBlackboard.write("goal", { goal, context, startTime: goalStartTime }, "coordinator");
    await executionBlackboard.write("context", context, "coordinator");
    let iteration = 0, lastResult = null, shouldContinue = true, planningResult = null;
    while (shouldContinue && iteration < this.maxIterations) {
      iteration++;
      planningResult = await this.executePlanning({ goal: { goal, context, startTime: Date.now() }, context, skills: this.skills, iteration });
      await executionBlackboard.write("plan", planningResult, "planner");
      if (!planningResult.plan?.bestPath || planningResult.plan.bestPath.length === 0) {
        lastResult = { success: false, error: "No plan generated" };
        break;
      }
      if (expectedCapability && !validateCapabilityMatch(planningResult.plan, expectedCapability)) {
        console.log(`[Planning] Capability mismatch - rejecting template, expected: ${expectedCapability}`);
        planningResult = await this.executePlanning({ goal: { goal, context, startTime: Date.now() }, context, skills: this.skills, iteration, forceSearch: true });
        if (!planningResult.plan?.bestPath || !validateCapabilityMatch(planningResult.plan, expectedCapability)) {
          lastResult = { success: false, error: "No matching capability found" };
          break;
        }
      }
      const execResult = await this.executeAction({ plan: planningResult.plan, skills: this.skills, blackboard: executionBlackboard, goal });
      await executionBlackboard.write("result", execResult, "executor");
      const reasonResult = await this.executeReasoning({ plan: planningResult.plan, result: execResult, context, history: this.executionHistory });
      lastResult = { plan: planningResult.plan, execution: execResult, evaluation: reasonResult.evaluation, reused: planningResult.reused };
      this.executionHistory.push({ iteration, goal, ...lastResult });
      const executionSuccess = execResult.success && reasonResult.evaluation?.score >= 0.6;
      if (planningResult.reused) {
        await this.episodicMemory.recordReuseResult(planningResult.reuseResult, executionSuccess);
      }
      if (!executionSuccess && this.metaReasoning) {
        this.metaReasoning.recordFailure({ goalType: goal.toString().split(" ")[0], failureType: execResult.success ? "low_score" : "execution_failure", suggestions: reasonResult.evaluation?.suggestions || [] });
      }
      if (this.learningEnabled && reasonResult.evaluation?.score >= 0.6) {
        await this.learn(goal, planningResult.plan, execResult, reasonResult.evaluation.score);
      }
      if (reasonResult.evaluation?.score >= 0.8) {
        shouldContinue = false;
      } else if (reasonResult.evaluation?.suggestions?.length > 0) {
        const newContext = { ...context, suggestions: reasonResult.evaluation.suggestions };
        await this.blackboard.write("context", newContext, "coordinator");
      }
    }
    if (this.autonomyEnabled && lastResult?.evaluation?.score >= 0.7) {
      await this.generateAutonomousGoals(context);
    }
    if (this.metaReasoning && this.executionHistory.length % 3 === 0) {
      const state = this.getState();
      const improvement = this.metaReasoning.analyzeAndImprove(state);
      if (improvement.recommendations.length > 0) {
        console.log("[Meta] Recommendations:", improvement.recommendations.join(", "));
      }
    }
    const goalDuration = Date.now() - goalStartTime;
    this.costTracker.recordGoal(goal, goalDuration);
    this.executionBudget.recordLatency(goalDuration);
    this.executionBudget.commitCost(1);
    this.observability.endSpan(spanId, { success: lastResult?.execution?.success, score: lastResult?.evaluation?.score, duration: goalDuration });
    this.observability.recordAudit("goal_complete", { goal, success: lastResult?.execution?.success, duration: goalDuration });
    if (planningResult) {
      this.resilience.logDecision("goal_execution", { reasons: { reused: planningResult.reused, score: lastResult?.evaluation?.score, success: lastResult?.execution?.success }, context: { goal, iteration } });
    }
    return lastResult;
  }

  async learn(goal, plan, result, score = 0.8) {
    try {
      await this.episodicMemory.createEpisode(goal, plan.bestPath, result.results);
      console.log("[LEARN] Created episode for:", goal);
      
      // Get latest episode from the Map - use passed score instead of recalculating
      const episodes = Array.from(this.episodicMemory.episodes.values());
      const latestEpisode = episodes[episodes.length - 1];
      
      // Override the calculated score with the evaluation score which is accurate
      if (latestEpisode && score >= 0.6) {
        latestEpisode.score = score;
        const template = await this.episodicMemory.templateStore.createTemplate(latestEpisode);
        console.log("[LEARN] Extracted template:", template.id, "pattern:", template.pattern);
      } else {
        console.log("[LEARN] No template - evaluation score too low:", score);
      }
    } catch (e) {
      console.error("[LEARN] Error:", e.message, e.stack);
    }
  }

  async executePlanning(payload) {
    const { goal, context, skills, iteration, forceSearch } = payload;
    const goalStr = goal?.goal || goal;
    const expectedCapability = classifyGoalCapability(goalStr);
    
    if (!forceSearch) {
      const reuseResult = await this.episodicMemory.findReusablePlan(goalStr);
      
      if (reuseResult) {
        console.log("[PLANNING] Found reusable plan:", reuseResult.type, "score:", reuseResult.finalScore || reuseResult.weight);
        // Debug: check actual plan structure
        console.log("[PLANNING] Plan structure:", JSON.stringify(reuseResult.plan).slice(0, 200));
        const reuseCapability = reuseResult.plan?.bestPath?.[0]?.capability;
        console.log("[PLANNING] Reuse capability check:", { reuseCapability, expectedCapability, hasBestPath: !!reuseResult.plan?.bestPath, bestPathLength: reuseResult.plan?.bestPath?.length });
        if (expectedCapability && reuseCapability !== expectedCapability) {
          console.log("[Planning] Rejected reuse - capability mismatch:", reuseCapability, "expected", expectedCapability);
        } else {
          const decisionId = this.resilience.logDecision("planning_reuse", { reasons: { similarity: reuseResult.similarity, weight: reuseResult.weight, type: reuseResult.type }, context: { goal: goalStr, iteration } });

          if (reuseResult.type === "template") {
            console.log(`[Planning] Reused template ${reuseResult.template?.id} (sim: ${reuseResult.similarity?.toFixed(2)})`);
          } else {
            console.log(`[Planning] Reused from episode ${reuseResult.episode?.id} (sim: ${reuseResult.similarity?.toFixed(2)})`);
          }
          
          const reasoner = new Reasoner();
          const evaluation = reasoner.evaluate(reuseResult.plan, context);
          evaluation.reused = true;
          evaluation.reuseType = reuseResult.type;
          if (reuseResult.episode) evaluation.episodeId = reuseResult.episode.id;
          else if (reuseResult.template) evaluation.templateId = reuseResult.template.id;
          return { plan: reuseResult.plan, evaluation, reused: true, reuseResult, decisionId };
        }
      }
    }
    
    console.log("[Planning] Running tree search for:", goalStr);
    const startState = { goal: goalStr, steps: 0, iteration };
    const result = createPlan(goalStr, startState, skills, { maxDepth: 5, maxNodes: 100, expectedCapability });
    const reasoner = new Reasoner();
    const evaluation = reasoner.evaluate(result, context);
    return { plan: result, evaluation, reused: false };
  }

  async executeAction(payload) {
    const { plan, skills, blackboard, goal } = payload;
    if (!plan?.bestPath || plan.bestPath.length === 0) return { success: false, error: "No plan" };
    const results = [];
    // Use passed goal or extract from blackboard
    const goalText = goal || ((blackboard || this.blackboard).getZoneData("goal") || {}).goal || "";
    const extractedNumbers = extractNumbersFromGoal(goalText);
    for (const action of plan.bestPath) {
      const skill = skills.find(s => s.capability === action.capability);
      if (!skill) { results.push({ capability: action.capability, success: false, error: "Not found" }); continue; }
      const contextData = (blackboard || this.blackboard).getZoneData("context") || {};
      const input = { ...contextData, ...extractedNumbers };
      try {
        const isolatedResult = await this.resilience.isolation.executeInIsolation(async () => await runSkill(skill, input), { skill: skill.name, action: action.capability }, { timeout: 10000 });
        results.push({ capability: action.capability, success: true, result: isolatedResult });
      } catch (error) {
        results.push({ capability: action.capability, success: false, error: error.message });
      }
    }
    const allSuccess = results.every(r => r.success);
    return { success: allSuccess, results };
  }

  async executeReasoning(payload) {
    const { plan, result, context, history } = payload;
    const reasoner = new Reasoner();
    const evaluation = reasoner.evaluate(plan, context);
    const critique = reasoner.critique(plan, history);
    const reflection = reasoner.reflect(plan, result);
    return { evaluation, critique, reflection };
  }

  async getRelevantEpisodes(goal, limit = 5) {
    return this.episodicMemory.findRelevantEpisodes(goal, limit);
  }

  async generateAutonomousGoals(context) {
    if (!this.goalGenerator.canGenerate()) return [];
    const goals = await this.goalGenerator.generate(context);
    for (const autonomousGoal of goals) {
      const result = await this.processGoal(autonomousGoal.goal, context);
    }
    return goals;
  }

  getMemoryStats() {
    return this.episodicMemory.getStats();
  }

  getState() {
    return {
      blackboard: this.blackboard.getState(),
      memory: this.getMemoryStats(),
      autonomy: this.autonomyEnabled ? this.goalGenerator.getStats() : null,
      meta: this.metaReasoning ? this.metaReasoning.getStatus() : null,
      production: { cost: this.costTracker.getMetrics(), budget: this.executionBudget.getUsage(), workers: this.workerPool.getStats(), observability: this.observability.getStats() },
      resilience: this.resilience.getStatus(),
      operational: this.operational.getStatus(),
      history: this.executionHistory
    };
  }

  getState() {
    return {
      blackboard: this.blackboard.getState(),
      memory: this.getMemoryStats(),
      autonomy: this.autonomyEnabled ? this.goalGenerator.getStats() : null,
      meta: this.metaReasoning ? this.metaReasoning.getStatus() : null,
      production: { cost: this.costTracker.getMetrics(), budget: this.executionBudget.getUsage(), workers: this.workerPool.getStats(), observability: this.observability.getStats() },
      resilience: this.resilience.getStatus(),
      operational: this.operational.getStatus(),
      history: this.executionHistory
    };
  }

  reset() {
    this.blackboard.reset();
    this.executionHistory = [];
    this.episodicMemory.clear();
    if (this.goalGenerator) this.goalGenerator.reset();
    if (this.metaReasoning) this.metaReasoning.reset();
    this.costTracker.reset();
    this.executionBudget.reset();
    this.observability.reset();
  }
}

export function createAgentCoordinator(options = {}) {
  return new AgentCoordinator(options);
}
