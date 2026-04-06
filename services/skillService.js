import { Skill } from "../models/skill.js";
import { runSkill } from "../core/executor.js";
import { validate } from "../core/validator.js";
import { evaluate } from "../core/scoring.js";
import { selectSkill } from "../core/bandit.js";
import { mutateSkill } from "../core/mutation.js";
import { createVersion } from "../core/versioning.js";

export async function handleRequest(input, capability) {
  const skills = await Skill.findAll({
    where: { capability }
  });

  if (skills.length === 0) {
    throw new Error("No skill found");
  }

  const skill = selectSkill(skills);

  const result = await runSkill(skill.json, input);

  const validation = validate(skill.json.output_schema, result);

  const score = evaluate(result, validation.valid);

  await updateStats(skill, validation.valid);

  if (Math.random() < 0.2) {
    const mutated = mutateSkill(skill.json);

    const testResult = await runSkill(mutated, input);

    const val = validate(skill.json.output_schema, testResult);

    const newScore = evaluate(testResult, val.valid);

    if (newScore > skill.score + 0.05) {
      await createVersion(skill, mutated);
    }
  }

  return result;
}

async function updateStats(skill, success) {
  const usage = skill.usage_count + 1;

  const successCount = skill.success_count + (success ? 1 : 0);
  const failCount = skill.failure_count + (success ? 0 : 1);

  const successRate = successCount / usage;

  const newScore =
    skill.score * 0.7 + successRate * 0.3;

  await skill.update({
    usage_count: usage,
    success_count: successCount,
    failure_count: failCount,
    score: newScore,
    last_used_at: new Date()
  });
}
