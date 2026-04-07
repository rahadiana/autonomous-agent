import { runSkill } from "./core/executor.js";

const SANDBOX_TIMEOUT = 5000;

process.on("message", async (msg) => {
  const { skill, input } = msg;
  const timeout = setTimeout(() => {
    process.send({ error: "timeout" });
    process.exit(1);
  }, SANDBOX_TIMEOUT);

  try {
    const result = await runSkill(skill, input);
    clearTimeout(timeout);
    process.send({ result });
  } catch (err) {
    clearTimeout(timeout);
    process.send({ error: err.message });
  }
});
