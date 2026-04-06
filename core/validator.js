import Ajv from "ajv";

const ajv = new Ajv();

export function validate(schema, data) {
  const v = ajv.compile(schema);
  const valid = v(data);

  return {
    valid,
    errors: v.errors || []
  };
}
