import vm from "node:vm";
import { Skill } from "../models/skill.js";

export class Executor {
  constructor(sandbox = false) {
    this.sandbox = sandbox;
  }

  async run(skill, input) {
    const skillData = typeof skill === "string" 
      ? await Skill.findOne({ where: { capability: skill } })
      : skill;
    
    if (!skillData) {
      throw new Error("Skill not found");
    }

    return this.execute(skillData.json, input);
  }

  execute(skillJson, input) {
    const { logic, output_schema } = skillJson;
    const output = {};
    
    if (this.sandbox) {
      return this.executeSandboxed(logic, input, output);
    }
    
    const fn = new Function("input", "output", logic);
    fn(input, output);
    
    return output;
  }

  executeSandboxed(logic, input, output) {
    const context = vm.createContext({ input, output });
    try {
      vm.runInContext(logic, context, { timeout: 1000 });
    } catch (e) {
      throw new Error("Execution blocked: " + e.message);
    }
    return context.output;
  }

  async test(skill, testCases) {
    const results = [];
    for (const tc of testCases) {
      try {
        const output = this.execute(skill.json, tc.input);
        results.push({
          input: tc.input,
          expected: tc.expected,
          actual: output,
          passed: this.compare(output, tc.expected)
        });
      } catch (e) {
        results.push({
          input: tc.input,
          expected: tc.expected,
          error: e.message,
          passed: false
        });
      }
    }
    return results;
  }

  compare(actual, expected) {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
}