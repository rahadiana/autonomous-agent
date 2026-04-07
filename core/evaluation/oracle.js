import { getTestCases } from "../groundTruth.js";

export async function computeExpected(skill, input) {
  const capability = skill.capability || skill.name;

  if (skill.oracle) {
    return skill.oracle(input);
  }

  const testCases = getTestCases(capability);
  const matchedCase = testCases.find(tc => {
    const inputKeys = Object.keys(tc.input || {});
    const inputVals = inputKeys.map(k => tc.input[k]);
    const inputTest = Object.keys(input || {});
    const inputTestVals = inputTest.map(k => input[k]);
    return JSON.stringify(inputVals) === JSON.stringify(inputTestVals);
  });

  if (matchedCase) {
    return matchedCase.expected;
  }

  return null;
}

export async function llmOracle(skill, input) {
  return null;
}
