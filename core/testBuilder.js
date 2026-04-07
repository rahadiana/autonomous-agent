export function generateFromSchema(schema) {
  if (!schema?.properties) return {};
  
  const obj = {};
  
  for (const key in schema.properties) {
    const prop = schema.properties[key];
    
    if (prop.type === "number") obj[key] = 1;
    if (prop.type === "string") obj[key] = "test";
    if (prop.type === "boolean") obj[key] = true;
  }
  
  return obj;
}

export function buildTestCases(skill) {
  const tests = [];
  
  const schema = skill.input_schema || skill.output_schema || {};
  const inputSchema = skill.input_schema || {};
  const base = generateFromSchema(inputSchema);
  
  tests.push({
    input: base,
    expected: null
  });
  
  tests.push({
    input: {},
    expected: null
  });
  
  tests.push({
    input: null,
    expected: null
  });

  if (schema.properties) {
    const props = schema.properties;
    
    for (const [key, schemaDef] of Object.entries(props)) {
      if (schemaDef.type === "number") {
        tests.push({ input: { [key]: 0 }, expected: null });
        tests.push({ input: { [key]: 1 }, expected: null });
        tests.push({ input: { [key]: -1 }, expected: null });
      }
      
      if (schemaDef.type === "string") {
        tests.push({ input: { [key]: "" }, expected: null });
        tests.push({ input: { [key]: "test" }, expected: null });
      }
      
      if (schemaDef.type === "boolean") {
        tests.push({ input: { [key]: true }, expected: null });
        tests.push({ input: { [key]: false }, expected: null });
      }
    }
  }

  return tests;
}

export function buildEdgeCases(skill) {
  const tests = [];

  tests.push({ input: null });
  tests.push({ input: undefined });
  tests.push({ input: [] });
  tests.push({ input: "" });
  tests.push({ input: 0 });

  return tests;
}

export function buildRandomFuzz(skill, count = 5) {
  const tests = [];

  for (let i = 0; i < count; i++) {
    const input = {};
    
    if (skill.output_schema?.properties) {
      for (const [key, schema] of Object.entries(skill.output_schema.properties)) {
        if (schema.type === "number") {
          input[key] = Math.floor(Math.random() * 100) - 50;
        } else if (schema.type === "string") {
          input[key] = Math.random().toString(36).slice(2);
        } else if (schema.type === "boolean") {
          input[key] = Math.random() > 0.5;
        }
      }
    }

    tests.push({ input });
  }

  return tests;
}

export async function testSkill(skill, runDSL) {
  const tests = buildTestCases(skill);

  let passed = 0;
  const failures = [];

  for (const t of tests) {
    try {
      const res = await runDSL(skill, t.input);

      if (skill.output_schema) {
        const valid = validateSkillOutput(skill.output_schema, res);
        if (valid) {
          passed++;
        } else {
          failures.push({ input: t.input, res, errors: valid.errors });
        }
      } else {
        passed++;
      }
    } catch (e) {
      failures.push({ input: t.input, error: e.message });
    }
  }

  return {
    passRate: passed / tests.length,
    passed,
    total: tests.length,
    failures
  };
}

function validateSkillOutput(schema, output) {
  const errors = [];
  
  if (schema.required) {
    for (const field of schema.required) {
      if (output[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function logFailureDetails(failures) {
  if (failures.length === 0) {
    return "No failures";
  }
  
  return failures.map((f, i) => {
    let detail = `Test ${i + 1}:`;
    if (f.error) {
      detail += ` Error: ${f.error}`;
    } else if (f.errors) {
      detail += ` Errors: ${f.errors.join(", ")}`;
    }
    detail += ` Input: ${JSON.stringify(f.input)}`;
    return detail;
  }).join("\n");
}