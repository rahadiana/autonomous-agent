function normalizeCapability(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

function enforceCapabilityNormalization(skill) {
  if (skill && skill.capability) {
    skill.capability = normalizeCapability(skill.capability);
  }
  return skill;
}

module.exports = { normalizeCapability, enforceCapabilityNormalization };
