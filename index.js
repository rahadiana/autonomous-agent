import { sequelize } from "./db.js";
import { Skill } from "./models/skill.js";
import { handleRequest } from "./services/skillService.js";
import { v4 as uuid } from "uuid";

await sequelize.sync();

const existing = await Skill.findOne({ where: { name: "add_numbers" } });

if (!existing) {
  await Skill.create({
    id: uuid(),
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
    created_at: new Date()
  });

  console.log("Seeded skill: add_numbers");
}

const result = await handleRequest(
  { a: 10, b: 5 },
  "math.add"
);

console.log("RESULT:", result);

await sequelize.close();
