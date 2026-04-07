import { Skill } from "../models/skill.js";
import { initDB, db } from "../db.js";
import { Executor } from "./executor.js";
import { TestRunner } from "./testRunner.js";
import { MCPWrapper } from "./mcpWrapper.js";

await initDB();

const executor = new Executor(true);
const testRunner = new TestRunner();
const mcp = new MCPWrapper();
mcp.init();

export async function handleRequest(input, capability) {
  const skill = await db.findByCapability(capability);
  
  if (!skill) {
    throw new Error(`Skill for capability ${capability} not found`);
  }

  return executor.execute(skill.json, input);
}

export async function findSkill(capability) {
  return db.findByCapability(capability);
}

export async function saveSkill(skillData) {
  return Skill.create(skillData);
}

export async function evalSkill(skill, input) {
  const testCases = testRunner.generateTestCases(skill);
  const results = await executor.test(skill.json, testCases);
  return testRunner.evaluate(results);
}

export { executor, testRunner, mcp };