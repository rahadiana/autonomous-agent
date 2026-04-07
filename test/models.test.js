import { test, describe } from "node:test";
import assert from "node:assert";
import { Skill } from "../models/skill.js";

describe("Skill Model", () => {
  test("should wrap db operations", async () => {
    const skill = await Skill.create({
      name: "wrap_test",
      capability: "wrap.test",
      json: { logic: "output.r = 1;" }
    });
    assert.ok(skill.id, "has id");
    assert.strictEqual(skill.name, "wrap_test");
    console.log("TEST: Skill wrap OK");
  });
});