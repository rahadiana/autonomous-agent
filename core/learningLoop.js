import { selectSkill } from './bandit.js';
import { runSkill } from './executor.js';
import { validateSkillOutput } from './validator.js';
import { updateSkillStats } from './skillService.js';
import { mutateSkill } from './mutation.js';
import { searchSkills } from './skillSearch.js';
import { evaluate } from './reasoner.js';
import { createVersion } from './versioning.js';
import { runTests } from './testRunner.js';

const EXPLORATION_RATE = 0.3;

function shouldExplore() {
  return Math.random() < EXPLORATION_RATE;
}

function resolveValue(val, ctx) {
  if (typeof val !== 'string') return val;
  if (val.startsWith('input.')) {
    return getPath(ctx.input, val.replace('input.', ''));
  }
  if (val.startsWith('memory.')) {
    return getPath(ctx.memory, val.replace('memory.', ''));
  }
  return val;
}

function getPath(obj, path) {
  if (!path) return obj;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

export async function runAgent(input, availableSkills = []) {
  const ctx = {
    input,
    memory: {},
    output: {},
    trace: []
  };

  const candidates = await searchSkills(input);
  if (candidates.length === 0 && availableSkills.length > 0) {
    candidates.push(...availableSkills.slice(0, 5));
  }

  const skill = selectSkill(candidates);
  if (!skill) {
    throw new Error('No skill available');
  }

  const result = await runSkill(skill, input);
  ctx.output = result.output || result;
  ctx.trace = result.trace || [];

  const validation = validateSkillOutput(skill.output_schema, ctx.output);

  await updateSkillStats(skill.id, validation.valid);

  if (shouldExplore()) {
    const critique = await evaluate({ goal: input, plan: skill }, ctx.output);
    const newSkill = await mutateSkill(skill, critique);
    if (newSkill) {
      const versionedSkill = await createVersion(skill, newSkill);
      await runTests(versionedSkill);
    }
  }

  return {
    output: ctx.output,
    trace: ctx.trace,
    skillUsed: skill.id,
    valid: validation.valid
  };
}

export { resolveValue, getPath };
