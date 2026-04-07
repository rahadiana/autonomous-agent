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

module.exports = { 
  normalizeCapability, 
  canonicalizeCapability,
  enforceCapabilityNormalization,
  queryByCanonicalCapability
};
