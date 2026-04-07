import { initDB, db } from "./db.js";
import { Skill } from "./models/skill.js";
import { handleRequest } from "./services/skillService.js";

await initDB();

const existing = await db.findByCapability("math.add");

if (!existing) {
  await Skill.create({
    name: "add_numbers",
    capability: "math.add",
    json: {
      logic: "output.result = input.a + input.b;",
      output_schema: {
        type: "object",
        properties: {
          result: { type: "number" }
        },
        required: ["result"]
      }
    },
    score: 0.9,
    created_at: new Date().toISOString()
  });
  console.log("Seeded skill: add_numbers");
}

const result = await handleRequest(
  { a: 10, b: 5 },
  "math.add"
);

console.log("RESULT:", result);