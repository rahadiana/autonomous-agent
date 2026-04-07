import { deepEqual, numericEqual } from "../evaluation.js";

export function scoreResults(results) {
  if (!results || results.length === 0) {
    return { score: 0, details: [] };
  }

  let total = 0;
  const details = [];

  for (const r of results) {
    let score = 0;

    if (r.schemaValid) {
      score += 0.2;
    }

    if (r.expected && r.output) {
      const isEqual = deepEqual(r.output, r.expected);
      if (isEqual) {
        score += 0.5;
      } else if (r.expected.result !== undefined && r.output.result !== undefined) {
        if (numericEqual(r.output.result, r.expected.result)) {
          score += 0.5;
        }
      }
    }

    if (r.type === "invalid") {
      if (r.error) {
        score += 0.2;
      }
    } else {
      if (!r.error) {
        score += 0.2;
      }
    }

    if (r.output !== undefined && r.output !== null) {
      score += 0.1;
    }

    if (r.error) {
      score -= 0.3;
    }

    total += score;
    details.push({
      type: r.type,
      score,
      correct: score >= 0.5
    });
  }

  const avgScore = total / results.length;

  return {
    score: Math.max(0, Math.min(1, avgScore)),
    details,
    totalTests: results.length,
    passed: details.filter(d => d.correct).length,
    failed: details.filter(d => !d.correct).length
  };
}

export function scoreResultsWithPenalty(results) {
  const baseScore = scoreResults(results);

  let penalty = 0;

  for (const r of results) {
    if (r.output && typeof r.output === "object") {
      const outputStr = JSON.stringify(r.output);
      if (outputStr.includes("input")) {
        penalty += 0.1;
      }
    }
  }

  return {
    score: Math.max(0, baseScore.score - penalty),
    ...baseScore,
    penalty
  };
}
