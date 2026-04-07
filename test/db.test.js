import { test, describe } from "node:test";
import assert from "node:assert";
import { db, initDB } from "../db.js";

describe("Database", () => {
  test("should initialize DB", async () => {
    await initDB();
    assert.ok(Array.isArray(db.skills), "skills is array");
    console.log("TEST: DB init OK");
  });

  test("should create skill", async () => {
    await initDB();
    const skill = await db.create({
      name: "test_skill",
      capability: "test.add",
      json: { logic: "output.result = 1;" }
    });
    assert.strictEqual(skill.name, "test_skill");
    console.log("TEST: Create skill OK");
  });

  test("should find by capability", async () => {
    await initDB();
    const found = await db.findByCapability("test.add");
    assert.strictEqual(found.name, "test_skill");
    console.log("TEST: Find by capability OK");
  });
});