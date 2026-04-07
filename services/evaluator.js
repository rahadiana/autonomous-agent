import { validate } from "./validator.js";

export class Evaluator {
  constructor() {
    this.weights = {
      correctness: 0.4,
      schema: 0.2,
      reuse: 0.2,
      efficiency: 0.2
    };
    this.threshold = 0.8;
    this.maxIterations = 3;
  }

  evaluate(result, validation, skill) {
    let score = 0;

    if (validation.valid) {
      score += this.weights.schema * 1;
    }

    if (result !== undefined && result !== null) {
      score += this.weights.correctness * 1;
    }

    score += this.weights.reuse * this.evaluateReuse(skill);

    score += this.weights.efficiency * this.evaluateEfficiency(result);

    return {
      score: Math.round(score * 100) / 100,
      passed: score > this.threshold,
      breakdown: {
        correctness: result !== undefined ? this.weights.correctness : 0,
        schema: validation.valid ? this.weights.schema : 0,
        reuse: this.evaluateReuse(skill) * this.weights.reuse,
        efficiency: this.evaluateEfficiency(result) * this.weights.efficiency
      }
    };
  }

  evaluateReuse(skill) {
    const hasName = !!skill.name;
    const hasCapability = !!skill.capability;
    const hasLogic = !!skill.logic;
    
    return (hasName && hasCapability && hasLogic) ? 1 : 0.3;
  }

  evaluateEfficiency(result) {
    if (!result) return 0;
    
    const size = JSON.stringify(result).length;
    if (size < 100) return 1;
    if (size < 1000) return 0.7;
    return 0.5;
  }

  shouldAccept(score) {
    return score > this.threshold;
  }

  needsImprovement(score) {
    return score < this.threshold;
  }

  canRetry(iteration) {
    return iteration < this.maxIterations;
  }
}