import { createBlackboard, Status } from "./blackboard.js";
import { createPlan } from "./planner.js";
import { runSkill, executeSkill } from "./executor.js";
import { selectSkill, banditScore } from "./bandit.js";
import { shouldMutate, mutateSkill, acceptMutation, mutateFromFailure } from "./mutation.js";
import { createVersion } from "./versioning.js";

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

  const plans = createPlan(goal, { steps: 0 }, skills, {
    maxDepth: CONFIG.MAX_STEPS,
    maxCost: CONFIG.ACCEPT_SCORE
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
    bb.setStatus(Status.CRITIC);

    return result;
  } catch (err) {
    bb.write("execution", { error: err.message }, "executor");
    bb.setStatus(Status.PLANNING, "execution_failed");

    return { error: err.message };
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
    }

    if (shouldMutateTargeted(selectedSkill)) {
      const mutated = mutateSkill(selectedSkill);
      
      if (validateDSL(mutated)) {
        const score = await testSkill(mutated);
        
        if (score > selectedSkill.score + 0.05) {
          const newVersion = createVersion(selectedSkill);
          Object.assign(newVersion, mutated);
          newVersion.parent_id = selectedSkill.id;
          return newVersion;
        }
      }
    }
  }
}

function validateDSL(skill) {
  if (!skill.logic || !Array.isArray(skill.logic)) return false;
  for (const step of skill.logic) {
    if (!step.op || typeof step.op !== "string") return false;
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
    skill.score = Math.min(1, (skill.score || 0) + 0.1);
    skill.success_count = (skill.success_count || 0) + 1;
  } else {
    skill.score = Math.max(0, (skill.score || 0) - 0.05);
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

  return bb.getZoneData("result");
}

async function goalManager(bb) {
  const goal = bb.getZoneData("goal");
  if (!goal) {
    bb.setStatus(Status.ERROR, "no_goal");
  }
}
