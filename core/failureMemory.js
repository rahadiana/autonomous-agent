import { SKILL_MANAGEMENT_CONFIG } from "./skillManagement.js";

export const FAILURE_MEMORY_CONFIG = {
  maxFailures: 1000,
  windowMs: 24 * 60 * 60 * 1000
};

const failureLog = new Map();

export function logFailure(input, skill, error) {
  const skillId = skill?.id || skill;
  
  if (!failureLog.has(skillId)) {
    failureLog.set(skillId, []);
  }
  
  const failures = failureLog.get(skillId);
  failures.push({
    input,
    skill_id: skillId,
    error: error?.message || String(error),
    created_at: new Date()
  });
  
  if (failures.length > FAILURE_MEMORY_CONFIG.maxFailures) {
    failures.shift();
  }
}

export function tooManyFailures(skill) {
  const skillId = skill?.id || skill;
  const failures = failureLog.get(skillId) || [];
  
  return failures.length >= SKILL_MANAGEMENT_CONFIG.failureThreshold;
}

export function applyFailurePenalty(skill) {
  if (!skill) return skill;
  
  if (tooManyFailures(skill)) {
    skill.score *= SKILL_MANAGEMENT_CONFIG.failurePenalty;
  }
  
  return skill;
}

export function getFailureCount(skill) {
  const skillId = skill?.id || skill;
  return (failureLog.get(skillId) || []).length;
}

export function getFailures(skill) {
  const skillId = skill?.id || skill;
  return failureLog.get(skillId) || [];
}

export function clearFailures(skill) {
  const skillId = skill?.id || skill;
  failureLog.delete(skillId);
}

export function clearAllFailures() {
  failureLog.clear();
}