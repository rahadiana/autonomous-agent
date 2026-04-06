import { Skill } from "../models/skill.js";
import { v4 as uuid } from "uuid";

export async function createVersion(oldSkill, newJson) {
  return Skill.create({
    id: uuid(),
    name: oldSkill.name,
    capability: oldSkill.capability,
    json: newJson,
    score: oldSkill.score,
    version: oldSkill.version + 1,
    parent_id: oldSkill.id,
    created_at: new Date()
  });
}
