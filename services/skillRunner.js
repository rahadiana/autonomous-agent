import { runSkill } from "../core/executor.js";
import { validate } from "../core/validator.js";

class SkillRunnerClass {
  constructor(skillStore = {}) {
    this.skills = skillStore;
  }

  register(name, skill) {
    this.skills[name] = skill;
  }

  async run(name, input) {
    const skill = this.skills[name];
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }

    const result = await runSkill(skill, input);

    if (skill.output_schema) {
      const validation = validate(skill.output_schema, result);
      if (!validation.valid) {
        throw new Error(`Output validation failed: ${JSON.stringify(validation.errors)}`);
      }
    }

    return result;
  }

  has(name) {
    return !!this.skills[name];
  }

  list() {
    return Object.keys(this.skills);
  }
}

export const SkillRunner = new SkillRunnerClass();

export function createSkillRunner(store = {}) {
  return new SkillRunnerClass(store);
}