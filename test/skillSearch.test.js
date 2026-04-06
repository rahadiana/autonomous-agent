import test from "node:test";
import assert from "node:assert";
import { SkillSearch, createSkillSearch } from "../services/skillSearch.js";

test("SkillSearch indexSkill adds skill to index", () => {
  const search = createSkillSearch();
  
  const id = search.indexSkill({
    id: "skill1",
    name: "add_numbers",
    capability: "math.add"
  });
  
  assert.strictEqual(search.count(), 1);
  assert.strictEqual(id, "skill1");
});

test("SkillSearch searchByText finds relevant skills", () => {
  const search = createSkillSearch();
  
  search.indexSkill({ id: "add", name: "add", capability: "math.add", description: "Add numbers" });
  search.indexSkill({ id: "sub", name: "subtract", capability: "math.sub", description: "Subtract numbers" });
  search.indexSkill({ id: "fetch", name: "fetch", capability: "api.fetch", description: "Fetch data" });
  
  const results = search.searchByText("add numbers math", 2);
  
  assert.ok(results.length >= 1);
  assert.ok(results[0].score > 0);
});

test("SkillSearch searchByText respects topK", () => {
  const search = createSkillSearch();
  
  search.indexSkill({ id: "a", name: "a", capability: "test.a" });
  search.indexSkill({ id: "b", name: "b", capability: "test.b" });
  search.indexSkill({ id: "c", name: "c", capability: "test.c" });
  
  const results = search.searchByText("test", 2, 0);
  assert.strictEqual(results.length, 2);
});

test("SkillSearch searchByText respects threshold", () => {
  const search = createSkillSearch();
  
  search.indexSkill({ id: "match", name: "test_match", capability: "test.match" });
  search.indexSkill({ id: "nomatch", name: "unrelated", capability: "unrelated" });
  
  const results = search.searchByText("test match", 5, 0.8);
  
  assert.ok(results.every(r => r.score >= 0.8));
});

test("SkillSearch searchByCapability filters by capability", () => {
  const search = createSkillSearch();
  
  search.indexSkill({ id: "add", name: "add", capability: "math.add" });
  search.indexSkill({ id: "sub", name: "sub", capability: "math.sub" });
  search.indexSkill({ id: "fetch", name: "fetch", capability: "api.fetch" });
  
  const results = search.searchByCapability("math.add");
  
  assert.ok(results.every(r => r.skill.capability === "math.add"));
});

test("SkillSearch findSimilar returns similar skills", () => {
  const search = createSkillSearch();
  
  search.indexSkill({ id: "skill1", name: "add_numbers", capability: "math.add" });
  search.indexSkill({ id: "skill2", name: "subtract_numbers", capability: "math.sub" });
  search.indexSkill({ id: "skill3", name: "fetch_api", capability: "api.fetch" });
  
  const similar = search.findSimilar("skill1", 2);
  
  assert.ok(similar.length >= 1);
  assert.ok(similar.every(s => s.skill.id !== "skill1"));
});

test("SkillSearch getSkill returns skill by id", () => {
  const search = createSkillSearch();
  
  const skill = { id: "test", name: "test" };
  search.indexSkill(skill);
  
  const found = search.getSkill("test");
  assert.strictEqual(found, skill);
});

test("SkillSearch hasSkill returns correct boolean", () => {
  const search = createSkillSearch();
  
  search.indexSkill({ id: "exists", name: "exists" });
  
  assert.strictEqual(search.hasSkill("exists"), true);
  assert.strictEqual(search.hasSkill("notexists"), false);
});

test("SkillSearch removeSkill removes from index", () => {
  const search = createSkillSearch();
  
  search.indexSkill({ id: "toremove", name: "toremove" });
  assert.strictEqual(search.hasSkill("toremove"), true);
  
  search.removeSkill("toremove");
  assert.strictEqual(search.hasSkill("toremove"), false);
});

test("SkillSearch count returns total indexed skills", () => {
  const search = createSkillSearch();
  
  search.indexSkill({ id: "a", name: "a" });
  search.indexSkill({ id: "b", name: "b" });
  search.indexSkill({ id: "c", name: "c" });
  
  assert.strictEqual(search.count(), 3);
});

test("SkillSearch clear removes all skills", () => {
  const search = createSkillSearch();
  
  search.indexSkill({ id: "a", name: "a" });
  search.indexSkill({ id: "b", name: "b" });
  search.clear();
  
  assert.strictEqual(search.count(), 0);
});

test("SkillSearch listAll returns all skills", () => {
  const search = createSkillSearch();
  
  const s1 = { id: "a", name: "a" };
  const s2 = { id: "b", name: "b" };
  search.indexSkill(s1);
  search.indexSkill(s2);
  
  const all = search.listAll();
  assert.strictEqual(all.length, 2);
  assert.ok(all.includes(s1));
  assert.ok(all.includes(s2));
});

test("SkillSearch with no matches returns empty array", () => {
  const search = createSkillSearch();
  
  search.indexSkill({ id: "a", name: "completely different skill", capability: "different" });
  
  const results = search.searchByText("math add numbers", 5, 0.8);
  assert.strictEqual(results.length, 0);
});

test("SkillSearch handles duplicate id updates", () => {
  const search = createSkillSearch();
  
  search.indexSkill({ id: "dup", name: "first" });
  search.indexSkill({ id: "dup", name: "second" });
  
  const skill = search.getSkill("dup");
  assert.strictEqual(skill.name, "second");
  assert.strictEqual(search.count(), 1);
});