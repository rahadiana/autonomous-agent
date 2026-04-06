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
