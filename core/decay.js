import { Skill } from "../models/skill.js";

export async function applyDecay() {
  const skills = await Skill.findAll();
  const now = Date.now();

  for (const s of skills) {
    if (!s.last_used_at) continue;
    if (s.score < 0.1) continue;

    const days =
      (now - new Date(s.last_used_at)) / (1000 * 60 * 60 * 24);

    const decay = Math.exp(-0.05 * days);

    await s.update({
      score: Math.max(0, s.score * decay)
    });
  }
}
