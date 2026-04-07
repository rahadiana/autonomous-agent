import { getAllTestCases, TestCaseType } from "../groundTruth.js";

export function generateTests(skill, count = 5) {
  const capability = skill.capability || skill.name;
  const tests = [];

  const groundTruthCases = getAllTestCases(capability);

  const validCases = groundTruthCases.filter(t => t.type === TestCaseType.VALID);
  const edgeCases = groundTruthCases.filter(t => t.type === TestCaseType.EDGE);
  const invalidCases = groundTruthCases.filter(t => t.type === TestCaseType.INVALID);

  for (let i = 0; i < Math.min(count, validCases.length); i++) {
    tests.push({
      type: "normal",
      input: validCases[i]?.input || validCases[0]?.input,
      expected: validCases[i]?.expected || validCases[0]?.expected
    });
  }

  if (edgeCases.length > 0) {
    tests.push({
      type: "edge",
      input: edgeCases[0].input,
      expected: edgeCases[0].expected
    });
  }

  if (invalidCases.length > 0) {
    tests.push({
      type: "invalid",
      input: invalidCases[0].input,
      expected: invalidCases[0].expected
    });
  }

  return tests;
}

function generateValidInput(schema) {
  const obj = {};

  if (!schema || !schema.properties) {
    return { a: 1, b: 1 };
  }

  for (const key in schema.properties) {
    const prop = schema.properties[key];
    const type = prop.type;

    if (type === "number" || type === "integer") {
      obj[key] = Math.floor(Math.random() * 100) + 1;
    } else if (type === "string") {
      obj[key] = "test";
    } else if (type === "boolean") {
      obj[key] = true;
    }
  }

  return Object.keys(obj).length > 0 ? obj : { a: 1, b: 1 };
}

function generateEdgeCase(schema) {
  const obj = {};

  if (!schema || !schema.properties) {
    return { a: 0, b: 0 };
  }

  for (const key in schema.properties) {
    const prop = schema.properties[key];
    const type = prop.type;

    if (type === "number" || type === "integer") {
      obj[key] = 0;
    } else if (type === "string") {
      obj[key] = "";
    } else if (type === "boolean") {
      obj[key] = false;
    }
  }

  return Object.keys(obj).length > 0 ? obj : { a: 0, b: 0 };
}

function generateInvalid(schema) {
  const obj = {};

  if (!schema || !schema.properties) {
    return { a: null, b: 1 };
  }

  for (const key in schema.properties) {
    obj[key] = null;
  }

  return Object.keys(obj).length > 0 ? obj : { a: null, b: 1 };
}

export { generateValidInput, generateEdgeCase, generateInvalid };
