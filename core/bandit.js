export function computeFinalScore(skill, similarity = 0, contextMatch = 0) {
  return (
    similarity * 0.5 +
    (skill.score || 0) * 0.3 +
    contextMatch * 0.2
  );
}

export function selectSkillWithContext(skills, context = {}) {
  const total = skills.reduce((a, b) => a + (b.usage_count || 0), 0);
  const similarity = context.similarity || 0;
  const contextMatch = context.contextMatch || 0;

  let best = null;
  let bestScore = -Infinity;

  for (const s of skills) {
    const score = computeFinalScore(s, similarity, contextMatch);

    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }

  return best;
}

export function banditScore(skill, total) {
  const c = 1.2;

  const exploit = skill.score;

  const explore =
    c * Math.sqrt(Math.log(total + 1) / (skill.usage_count + 1));

  return exploit + explore;
}

export function selectSkill(skills) {
  const total = skills.reduce((a, b) => a + b.usage_count, 0);

  let best = null;
  let bestScore = -Infinity;

  for (const s of skills) {
    const score = banditScore(s, total);

    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }

  return best;
}

export function selectBestSkill(skills, tournamentSize = 3) {
  if (!skills || skills.length === 0) return null;
  if (skills.length === 1) return skills[0];

  const sampleSize = Math.min(tournamentSize, skills.length);
  const indices = new Set();
  
  while (indices.size < sampleSize) {
    const idx = Math.floor(Math.random() * skills.length);
    indices.add(idx);
  }

  const sample = Array.from(indices).map(i => skills[i]);
  
  return sample.slice().sort((a, b) => b.score - a.score)[0];
}
