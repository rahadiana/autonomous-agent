export function isDuplicateSkill(newSkill, existingSkills) {
  return existingSkills.some(s => {
    return JSON.stringify(s.json?.logic) === JSON.stringify(newSkill.json?.logic);
  });
}

export function isDuplicateCapability(skill, existingSkills) {
  const normalized = normalizeCapability(skill.capability);
  return existingSkills.some(s => normalizeCapability(s.capability) === normalized);
}

function normalizeCapability(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .trim();
}
