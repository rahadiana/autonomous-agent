import { runSkill } from "./executor.js";
import { validate } from "./validator.js";
import { evaluate } from "./scoring.js";

export async function runTests(skill, testCases) {
  let passed = 0;
  const results = [];

  for (const t of testCases) {
    try {
      const result = await runSkill(skill, t.input);

      const validation = validate(
        skill.output_schema,
        result
      );

      if (validation.valid) {
        passed++;
      }

      results.push({
        input: t.input,
        result,
        valid: validation.valid,
        errors: validation.errors
      });
    } catch (e) {
      results.push({
        input: t.input,
        error: e.message,
        valid: false
      });
    }
  }

  return {
    passed,
    total: testCases.length,
    score: testCases.length > 0 ? passed / testCases.length : 0,
    results
  };
}

export async function runEvaluation(skill, testCases) {
  const testResult = await runTests(skill, testCases);

  const avgScore = testResult.results.reduce((sum, r) => {
    return sum + evaluate(r.result, r.valid);
  }, 0) / (testResult.results.length || 1);

  return {
    testScore: testResult.score,
    avgScore,
    totalTests: testResult.total,
    passedTests: testResult.passed
  };
}