import { db } from "../db.js";

export function normalizeCapability(text) {
  return text.toLowerCase().trim();
}

export async function findSkill(capability) {
  const normalized = normalizeCapability(capability);
  return db.findByCapability(normalized);
}

export async function matchCapability(capability) {
  const normalized = normalizeCapability(capability);
  const allSkills = await db.findAll();
  
  const exactMatch = allSkills.find(s => s.capability === normalized);
  if (exactMatch) return { match: exactMatch, type: "exact" };
  
  const partialMatch = allSkills.find(s => 
    normalized.includes(s.capability) || s.capability.includes(normalized)
  );
  if (partialMatch) return { match: partialMatch, type: "partial" };
  
  return { match: null, type: "none" };
}