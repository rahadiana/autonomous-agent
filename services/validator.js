import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true, verbose: true });

export function validate(schema, data) {
  if (!schema) {
    return { valid: true, errors: [] };
  }
  
  const validateFn = ajv.compile(schema);
  const valid = validateFn(data);
  
  return {
    valid,
    errors: validateFn.errors || []
  };
}

export function validateInput(input, inputSchema) {
  return validate(inputSchema, input);
}

export function validateOutput(output, outputSchema) {
  return validate(outputSchema, output);
}

export function addSchema(name, schema) {
  ajv.addSchema(schema, name);
}