export function evaluate(result, valid) {
  let score = 0;

  if (valid) score += 0.4;
  if (result !== undefined) score += 0.3;

  score += 0.2;
  score += 0.1;

  return score;
}
