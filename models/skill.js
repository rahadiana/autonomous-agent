import { v4 as uuid } from "uuid";
import { db } from "../db.js";

export const Skill = {
  async create(data) {
    return db.create({
      id: data.id || uuid(),
      name: data.name,
      capability: data.capability,
      json: data.json,
      score: data.score || 0.0,
      created_at: data.created_at || new Date().toISOString()
    });
  },
  
  async findOne(where) {
    if (where.capability) {
      return db.findByCapability(where.capability);
    }
    if (where.name) {
      return db.findByName(where.name);
    }
    return null;
  },
  
  async findAll() {
    return db.findAll();
  },
  
  async update(id, data) {
    return db.update(id, data);
  }
};