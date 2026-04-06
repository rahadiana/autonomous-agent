export function buildTestCases(skill) {
  const tests = [];

  tests.push({ input: {} });

  if (skill.output_schema?.properties) {
    const props = skill.output_schema.properties;
    
    for (const [key, schema] of Object.entries(props)) {
      if (schema.type === "number") {
        tests.push({ input: { [key]: 0 } });
        tests.push({ input: { [key]: 1 } });
        tests.push({ input: { [key]: -1 } });
      }
      
      if (schema.type === "string") {
        tests.push({ input: { [key]: "" } });
        tests.push({ input: { [key]: "test" } });
      }
      
      if (schema.type === "boolean") {
        tests.push({ input: { [key]: true } });
        tests.push({ input: { [key]: false } });
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