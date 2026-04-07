function normalizeCapability(text) {
  if (!text || typeof text !== "string") return "";
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeCapability(text) {
  return normalizeCapability(text);
}

function enforceCapabilityNormalization(skill) {
  if (skill && skill.capability) {
    skill.capability = normalizeCapability(skill.capability);
    skill.capability_key = canonicalizeCapability(skill.capability);
  }
  return skill;
}

function queryByCanonicalCapability(capability) {
  return normalizeCapability(capability);
}

async function findBestSkill(input, skills) {
  const normalized = normalizeCapability(input);
  
  const exactMatches = skills.filter(s => 
    normalizeCapability(s.capability) === normalized
  );
  
  if (exactMatches.length > 0) {
    const best = exactMatches.reduce((a, b) => 
      ((a.score || 0) > (b.score || 0)) ? a : b
    );
    return { skill: best, score: 1, matchType: "exact" };
  }
  
  return { skill: null, score: 0, matchType: "none" };
}

module.exports = { 
  normalizeCapability, 
  canonicalizeCapability,
  enforceCapabilityNormalization,
  queryByCanonicalCapability,
  findBestSkill
};
