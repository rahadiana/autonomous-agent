import { createBlackboard, Status } from "./blackboard.js";
import { createPlan } from "./planner.js";
import { runSkill, executeSkill } from "./executor.js";
import { selectSkill, banditScore } from "./bandit.js";
import { shouldMutate, mutateSkill, acceptMutation, mutateFromFailure } from "./mutation.js";
import { createVersion } from "./versioning.js";
import { MetaReasoningLayer } from "./metaReasoning.js";

const globalConfig = {
  beam_width: 3,
  max_depth: 5,
  max_nodes: 500
};

export const CONFIG = {
  MAX_CYCLES: 10,
  MAX_PLANS: 3,
  MAX_STEPS: 5,
  ACCEPT_SCORE: 0.85,
  MUTATION_RATE: 0.2,
  DECAY_RATE: 0.05,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 100,
  PLANNER_GATE_THRESHOLD: 0.6,
  MUTATION_USAGE_THRESHOLD: 5,
  MUTATION_SUCCESS_THRESHOLD: 0.7
};

function freshness(skill) {
  if (!skill.last_used_at) return 1.0;
  const age = Date.now() - skill.last_used_at;
  const maxAge = 24 * 60 * 60 * 1000;
  return Math.max(0, 1 - age / maxAge);
}

function finalSkillScore(skill, similarity, totalSelections) {
  const bandit = banditScore(skill, totalSelections);
  const freshnessScore = freshness(skill);
  return (
    similarity * 0.5 +
    bandit * 0.3 +
    freshnessScore * 0.2
  );
}

export function applyAttentionToSkills(skills, attention) {
  if (!attention || !attention.weights) return skills;
  return skills.map(s => {
    const weight = attention.weights[s.capability] || 1;
    return {
      ...s,
      adjustedScore: s.score * weight
    };
  });
}

export async function selectBestSkill(skills, goal) {
  if (!skills || skills.length === 0) return null;
  
  const similarityMap = {};
  for (const s of skills) {
    similarityMap[s.id] = s.capability?.includes(goal.toString().split(" ")[0]) ? 0.8 : 0.3;
  }
  
  const total = skills.reduce((s, x) => s + x.usage_count, 0);

  return skills
    .map(s => ({
      skill: s,
      score: finalSkillScore(
        s,
        similarityMap[s.id] || 0,
        total
      )
    }))
    .sort((a, b) => b.score - a.score)[0]?.skill;
}

export function compilePlanToSkill(plan) {
  if (!plan || !plan.bestPath) return null;
  
  return {
    name: "compiled_plan",
    capability: "dynamic",
    logic: plan.bestPath.map(s => ({
      op: "call_skill",
      capability: s.capability,
      input: s.input || {}
    }))
  };
}

export function maybePlan(input, skills) {
  if (!skills || skills.length === 0) {
    return { shouldPlan: true, reason: "no_skills" };
  }

  const best = skills[0];
  
  if (!best || best.score < CONFIG.PLANNER_GATE_THRESHOLD) {
    return { shouldPlan: true, reason: "low_score", currentScore: best?.score || 0 };
  }

  return { shouldPlan: false, reason: "skill_available", bestSkill: best };
}

export async function getBestSkillVersion(capability) {
  return { capability, score: CONFIG.ACCEPT_SCORE };
}

async function processGoals(bb) {
  const goals = bb.getZoneData("goals");
  if (!goals || goals.length === 0) return null;
  
  const goal = goals[0];
  bb.write("currentGoal", goal, "goal_manager");
  return goal.description;
}

export async function plannerStep(bb, skills) {
  const state = bb.getControlState();
  const goal = bb.getZoneData("goal");

  applyStrategy(bb);

  const plans = createPlan(goal, { steps: 0 }, skills, {
    maxDepth: globalConfig.max_depth,
    maxCost: CONFIG.ACCEPT_SCORE,
    maxNodes: globalConfig.max_nodes
  });

  bb.write("plan", plans, "planner");
  bb.setStatus(Status.EXECUTING);

  return plans;
}

export async function executorStep(bb, selectedSkill) {
  const state = bb.getControlState();
  const plan = bb.getZoneData("plan");

  try {
    const compiledSkill = compilePlanToSkill(plan) || selectedSkill;
    const input = bb.getZoneData("context") || {};
    const result = await executeSkill(compiledSkill, input);

    bb.write("execution", { result }, "executor");

    const world = bb.getZoneData("world") || {};
    Object.assign(world, { lastResult: result, timestamp: Date.now(), lastAction: compiledSkill.capability });
    bb.write("world", world, "executor");

    const belief = bb.getZoneData("belief") || {};
    const success = !result?.error;
    if (success) {
      belief.lastSuccess = result;
      belief.successCount = (belief.successCount || 0) + 1;
    } else {
      belief.lastFailure = result.error;
      belief.failureCount = (belief.failureCount || 0) + 1;
    }
    belief.lastUpdate = Date.now();
    bb.write("belief", belief, "executor");

    // FIX: Update skill stats directly after execution for learning integration
    if (selectedSkill) {
      await updateSkillAfterExecution(selectedSkill, result);
    }

    bb.setStatus(Status.CRITIC);

    return result;
  } catch (err) {
    bb.write("execution", { error: err.message }, "executor");

    const belief = bb.getZoneData("belief") || {};
    belief.lastFailure = err.message;
    belief.lastUpdate = Date.now();
    bb.write("belief", belief, "executor");

    // Update skill stats on failure
    if (selectedSkill) {
      await updateSkillAfterExecution(selectedSkill, { error: err.message });
    }

    bb.setStatus(Status.PLANNING, "execution_failed");

    return { error: err.message };
  }
}

// FIX: Direct integration of DSL executor with learning system
async function updateSkillAfterExecution(skill, result) {
  if (!skill || !skill.id) return;
  
  const success = !result?.error;
  const validation = result?._meta?.valid ?? success;
  
  // Get skill from DB or update in-memory
  const { Skill } = await import("../models/skill.js");
  const dbSkill = await Skill.findByPk(skill.id);
  
  if (dbSkill) {
    const usage = (dbSkill.usage_count || 0) + 1;
    const successCount = (dbSkill.success_count || 0) + (success ? 1 : 0);
    const failCount = (dbSkill.failure_count || 0) + (success ? 0 : 1);
    const successRate = successCount / usage;
    
    // Reinforcement learning formula
    const newScore = dbSkill.score * 0.7 + successRate * 0.3;
    
    await dbSkill.update({
      usage_count: usage,
      success_count: successCount,
      failure_count: failCount,
      score: Math.max(0, Math.min(1, newScore)),
      last_used_at: new Date()
    });
    
    console.log(`[LEARNING] Skill ${skill.name}: score ${dbSkill.score.toFixed(3)}, success rate ${(successRate * 100).toFixed(1)}%`);
  }
}

export async function criticStep(bb, result) {
  const execution = bb.getZoneData("execution");
  const score = execution?.result?.error ? 0 : (execution?.result?._meta?.score || 0.7);

  bb.write("result", { score, result: execution?.result }, "critic");

  if (score >= CONFIG.ACCEPT_SCORE) {
    bb.setStatus(Status.DONE);
  } else {
    bb.setStatus(Status.PLANNING);
  }

  return { score };
}

function shouldMutateTargeted(skill) {
  return (
    skill.usage_count > CONFIG.MUTATION_USAGE_THRESHOLD &&
    (skill.success_count || skill.usage_count) / skill.usage_count < CONFIG.MUTATION_SUCCESS_THRESHOLD
  );
}

export async function learningStep(bb, selectedSkill) {
  const execution = bb.getZoneData("execution");
  const result = bb.getZoneData("result");
  const history = bb.getZoneData("history") || [];

  if (!execution?.result || !selectedSkill) return;

  const success = result?.score > CONFIG.MUTATION_SUCCESS_THRESHOLD;

  if (selectedSkill) {
    selectedSkill.usage_count = (selectedSkill.usage_count || 0) + 1;
    selectedSkill.last_used_at = Date.now();
    if (success) {
      selectedSkill.score = Math.min(1, (selectedSkill.score || 0) + 0.1);
      selectedSkill.success_count = (selectedSkill.success_count || 0) + 1;
    } else {
      selectedSkill.score = Math.max(0, (selectedSkill.score || 0) - 0.05);
      selectedSkill.failure_count = (selectedSkill.failure_count || 0) + 1;
    }

    // FIX: Self-modifying system safety guard
    // 1. Forbidden targets - never allow modification of executor
    const FORBIDDEN_TARGETS = ["executor", "core", "runtime"];
    
    if (shouldMutateTargeted(selectedSkill)) {
      const mutated = mutateSkill(selectedSkill);
      
      // Safety check: Validate mutation doesn't target forbidden systems
      const isSafe = validateMutationSafety(mutated, FORBIDDEN_TARGETS);
      
      if (!isSafe.safe) {
        console.log(`[MUTATION] Rejected: ${isSafe.reason}`);
        return;
      }
      
      if (validateDSL(mutated)) {
        const score = await testSkill(mutated);
        const preScore = selectedSkill.score;
        
        // 2. Rollback auto: Revert if score decreased
        if (score > preScore + 0.05) {
          const newVersion = createVersion(selectedSkill);
          Object.assign(newVersion, mutated);
          newVersion.parent_id = selectedSkill.id;
          
          // Store for potential rollback
          bb.write("pending_versions", [{ skill: newVersion, parentId: selectedSkill.id, preScore }], "learning");
          
          return newVersion;
        } else {
          console.log(`[MUTATION] Rejected: no improvement (pre=${preScore.toFixed(2)}, post=${score.toFixed(2)})`);
        }
      }
    }
  }

  if (history.length > 10) {
    const recentHistory = history.slice(-10);
    const failureCount = recentHistory.filter(h => h.success === false).length;
    const baselineScore = 0.5;
    
    if (failureCount > 5) {
      const skills = bb.getZoneData("skills") || [];
      for (const skill of skills) {
        if (skill.usage_count > 5 && skill.score < baselineScore) {
          const mutated = mutateSkill(skill);
          
          // Safety check
          const isSafe = validateMutationSafety(mutated, FORBIDDEN_TARGETS);
          if (!isSafe.safe) continue;
          
          if (validateDSL(mutated)) {
            const score = await testSkill(mutated);
            const preScore = skill.score;
            
            if (score > baselineScore + 0.05) {
              const newVersion = createVersion(skill);
              Object.assign(newVersion, mutated);
              newVersion.parent_id = skill.id;
              
              const updatedSkills = skills.map(s => 
                s.id === skill.id ? newVersion : s
              );
              bb.write("skills", updatedSkills, "learning");
              break;
            }
          }
        }
      }
    }
  }
}

// FIX: Validate mutation safety
function validateMutationSafety(skill, forbiddenTargets) {
  if (!skill) return { safe: false, reason: "null_skill" };
  
  // Check capability for forbidden patterns
  const capability = skill.capability || "";
  for (const target of forbiddenTargets) {
    if (capability.toLowerCase().includes(target.toLowerCase())) {
      return { safe: false, reason: `forbidden_target: ${target}` };
    }
  }
  
  // Check logic for dangerous operations
  if (skill.logic && Array.isArray(skill.logic)) {
    for (const step of skill.logic) {
      if (step.op === "mcp_call") {
        const tool = step.tool || "";
        if (tool.includes("process") || tool.includes("eval") || tool.includes("exec")) {
          return { safe: false, reason: "dangerous_tool" };
        }
      }
    }
  }
  
  return { safe: true, reason: "ok" };
}

function validateDSL(skill) {
  if (!skill.logic || !Array.isArray(skill.logic)) return false;
  
  const logicLength = skill.logic.length;
  
  for (let i = 0; i < logicLength; i++) {
    const step = skill.logic[i];
    if (!step.op || typeof step.op !== "string") return false;
    
    if (step.op === "if") {
      if (step.true_jump !== undefined && step.true_jump >= logicLength) return false;
      if (step.false_jump !== undefined && step.false_jump >= logicLength) return false;
    }
    
    if (step.op === "jump") {
      if (step.to !== undefined && step.to >= logicLength) return false;
    }
  }
  
  return true;
}

async function testSkill(skill) {
  try {
    const result = await runSkill(skill, { test: true });
    return result?._meta?.score || 0.5;
  } catch {
    return 0;
  }
}

async function decay(bb) {
  const skills = bb.getZoneData("skills");
  if (!skills) return;
  
  for (const skill of skills) {
    if (skill.last_used_at) {
      const age = Date.now() - skill.last_used_at;
      const decayAmount = (age / (24 * 60 * 60 * 1000)) * CONFIG.DECAY_RATE;
      skill.score = Math.max(0, (skill.score || 0) - decayAmount);
    }
  }
}

async function prune(bb) {
  const skills = bb.getZoneData("skills");
  if (!skills) return;
  
  const pruned = skills.filter(s => s.score > 0.1 || s.usage_count > 3);
  bb.write("skills", pruned, "learning");
}

function shouldExplore(bb) {
  const random = Math.random();
  return random < 0.1;
}

async function explore(bb, selectedSkill) {
  const skills = bb.getZoneData("skills");
  const newCapability = "explore_" + Date.now();
  const newSkill = {
    id: "explore_" + Date.now(),
    capability: newCapability,
    score: 0.5,
    usage_count: 0,
    last_used_at: null,
    logic: [{ op: "get", path: "result", value: {} }]
  };
  
  bb.write("skills", [...(skills || []), newSkill], "exploration");
}

function extractCapability(input) {
  if (typeof input === "string") {
    return input.split(" ")[0].toLowerCase();
  }
  if (input.goal) {
    return input.goal.toString().split(" ")[0].toLowerCase();
  }
  return "unknown";
}

export async function retrieveSkills(capability, allSkills) {
  if (!allSkills || allSkills.length === 0) return [];
  
  return allSkills.filter(s => 
    s.capability?.toLowerCase().includes(capability) ||
    s.capability?.toLowerCase() === capability
  );
}

export async function agentLoop(input, allSkills = []) {
  const capability = extractCapability(input);

  const candidates = await retrieveSkills(capability, allSkills);

  const selected = selectSkillWithBandit(candidates);

  const result = await execute(selected, input);

  const valid = validate(selected?.output_schema, result);

  await updateSkillStats(selected, valid);

  if (shouldExplore()) {
    await explore(selected);
  }

  await decay();
  await prune();

  return result;
}

function selectSkillWithBandit(candidates) {
  if (!candidates || candidates.length === 0) return null;
  return selectSkill(candidates);
}

async function execute(skill, input) {
  if (!skill) {
    return { error: "no_skill", _meta: { score: 0 } };
  }
  return executeSkill(skill, input);
}

function validate(output_schema, result) {
  if (!output_schema) return true;
  return result && !result.error;
}

async function updateSkillStats(skill, valid) {
  if (!skill) return;
  
  skill.usage_count = (skill.usage_count || 0) + 1;
  skill.last_used_at = Date.now();
  
  if (valid) {
    skill.score = Math.min(1, Math.max(0, (skill.score || 0) + 0.1));
    skill.success_count = (skill.success_count || 0) + 1;
  } else {
    skill.score = Math.max(0, Math.min(1, (skill.score || 0) - 0.05));
  }
}

export async function main(input) {
  const goalInput = await processGoals(input) || input;

  const skills = input.skills || [];
  
  const capability = extractCapability(goalInput);
  const retrievedSkills = await retrieveSkills(capability, skills);

  const weighted = applyAttentionToSkills(retrievedSkills, input.attention);

  const selected = selectSkillWithBandit(weighted);

  const result = await executeSkill(selected, goalInput);

  await updateSkillStats(selected, !result.error);

  await maybeMutate(selected);

  return result;
}

async function maybeMutate(skill) {
  if (!skill) return;
  
  const mutationCheck = shouldMutate(skill);
  if (mutationCheck.shouldMutate) {
    const mutated = mutateSkill(skill);
    
    if (validateDSL(mutated)) {
      const score = await testSkill(mutated);
      const accept = acceptMutation(skill.score, score);
      
      if (accept.accept) {
        const newVersion = createVersion(skill);
        Object.assign(newVersion, mutated);
        newVersion.parent_id = skill.id;
        return newVersion;
      }
    }
  }
}

export async function runAgent(input, skills = []) {
  const bb = createBlackboard({ name: "agent" });

  bb.write("goal", input.goal || input, "agent");
  bb.write("context", input.context || {}, "agent");
  bb.write("skills", skills, "agent");
  bb.write("world", {}, "agent");
  bb.write("belief", {}, "agent");
  bb.write("history", [], "agent");

  try {
    for (let step = 0; step < CONFIG.MAX_CYCLES; step++) {
      const control = bb.getControlState();
      
      if (control.iteration >= CONFIG.MAX_CYCLES) {
        bb.setStatus(Status.ERROR, "max_cycle_reached");
        break;
      }

      await goalManager(bb);

      const status = bb.getStatus();
      
      if (status === Status.PLANNING) {
        await plannerStep(bb, skills);
      }

      if (status === Status.EXECUTING) {
        const currentSkills = bb.getZoneData("skills");
        const selected = await selectBestSkill(currentSkills, input.goal);
        await executorStep(bb, selected);
      }

      if (status === Status.CRITIC) {
        const execution = bb.getZoneData("execution");
        await criticStep(bb, execution?.result);
      }

      const currentSkills = bb.getZoneData("skills");
      const selected = await selectBestSkill(currentSkills, input.goal);
      await learningStep(bb, selected);

      if (bb.getStatus() === Status.DONE) break;

      control.iteration++;
      bb.updateControlState(0);
    }
  } catch (err) {
    console.error("[AGENT ERROR]", err.message);
    bb.setStatus(Status.ERROR, err.message);
    return { error: err.message };
  }

  return bb.getZoneData("result");
}

function computeCuriosity(bb) {
  const history = bb.getZoneData("history") || [];
  const lastGoals = history.slice(-5);
  if (lastGoals.length === 0) return 1.5;
  
  const recentSimilarity = lastGoals.reduce((sum, g1, i) => {
    if (i === 0) return 0;
    const g0 = lastGoals[i - 1];
    const similarity = stringSimilarity(g0.goal || "", g1.goal || "");
    return sum + (1 - similarity);
  }, 0);
  
  return Math.max(0, 2 - recentSimilarity);
}

function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  const aWords = a.toLowerCase().split(/\s+/);
  const bWords = b.toLowerCase().split(/\s+/);
  const intersection = aWords.filter(w => bWords.includes(w));
  return intersection.length / Math.max(aWords.length, bWords.length);
}

function generateGoal(bb) {
  const goals = [
    { goal: "add numbers", relevance: 0.8, novelty: 0.6, cost: 0.3 },
    { goal: "multiply values", relevance: 0.8, novelty: 0.5, cost: 0.3 },
    { goal: "calculate sum", relevance: 0.7, novelty: 0.7, cost: 0.3 },
    { goal: "fetch data", relevance: 0.6, novelty: 0.8, cost: 0.4 },
    { goal: "list items", relevance: 0.7, novelty: 0.6, cost: 0.3 }
  ];
  return goals[Math.floor(Math.random() * goals.length)];
}

function addGoals(bb, newGoals) {
  const currentGoals = bb.getZoneData("goals") || [];
  bb.write("goals", [...currentGoals, ...newGoals], "curiosity");
}

function selectNextGoal(bb) {
  const goals = bb.getZoneData("goals");
  if (!goals || goals.length === 0) return null;
  return goals[0];
}

function updateWorld(bb, result) {
  const world = bb.getZoneData("world") || {};
  Object.assign(world, { lastResult: result, timestamp: Date.now() });
  bb.write("world", world, "autonomy");
}

function updateBelief(bb, result) {
  const belief = bb.getZoneData("belief") || {};
  if (result?.error) {
    belief.lastFailure = result.error;
  } else {
    belief.lastSuccess = result;
  }
  belief.lastUpdate = Date.now();
  bb.write("belief", belief, "autonomy");
}

export async function autonomousLoop(bb) {
  const MAX_GOALS = 20;
  
  while (true) {
    const curiosity = computeCuriosity(bb);
    
    // FIX: Goal system explosion guard
    // 1. Limit max goals
    const currentGoals = bb.getZoneData("goals") || [];
    if (currentGoals.length >= MAX_GOALS) {
      console.log(`[GOAL] Max goals (${MAX_GOALS}) reached, skipping generation`);
    } else if (curiosity > 2) {
      const newGoals = generateGoal(bb);
      if (newGoals) {
        // 2. Dedup: Check if goal already exists
        const isDuplicate = currentGoals.some(g => g.goal === newGoals.goal);
        if (!isDuplicate) {
          addGoals(bb, [newGoals]);
        } else {
          console.log(`[GOAL] Duplicate goal skipped: ${newGoals.goal}`);
        }
      }
    }

    const goal = selectNextGoal(bb);
    if (!goal) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    bb.write("goal", goal, "autonomy");
    bb.setStatus(Status.PLANNING);

    await runAgent({ goal: goal.goal }, bb.getZoneData("skills") || []);

    if (bb.getStatus() === Status.DONE) {
      const execution = bb.getZoneData("execution");
      if (execution?.result) {
        updateWorld(bb, execution.result);
        updateBelief(bb, execution.result);
      }
    }

    const goals = bb.getZoneData("goals") || [];
    if (goals.length > 0 && goals[0].goal === goal.goal) {
      goals.shift();
      bb.write("goals", goals, "autonomy");
    }

    await new Promise(r => setTimeout(r, 5000));
  }
}

async function goalManager(bb) {
  const goal = bb.getZoneData("goal");
  if (!goal) {
    bb.setStatus(Status.ERROR, "no_goal");
  }
}

const metaReasoning = new MetaReasoningLayer();

function applyStrategy(bb) {
  const stats = {
    history: bb.getZoneData("history") || [],
    autonomy: { budget: bb.getZoneData("goals") ? {} : null }
  };
  
  const result = metaReasoning.analyzeAndImprove(stats);
  
  if (result?.config) {
    globalConfig.beam_width = result.config.beam_width || globalConfig.beam_width;
    globalConfig.max_depth = result.config.max_depth || globalConfig.max_depth;
    globalConfig.max_nodes = result.config.max_nodes || globalConfig.max_nodes;
  }
  
  return result;
}

function getGlobalConfig() {
  return { ...globalConfig };
}

export async function runAgent(input) {
  const context = initContext(input);

  const skill = await findBestSkill(context);

  if (skill) {
    return executeSkillFlow(skill, context);
  }

  return runPlanningFlow(context);
}

function initContext(input) {
  return {
    input: input.context || input,
    goal: input.goal || input,
    skills: input.skills || [],
    attention: input.attention || null,
    trace: [],
    state: {},
    version: 0
  };
}

async function findBestSkill(context) {
  const capability = extractCapability(context.goal);
  const candidates = await retrieveSkills(capability, context.skills);
  
  if (candidates.length === 0) return null;
  
  const weighted = applyAttentionToSkills(candidates, context.attention);
  return selectSkillWithBandit(weighted);
}

async function executeSkillFlow(skill, context) {
  context.state.selectedSkill = skill;
  
  const result = await executeSkill(skill, context.input);
  
  context.trace.push({
    step: "skill_execution",
    skillId: skill.id,
    status: result.error ? "error" : "ok"
  });
  
  return {
    output: result,
    trace: context.trace
  };
}

async function runPlanningFlow(context) {
  const planResult = maybePlan(context.goal, context.skills);
  
  if (!planResult.shouldPlan) {
    return executeSkillFlow(planResult.bestSkill, context);
  }
  
  context.state.planning = true;
  const plans = await plannerStepFromContext(context);
  
  context.trace.push({
    step: "planning",
    plans: plans.length,
    reason: planResult.reason
  });
  
  const compiled = compilePlanToSkill(plans);
  return executeSkillFlow(compiled, context);
}

async function plannerStepFromContext(context) {
  const { createPlan } = await import("./planner.js");
  return createPlan(context.goal, { steps: 0 }, context.skills, {
    maxDepth: CONFIG.MAX_STEPS,
    maxCost: CONFIG.ACCEPT_SCORE
  });
}
