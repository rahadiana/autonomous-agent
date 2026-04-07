import test from "node:test";
import assert from "node:assert";
import { runSkill, runDSL } from "../core/executor.js";

test("for loop iterates over array", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.items", value: [1, 2, 3] },
      { op: "set", path: "memory.sum", value: 0 },
      {
        op: "for",
        collection: "items",
        item: "x",
        steps: [
          { op: "add", a: "sum", b: "x", to: "sum" }
        ]
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.sum, 6);
});

test("for loop processes each item", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.items", value: [1, 2, 3] },
      { op: "set", path: "memory.sum", value: 0 },
      {
        op: "for",
        collection: "items",
        item: "x",
        steps: [
          { op: "add", a: "sum", b: "x", to: "sum" }
        ]
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.sum, 6);
});

test("for loop tracks index", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.items", value: ["a", "b", "c"] },
      { op: "set", path: "memory.lastIdx", value: -1 },
      {
        op: "for",
        collection: "items",
        item: "item",
        index: "idx",
        steps: [
          { op: "set", path: "memory.lastIdx", value: "idx" }
        ]
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.memory.lastIdx, 2);
});

test("for_range loops from start to end", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.sum", value: 0 },
      {
        op: "for_range",
        start: 1,
        end: 5,
        item: "i",
        steps: [
          { op: "add", a: "sum", b: "i", to: "sum" }
        ]
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.sum, 10);
});

test("for_range supports custom step size", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.count", value: 0 },
      {
        op: "for_range",
        start: 0,
        end: 10,
        item: "i",
        step: 2,
        steps: [
          { op: "add", a: "count", b: 1, to: "count" }
        ]
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.count, 5);
});

test("while loop executes until condition fails", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.counter", value: 0 },
      {
        op: "while",
        condition: { comparison: { left: "counter", op: "lt", right: 3 } },
        steps: [
          { op: "add", a: "counter", b: 1, to: "counter" }
        ]
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.counter, 3);
});

test("switch matches correct case", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.status", value: "active" },
      {
        op: "switch",
        value: "status",
        cases: {
          active: [{ op: "set", path: "result", value: "is active" }],
          inactive: [{ op: "set", path: "result", value: "is inactive" }],
          default: [{ op: "set", path: "result", value: "unknown" }]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "is active");
});

test("switch falls through to default", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.status", value: "unknown_status" },
      {
        op: "switch",
        value: "status",
        cases: {
          active: [{ op: "set", path: "result", value: "active" }],
          inactive: [{ op: "set", path: "result", value: "inactive" }],
          default: [{ op: "set", path: "result", value: "default" }]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "default");
});

test("map transforms array", async () => {
  const skill = {
    logic: [
      { op: "set", path: "numbers", value: [1, 2, 3, 4] },
      {
        op: "map",
        collection: "numbers",
        item: "n",
        steps: [
          { op: "multiply", a: "n", b: 2, to: "n" }
        ],
        to: "doubled"
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.deepStrictEqual(result.doubled, [2, 4, 6, 8]);
});

test("filter removes items by condition", async () => {
  const skill = {
    logic: [
      { op: "set", path: "numbers", value: [1, 2, 3, 4, 5, 6] },
      {
        op: "filter",
        collection: "numbers",
        item: "n",
        condition: { comparison: { left: "n", op: "gte", right: 4 } },
        to: "filtered"
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.deepStrictEqual(result.filtered, [4, 5, 6]);
});

test("reduce accumulates values", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.numbers", value: [1, 2, 3, 4, 5] },
      {
        op: "reduce",
        collection: "numbers",
        item: "n",
        accumulator: "sum",
        initial: 0,
        steps: [
          { op: "add", a: "sum", b: "n", to: "sum" }
        ],
        to: "total"
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.total, 15);
});

test("comparison operator eq returns true", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.x", value: 5 },
      {
        op: "if",
        condition: { comparison: { left: "x", op: "eq", right: 5 } },
        branches: {
          then: [{ op: "set", path: "result", value: "equal" }]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "equal");
});

test("comparison operator lt returns true", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.x", value: 3 },
      {
        op: "if",
        condition: { comparison: { left: "x", op: "lt", right: 5 } },
        branches: {
          then: [{ op: "set", path: "result", value: "less" }]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "less");
});

test("comparison operator gt returns true", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.x", value: 10 },
      {
        op: "if",
        condition: { comparison: { left: "x", op: "gt", right: 5 } },
        branches: {
          then: [{ op: "set", path: "result", value: "greater" }]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "greater");
});

test("comparison operator in works with arrays", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.x", value: "b" },
      { op: "set", path: "memory.list", value: ["a", "b", "c"] },
      {
        op: "if",
        condition: { comparison: { left: "x", op: "in", right: "list" } },
        branches: {
          then: [{ op: "set", path: "result", value: "found" }]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "found");
});

test("comparison operator typeof works", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.x", value: 42 },
      {
        op: "if",
        condition: { comparison: { left: "x", op: "typeof", right: "number" } },
        branches: {
          then: [{ op: "set", path: "result", value: "is number" }]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "is number");
});

test("nested if-else works", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.score", value: 85 },
      {
        op: "if",
        condition: { comparison: { left: "score", op: "gte", right: 90 } },
        branches: {
          then: [{ op: "set", path: "memory.grade", value: "A" }],
          else: [
            {
              op: "if",
              condition: { comparison: { left: "score", op: "gte", right: 80 } },
              branches: {
                then: [{ op: "set", path: "memory.grade", value: "B" }],
                else: [{ op: "set", path: "memory.grade", value: "C" }]
              }
            }
          ]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.memory.grade, "B");
});

test("nested if-else with else branch", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.score", value: 70 },
      {
        op: "if",
        condition: { comparison: { left: "score", op: "gte", right: 90 } },
        branches: {
          then: [{ op: "set", path: "memory.grade", value: "A" }],
          else: [
            {
              op: "if",
              condition: { comparison: { left: "score", op: "gte", right: 80 } },
              branches: {
                then: [{ op: "set", path: "memory.grade", value: "B" }],
                else: [{ op: "set", path: "memory.grade", value: "C" }]
              }
            }
          ]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.memory.grade, "C");
});

test("for loop with object values", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.users", value: [{ name: "Alice" }, { name: "Bob" }] },
      { op: "set", path: "memory.lastName", value: "" },
      {
        op: "for",
        collection: "users",
        item: "u",
        steps: [
          { op: "set", path: "memory.lastName", value: "u" }
        ]
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.ok(result.memory.lastName);
});

test("while loop with counter and condition", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.i", value: 0 },
      { op: "set", path: "memory.factorial", value: 1 },
      {
        op: "while",
        condition: { comparison: { left: "i", op: "lt", right: 5 } },
        steps: [
          { op: "add", a: "i", b: 1, to: "i" },
          { op: "multiply", a: "factorial", b: "i", to: "factorial" }
        ]
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.factorial, 120);
});

test("map with string concatenation", async () => {
  const skill = {
    logic: [
      { op: "set", path: "words", value: ["hello", "world", "test"] },
      {
        op: "map",
        collection: "words",
        item: "w",
        steps: [
          { op: "concat", a: "w", b: "!", to: "w" }
        ],
        to: "exclaimed"
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.deepStrictEqual(result.exclaimed, ["hello!", "world!", "test!"]);
});

test("filter with string type check", async () => {
  const skill = {
    logic: [
      { op: "set", path: "items", value: [1, "two", 3, "four"] },
      {
        op: "filter",
        collection: "items",
        var: "x",
        condition: { comparison: { left: "x", op: "typeof", right: "string" } },
        to: "strings"
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.deepStrictEqual(result.strings, ["two", "four"]);
});

test("reduce with string concatenation", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.words", value: ["hello", " ", "world"] },
      {
        op: "reduce",
        collection: "words",
        item: "w",
        accumulator: "result",
        initial: "",
        steps: [
          { op: "concat", a: "result", b: "w", to: "result" }
        ],
        to: "joined"
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.joined, "hello world");
});

test("complex pipeline: filter then map", async () => {
  const skill = {
    logic: [
      { op: "set", path: "numbers", value: [1, 2, 3, 4, 5, 6, 7, 8] },
      {
        op: "filter",
        collection: "numbers",
        item: "n",
        condition: { comparison: { left: "n", op: "lte", right: 5 } },
        to: "filtered"
      },
      {
        op: "map",
        collection: "filtered",
        item: "n",
        steps: [
          { op: "multiply", a: "n", b: 10, to: "n" }
        ],
        to: "final"
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.deepStrictEqual(result.final, [10, 20, 30, 40, 50]);
});

test("comparison operator neq returns true", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.x", value: 5 },
      {
        op: "if",
        condition: { comparison: { left: "x", op: "neq", right: 10 } },
        branches: {
          then: [{ op: "set", path: "result", value: "not equal" }]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "not equal");
});

test("comparison operator lte returns true for equal values", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.x", value: 5 },
      {
        op: "if",
        condition: { comparison: { left: "x", op: "lte", right: 5 } },
        branches: {
          then: [{ op: "set", path: "result", value: "ok" }]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "ok");
});

test("comparison operator gte returns true for equal values", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.x", value: 5 },
      {
        op: "if",
        condition: { comparison: { left: "x", op: "gte", right: 5 } },
        branches: {
          then: [{ op: "set", path: "result", value: "ok" }]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, "ok");
});

test("for loop prevents infinite iteration with MAX_LOOP", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.items", value: new Array(20000).fill(1) },
      { op: "set", path: "memory.count", value: 0 },
      {
        op: "for",
        collection: "items",
        item: "x",
        steps: [
          { op: "add", a: "count", b: 1, to: "count" }
        ]
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.count, 10000);
});

test("while loop prevents infinite iteration with MAX_LOOP", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.i", value: 0 },
      {
        op: "while",
        condition: { comparison: { left: "i", op: "gte", right: 0 } },
        steps: [
          { op: "add", a: "i", b: 1, to: "i" }
        ]
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.i, 10000);
});

test("switch with no matching case and no default", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.status", value: "unknown" },
      {
        op: "switch",
        value: "status",
        cases: {
          active: [{ op: "set", path: "memory.result", value: "active" }]
        }
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.result, undefined);
});

test("for loop over object values", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.obj", value: { a: 1, b: 2, c: 3 } },
      { op: "set", path: "memory.sum", value: 0 },
      {
        op: "for",
        collection: "obj",
        item: "val",
        steps: [
          { op: "add", a: "sum", b: "val", to: "sum" }
        ]
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.sum, 6);
});

test("filter returns empty array when no match", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.numbers", value: [1, 2, 3] },
      {
        op: "filter",
        collection: "numbers",
        item: "n",
        condition: { comparison: { left: "n", op: "gt", right: 100 } },
        to: "filtered"
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.deepStrictEqual(result.filtered, []);
});

test("map over empty array returns empty array", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.empty", value: [] },
      {
        op: "map",
        collection: "empty",
        item: "x",
        steps: [
          { op: "add", a: "x", b: 1, to: "y" }
        ],
        result: "y",
        to: "mapped"
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.deepStrictEqual(result.mapped, []);
});

test("reduce with single element", async () => {
  const skill = {
    logic: [
      { op: "set", path: "memory.numbers", value: [42] },
      {
        op: "reduce",
        collection: "numbers",
        item: "n",
        accumulator: "sum",
        initial: 0,
        steps: [
          { op: "add", a: "sum", b: "n", to: "sum" }
        ],
        to: "total"
      }
    ]
  };

  const result = await runSkill(skill, {});
  assert.strictEqual(result.total, 42);
});
