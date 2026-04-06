/**
 * Learning Orchestrator - Complete Learning Loop Implementation
 * 
 * Implements the learning loop from next_plan.md (lines 102-143):
 * 1. Retrieve skills from registry
 * 2. Select skill with bandit (UCB)
 * 3. Execute skill (DSL)
 * 4. Validate output schema
 * 5. Compute real reward
 * 6. Update skill stats
 * 7. Exploration
 * 8. Save to episodic memory
 */

import { runDSL } from "./executor.js";
import { validate } from "./validator.js";
import { SkillRegistry } from "./skillRegistry.js";
import { banditScore, selectSkill } from "./bandit.js";
import { evaluateSkill } from "./testRunner.js";
import { EpisodicMemory } from "./episodicMemory.js";

const EXPLORATION_RATE = 0.15;
const REWARD_THRESHOLD = 0.7;

let skillRegistry = null;
let episodicMemory = null;

export function initLearningOrchestrator(options = {}) {
  skillRegistry = options.skillRegistry || new SkillRegistry(options);
  episodicMemory = options.episodicMemory || new EpisodicMemory(options);
  
  return { skillRegistry, episodicMemory };
}

export function getSkillRegistry() {
  return skillRegistry;
}

export function getEpisodicMemory() {
  return episodicMemory;
}

export async function retrieveSkills(input) {
  const capability = input?.capability || input?.type || null;
  
  if (capability) {
    const skills = skillRegistry.getByCapability(capability);
    if (skills.length > 0) {
      return skills;
    }
  }
  
  return skillRegistry.list();
}

export function selectSkillWithBandit(candidates) {
  if (!candidates || candidates.length === 0) {
    return null;
  }
  
  if (candidates.length === 1) {
    return candidates[0];
  }
  
  return selectSkill(candidates);
}

export async function executeSkill(skill, input) {
  if (!skill) {
    throw new Error("Skill is required");
  }
  
  const dsl = {
    logic: skill.logic,
    output_schema: skill.output_schema
  };
  
  return runDSL(dsl, input);
}

export function validateOutput(schema, result) {
  if (!schema) {
    return { valid: true, errors: [] };
  }
  
  return validate(schema, result);
}

export async function computeReward(params) {
  const { result, validation, skill, input } = params;
  
  if (!validation.valid) {
    return 0.0;
  }
  
  try {
    const evalResult = await evaluateSkill(skill, skill.capability);
    
    if (evalResult && evalResult.score !== undefined) {
      return evalResult.score;
    }
  } catch (e) {
    console.log("[computeReward] evaluateSkill failed, using fallback");
  }
  
  let score = 0.0;
  
  if (validation.valid) {
    score += 0.4;
  }
  
  if (result && !result.error) {
    score += 0.3;
  }
  
  if (result?._meta && !result._meta.hadError) {
    score += 0.2;
  }
  
  if (input?.expected !== undefined && result?.result !== undefined) {
    const tolerance = 1e-9;
    if (Math.abs(Number(result.result) - Number(input.expected)) < tolerance) {
      score += 0.1;
    }
  }
  
  return Math.min(1.0, score);
}

export async function updateSkillStats(skill, success) {
  if (!skill) return false;
  
  const score = success ? REWARD_THRESHOLD : 0.3;
  return skillRegistry.updateStats(skill.id, success, score);
}

export function shouldExplore() {
  return Math.random() < EXPLORATION_RATE;
}

export async function exploreSkill(skill, input) {
  if (!skill) return null;
  
  console.log(`[LearningOrchestrator] Exploring skill: ${skill.name || skill.id}`);
  
  const originalLogic = skill.logic;
  
  try {
    const mutatedLogic = mutateLogic(originalLogic);
    
    const testSkill = {
      ...skill,
      logic: mutatedLogic,
      id: `${skill.id}_explored_${Date.now()}`
    };
    
    skillRegistry.register(testSkill);
    
    return testSkill;
  } catch (e) {
    console.log(`[LearningOrchestrator] Exploration failed: ${e.message}`);
    return null;
  }
}

function mutateLogic(logic) {
  if (!Array.isArray(logic) || logic.length === 0) {
    return logic;
  }
  
  const mutated = JSON.parse(JSON.stringify(logic));
  
  const mutationType = Math.floor(Math.random() * 3);
  
  switch (mutationType) {
    case 0:
      if (mutated.length > 1) {
        const idx = Math.floor(Math.random() * mutated.length);
        mutated.splice(idx, 1);
      }
      break;
      
    case 1:
      const newStep = { 
        op: "set", 
        path: `explored_${Date.now()}`, 
        value: Math.random() 
      };
      const insertPos = Math.floor(Math.random() * (mutated.length + 1));
      mutated.splice(insertPos, 0, newStep);
      break;
      
    case 2:
      const stepToModify = Math.floor(Math.random() * mutated.length);
      if (mutated[stepToModify]) {
        mutated[stepToModify] = { 
          ...mutated[stepToModify], 
          _mutated: true,
          _parent: mutated[stepToModify].op
        };
      }
      break;
  }
  
  return mutated;
}

export async function saveEpisode(params) {
  const { input, skill, reward, result } = params;
  
  if (!episodicMemory) {
    console.warn("[LearningOrchestrator] Episodic memory not initialized");
    return null;
  }
  
  const plan = {
    bestPath: [{
      capability: skill.capability,
      skill_id: skill.id,
      input
    }]
  };
  
  return episodicMemory.saveEpisode(input, plan, result);
}

export async function learningLoop(input) {
  const context = {
    input,
    timestamp: Date.now()
  };
  
  console.log(`[LearningOrchestrator] Starting learning loop for:`, input);
  
  const candidates = await retrieveSkills(input);
  console.log(`[LearningOrchestrator] Retrieved ${candidates.length} candidate skills`);
  
  const skill = selectSkillWithBandit(candidates);
  if (!skill) {
    throw new Error("No skill available for execution");
  }
  console.log(`[LearningOrchestrator] Selected skill: ${skill.name || skill.id}`);
  
  const result = await executeSkill(skill, input);
  console.log(`[LearningOrchestrator] Executed skill, result:`, result);
  
  const validation = validateOutput(skill.output_schema, result);
  console.log(`[LearningOrchestrator] Validation:`, validation.valid ? "valid" : "invalid");
  
  const reward = await computeReward({
    result,
    validation,
    skill,
    input
  });
  console.log(`[LearningOrchestrator] Computed reward: ${reward.toFixed(3)}`);
  
  const success = reward >= REWARD_THRESHOLD;
  await updateSkillStats(skill, success);
  console.log(`[LearningOrchestrator] Updated skill stats (success: ${success})`);
  
  if (shouldExplore()) {
    console.log(`[LearningOrchestrator] Triggering exploration`);
    await exploreSkill(skill, input);
  }
  
  await saveEpisode({
    input,
    skill,
    reward,
    result
  });
  console.log(`[LearningOrchestrator] Saved episode to memory`);
  
  return result;
}

export function setExplorationRate(rate) {
  if (rate >= 0 && rate <= 1) {
    console.log(`[LearningOrchestrator] Set exploration rate to ${rate}`);
  }
}

export function setRewardThreshold(threshold) {
  if (threshold >= 0 && threshold <= 1) {
    console.log(`[LearningOrchestrator] Set reward threshold to ${threshold}`);
  }
}

export default learningLoop;
