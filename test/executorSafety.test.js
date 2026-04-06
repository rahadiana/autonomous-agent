import test from "node:test";
import assert from "node:assert";
import { runSkill } from "../core/executor.js";

test("runSkill throws on dangerous code with process", async () => {
  const skill = {
    logic: "output.result = process.exit(0);"
  };

  await assert.rejects(
    () => runSkill(skill, {}),
    /Dangerous code detected/
  );
});

test("runSkill throws on dangerous code with require", async () => {
  const skill = {
    logic: "const fs = require('fs');"
  };

  await assert.rejects(
    () => runSkill(skill, {}),
    /Dangerous code detected/
  );
});

test("runSkill throws on dangerous code with module", async () => {
  const skill = {
    logic: "output.x = module.exports;"
  };

  await assert.rejects(
    () => runSkill(skill, {}),
    /Dangerous code detected/
  );
});

test("runSkill executes normal logic", async () => {
  const skill = {
    logic: "output.result = input.a + input.b;"
  };

  const result = await runSkill(skill, { a: 5, b: 3 });
  assert.strictEqual(result.result, 8);
});

test("runSkill timeout prevents infinite loops", async () => {
  const skill = {
    logic: "while(true) {}"
  };

  await assert.rejects(
    () => runSkill(skill, {}),
    { name: "Error" }
  );
});