import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { normalizeCapability, findSkill, matchCapability } from "../services/capabilityMatcher.js";
import { db } from "../db.js";

describe("Capability Matcher", () => {
  beforeEach(async () => {
    await db.init();
    await db.save();
  });

  it("should normalize capability text", () => {
    const result = normalizeCapability("  MATH.ADD  ");
    assert.strictEqual(result, "math.add");
  });

  it("should find skill by capability", async () => {
    await db.create({
      id: "test-id-1",
      name: "add_skill",
      capability: "math.add",
      json: { logic: "output.result = input.a + input.b;" },
      score: 0
    });

    const skill = await findSkill("math.add");
    assert.strictEqual(skill?.capability, "math.add");
  });

  it("should match capability with types", async () => {
    await db.create({
      id: "test-id-2",
      name: "sub_skill",
      capability: "math.subtract",
      json: { logic: "output.result = input.a - input.b;" },
      score: 0
    });

    const result = await matchCapability("math.subtract");
    assert.strictEqual(result.type, "exact");
    assert.strictEqual(result.match?.capability, "math.subtract");
  });
});