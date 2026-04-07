import { createBlackboard, Status } from "./blackboard.js";
import { createPlan } from "./planner.js";
import { runSkill } from "./executor.js";
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
  RETRY_DELAY_MS: 100
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
    const result = await runSkill(compiledSkill, input);

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

export async function learningStep(bb, selectedSkill) {
  const execution = bb.getZoneData("execution");
  const result = bb.getZoneData("result");

  if (!execution?.result || !selectedSkill) return;

  const success = result?.score > 0.7;

  if (selectedSkill) {
    selectedSkill.usage_count = (selectedSkill.usage_count || 0) + 1;
    selectedSkill.last_used_at = Date.now();
    if (success) {
      selectedSkill.score = Math.min(1, (selectedSkill.score || 0) + 0.1);
    } else {
      selectedSkill.score = Math.max(0, (selectedSkill.score || 0) - 0.05);
    }

    const mutationCheck = shouldMutate(selectedSkill);
    if (mutationCheck.shouldMutate) {
      const mutated = mutateSkill(selectedSkill);
      const mutatedScore = await testSkill(mutated);
      const accept = acceptMutation(selectedSkill.score, mutatedScore);
      
      if (accept.accept) {
        const newVersion = createVersion(selectedSkill);
        Object.assign(newVersion, mutated);
        newVersion.parent_id = selectedSkill.id;
        return newVersion;
      }
    }
  }
}

async function testSkill(skill) {
  try {
    const result = await runSkill(skill, { test: true });
    return result?._meta?.score || 0.5;
  } catch {
    return 0;
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

export { CONFIG as SYSTEM_CONFIG };
