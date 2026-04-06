export function mutateSkill(skill) {
  const clone = JSON.parse(JSON.stringify(skill));

  if (!clone.logic || clone.logic.length === 0) return clone;

  const idx = Math.floor(Math.random() * clone.logic.length);
  const step = clone.logic[idx];

  if (step.op === "add") {
    step.op = Math.random() > 0.5 ? "add" : "subtract";
  }

  return clone;
}
