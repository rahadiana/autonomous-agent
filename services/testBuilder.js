import { v4 as uuid } from "uuid";

export class TestBuilder {
  constructor() {
    this.schemaBuilders = {
      "math.add": this.buildMathAddCases.bind(this),
      "math.subtract": this.buildMathSubtractCases.bind(this),
      "math.multiply": this.buildMathMultiplyCases.bind(this),
      "string.concat": this.buildStringConcatCases.bind(this),
      "array.filter": this.buildArrayFilterCases.bind(this)
    };
  }

  buildTestCases(skill) {
    const capability = skill.capability || skill.json?.capability;
    const builder = this.schemaBuilders[capability];
    
    if (builder) {
      return builder();
    }
    
    return this.buildDefaultCases(capability);
  }

  buildDefaultCases(capability) {
    return [
      { input: {}, expected: {} }
    ];
  }

  buildMathAddCases() {
    return [
      { input: { a: 2, b: 3 }, expected: { result: 5 } },
      { input: { a: -1, b: 1 }, expected: { result: 0 } },
      { input: { a: 0, b: 0 }, expected: { result: 0 } },
      { input: { a: 100, b: 200 }, expected: { result: 300 } }
    ];
  }

  buildMathSubtractCases() {
    return [
      { input: { a: 5, b: 3 }, expected: { result: 2 } },
      { input: { a: 10, b: 10 }, expected: { result: 0 } },
      { input: { a: 0, b: 5 }, expected: { result: -5 } }
    ];
  }

  buildMathMultiplyCases() {
    return [
      { input: { a: 3, b: 4 }, expected: { result: 12 } },
      { input: { a: -2, b: 5 }, expected: { result: -10 } },
      { input: { a: 0, b: 100 }, expected: { result: 0 } }
    ];
  }

  buildStringConcatCases() {
    return [
      { input: { a: "hello", b: " world" }, expected: { result: "hello world" } },
      { input: { a: "", b: "test" }, expected: { result: "test" } },
      { input: { a: "a", b: "b" }, expected: { result: "ab" } }
    ];
  }

  buildArrayFilterCases() {
    return [
      { input: { arr: [1, 2, 3, 4], fn: "x => x > 2" }, expected: { result: [3, 4] } },
      { input: { arr: [5, 10, 15], fn: "x => x < 10" }, expected: { result: [5] } }
    ];
  }

  buildEdgeCases(skill) {
    const capability = skill.capability || skill.json?.capability;
    return [
      { input: {}, expected: null },
      { input: null, expected: null }
    ];
  }
}