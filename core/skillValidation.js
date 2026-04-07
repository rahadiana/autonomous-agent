/**
 * Hard Validation for Skill Registration
 * 
 * Implements validation from next_plan.md (lines 186-210):
 * - DSL structure validation
 * - Input/Output schema validation
 * - Evaluation score validation
 * - No bypass allowed
 */

import { validate } from "./validator.js";

const MIN_SCORE_THRESHOLD = 0.8;

/**
 * Validate skill before saving - HARD validation
 * Returns { valid, errors } - if not valid, skill should be REJECTED
 */
export function validateSkillForSave(skill) {
  const errors = [];

  // 1. Check DSL structure
  if (!skill.logic) {
    errors.push("Missing skill.logic");
  } else if (Array.isArray(skill.logic)) {
    // Validate DSL steps
    const dslErrors = validateDSL(skill.logic);
    if (dslErrors.length > 0) {
      errors.push(`DSL validation failed: ${dslErrors.join(", ")}`);
    }
  } else if (typeof skill.logic === "string") {
    // String-based logic - check for dangerous code
    if (containsDangerousCode(skill.logic)) {
      errors.push("Dangerous code detected in skill logic");
    }
  }

  // 2. Validate input schema
  if (skill.input_schema) {
    const inputValidation = validate(skill.input_schema, skill.input_schema);
    if (!inputValidation.valid) {
      errors.push(`Invalid input_schema: ${inputValidation.errors.join(", ")}`);
    }
  }

  // 3. Validate output schema
  if (skill.output_schema) {
    const outputValidation = validate(skill.output_schema, skill.output_schema);
    if (!outputValidation.valid) {
      errors.push(`Invalid output_schema: ${outputValidation.errors.join(", ")}`);
    }
  }

  // 4. Validate evaluation score
  if (skill.evaluation) {
    if (skill.evaluation.score < MIN_SCORE_THRESHOLD) {
      errors.push(`Score ${skill.evaluation.score} below threshold ${MIN_SCORE_THRESHOLD}`);
    }
    if (!skill.evaluation.valid) {
      errors.push("Evaluation marked as invalid");
    }
  }

  // 5. Required fields
  if (!skill.capability) {
    errors.push("Missing capability");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate DSL step structure
 */
function validateDSL(logic) {
  const errors = [];
  const allowedOps = new Set([
    "set", "get", "add", "subtract", "multiply", "divide",
    "concat", "mcp_call", "call_skill", "call_skill_map",
    "if", "switch", "for", "for_range", "while", "map", "filter", "reduce", "break", "continue"
  ]);

  for (let i = 0; i < logic.length; i++) {
    const step = logic[i];
    
    if (!step.op) {
      errors.push(`Step ${i}: missing 'op'`);
      continue;
    }

    if (!allowedOps.has(step.op)) {
      errors.push(`Step ${i}: unknown op '${step.op}'`);
    }

    // Validate specific ops
    if (step.op === "set" && !step.path) {
      errors.push(`Step ${i}: set requires 'path'`);
    }
    if (step.op === "if" && !step.condition) {
      errors.push(`Step ${i}: if requires 'condition'`);
    }
    if (step.op === "for" && !step.each) {
      errors.push(`Step ${i}: for requires 'each'`);
    }
  }

  return errors;
}

/**
 * Check for dangerous code patterns
 */
function containsDangerousCode(code) {
  const dangerous = [
    "process", "require", "module", "exports", 
    "__dirname", "__filename", "eval", "Function"
  ];
  
  for (const keyword of dangerous) {
    if (code.includes(keyword)) {
      return true;
    }
  }
  return false;
}