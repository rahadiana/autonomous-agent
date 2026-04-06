/**
 * Skill Management Test
 */

import { 
  normalizeCapability,
  extractCapabilityFromGoal,
  isDuplicateSkill,
  ensureDiversity,
  computeReward,
  FailureMemory,
  SkillLifecycleManager
} from "../core/skillManagement.js";

console.log("=== SKILL MANAGEMENT TEST ===\n");

// Test 1: Capability Normalization
console.log("1. Capability Normalization");
console.log("  'Math.Add' ->", normalizeCapability("Math.Add"));
console.log("  'HTTP GET Request' ->", normalizeCapability("HTTP GET Request"));
console.log("  'data.transform' ->", normalizeCapability("data.transform"));

// Test 2: Extract capability from goal
console.log("\n2. Extract Capability from Goal");
console.log("  'add 5 and 3' ->", extractCapabilityFromGoal("add 5 and 3"));
console.log("  'multiply 4 by 6' ->", extractCapabilityFromGoal("multiply 4 by 6"));
console.log("  'get user data' ->", extractCapabilityFromGoal("get user data"));

// Test 3: Duplicate Detection
console.log("\n3. Duplicate Detection");
const skill1 = {
  id: "skill_1",
  capability: "math.add",
  logic: [{ op: "add", a: "input.a", b: "input.b", to: "result" }]
};
const skill2 = {
  id: "skill_2",
  capability: "math.add", 
  logic: [{ op: "add", a: "input.a", b: "input.b", to: "result" }]
};
const skill3 = {
  id: "skill_3",
  capability: "math.multiply",
  logic: [{ op: "multiply", a: "input.a", b: "input.b", to: "result" }]
};

console.log("  skill1 vs skill2 (same logic):", isDuplicateSkill(skill1, [skill2]));  // true
console.log("  skill1 vs skill3 (diff logic):", isDuplicateSkill(skill1, [skill3]));  // false

// Test 4: Diversity Control
console.log("\n4. Diversity Control");
const diverseSkills = [
  { id: "a1", capability: "math.add", score: 0.9 },
  { id: "a2", capability: "math.add", score: 0.8 },
  { id: "b1", capability: "math.multiply", score: 0.7 },
  { id: "b2", capability: "math.multiply", score: 0.6 },
  { id: "c1", capability: "http.get", score: 0.5 }
];
const selected = ensureDiversity(diverseSkills, 3);
console.log("  Selected (max 3):", selected.map(s => s.capability + ":" + s.id));

// Test 5: Compute Reward
console.log("\n5. Global Reward Signal");
const reward1 = computeReward({
  result: { result: 8 },
  validation: { valid: true },
  skill: { usage_count: 10, success_count: 8 },
  failureRate: 0.1,
  latency: 50
});
console.log("  Good execution (valid, high success, low latency):", reward1.toFixed(3));

const reward2 = computeReward({
  result: { error: "failed" },
  validation: { valid: false, errors: ["schema"] },
  skill: { usage_count: 5, success_count: 1 },
  failureRate: 0.8,
  latency: 500
});
console.log("  Bad execution (invalid, low success, high failure):", reward2.toFixed(3));

// Test 6: Failure Memory
console.log("\n6. Failure Memory");
const failureMemory = new FailureMemory();
failureMemory.logFailure("skill_1", { a: 5, b: 3 }, new Error("Timeout"));
failureMemory.logFailure("skill_1", { a: 10, b: 20 }, new Error("Network error"));
failureMemory.logFailure("skill_2", { a: 1, b: 2 }, new Error("Invalid input"));

console.log("  skill_1 failures:", failureMemory.getFailureCount("skill_1"));
console.log("  skill_2 failures:", failureMemory.getFailureCount("skill_2"));
console.log("  Global stats:", failureMemory.getGlobalStats());

// Test 7: Lifecycle Manager
console.log("\n7. Skill Lifecycle Manager");
const lifecycle = new SkillLifecycleManager();

const testSkill = { id: "test_skill", score: 0.8, usage_count: 5 };

// Simulate failures
lifecycle.afterExecution(testSkill, {}, false);
lifecycle.afterExecution(testSkill, {}, false);
lifecycle.afterExecution(testSkill, {}, false);

const beforeResult = lifecycle.beforeExecution(testSkill);
console.log("  Before execution (after 3 failures):", beforeResult);

console.log("\n=== ALL TESTS COMPLETE ===");