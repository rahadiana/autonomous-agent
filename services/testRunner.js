import { v4 as uuid } from "uuid";

export class TestRunner {
  constructor() {
    this.defaultCases = {
      "math.add": [
        { input: { a: 2, b: 3 }, expected: { result: 5 } },
        { input: { a: -1, b: 1 }, expected: { result: 0 } },
        { input: { a: 0, b: 0 }, expected: { result: 0 } }
      ],
      "string.concat": [
        { input: { a: "hello", b: " world" }, expected: { result: "hello world" } },
        { input: { a: "", b: "test" }, expected: { result: "test" } }
      ],
      "array.filter": [
        { input: { arr: [1, 2, 3, 4], fn: "x => x > 2" }, expected: { result: [3, 4] } }
      ]
    };
  }

  generateTestCases(skill, count = 3) {
    const capability = skill.capability || skill.json?.capability || "default";
    return this.defaultCases[capability] || this.generateRandomCases(capability, count);
  }

  generateRandomCases(capability, count) {
    const cases = [];
    for (let i = 0; i < count; i++) {
      cases.push({
        input: { id: uuid(), data: Math.random() },
        expected: { id: 0 }
      });
    }
    return cases;
  }

  async run(skill, testCases) {
    const results = [];
    for (const tc of testCases) {
      try {
        const actual = await this.executeSkill(skill, tc.input);
        results.push({
          input: tc.input,
          expected: tc.expected,
          actual,
          passed: this.compare(actual, tc.expected)
        });
      } catch (e) {
        results.push({ input: tc.input, expected: tc.expected, error: e.message, passed: false });
      }
    }
    return results;
  }

  async executeSkill(skill, input) {
    return input;
  }

  compare(actual, expected) {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  evaluate(results) {
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    return {
      score: total > 0 ? passed / total : 0,
      passed,
      total,
      valid: passed === total
    };
  }
}