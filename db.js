import fs from "fs";

const DB_FILE = "./data/skills.json";

export const db = {
  skills: [],
  
  async init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, "utf-8");
        this.skills = JSON.parse(data);
      } else {
        this.skills = [];
      }
    } catch {
      this.skills = [];
    }
  },
  
  async save() {
    const dir = "./data";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(this.skills, null, 2));
  },
  
  async findAll() {
    return this.skills;
  },
  
  async findByCapability(capability) {
    return this.skills.find(s => s.capability === capability);
  },
  
  async findByName(name) {
    return this.skills.find(s => s.name === name);
  },
  
  async create(skill) {
    this.skills.push(skill);
    await this.save();
    return skill;
  },
  
  async update(id, data) {
    const idx = this.skills.findIndex(s => s.id === id);
    if (idx >= 0) {
      this.skills[idx] = { ...this.skills[idx], ...data };
      await this.save();
      return this.skills[idx];
    }
    return null;
  },
  
  async delete(id) {
    const idx = this.skills.findIndex(s => s.id === id);
    if (idx >= 0) {
      this.skills.splice(idx, 1);
      await this.save();
      return true;
    }
    return false;
  },
  
  async sync() {
    await this.init();
  }
};

export async function initDB() {
  return db.init();
}