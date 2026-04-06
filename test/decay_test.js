import { createAgentCoordinator } from "../core/coordinator.js";
import { applyDecay, shouldPrune, computeEpisodeWeight } from "../core/experienceWeight.js";

console.log("=== DECAY & PRUNING TEST ===\n");

const coordinator = createAgentCoordinator({
  maxIterations: 1,
  learningEnabled: true,
  decayEnabled: true,
  pruneEnabled: true
});

coordinator.registerSkill({
  name: "add",
  capability: "math.add",
  logic: [{ op: "set", path: "output.result", value: "input.a + input.b" }]
});

console.log("--- Creating old low-quality episodes ---");
coordinator.episodicMemory.episodes.set("old_bad", {
  id: "old_bad",
  goal: "old bad",
  score: 0.3,
  confidence: 0.2,
  usage_count: 1,
  created_at: Date.now() - 10 * 24 * 60 * 60 * 1000,
  last_used_at: Date.now() - 10 * 24 * 60 * 60 * 1000
});

console.log("  Old bad before decay:", coordinator.episodicMemory.episodes.get("old_bad").score);
applyDecay(coordinator.episodicMemory.episodes.get("old_bad"), { decayRate: 0.03 });
console.log("  Old bad after decay:", coordinator.episodicMemory.episodes.get("old_bad").score.toFixed(3));

console.log("\n  Should prune?", shouldPrune(coordinator.episodicMemory.episodes.get("old_bad")));

console.log("\n--- Creating good high-quality episode ---");
coordinator.episodicMemory.episodes.set("good_one", {
  id: "good_one",
  goal: "good goal",
  score: 0.9,
  confidence: 0.8,
  usage_count: 10,
  created_at: Date.now() - 1 * 24 * 60 * 60 * 1000,
  last_used_at: Date.now() - 1 * 60 * 60 * 1000
});

console.log("  Good before decay:", coordinator.episodicMemory.episodes.get("good_one").score);
applyDecay(coordinator.episodicMemory.episodes.get("good_one"), { decayRate: 0.03 });
console.log("  Good after decay:", coordinator.episodicMemory.episodes.get("good_one").score.toFixed(3));

console.log("\n  Should prune?", shouldPrune(coordinator.episodicMemory.episodes.get("good_one")));

console.log("\n--- Weight Comparison ---");
const badWeight = computeEpisodeWeight(coordinator.episodicMemory.episodes.get("old_bad"));
const goodWeight = computeEpisodeWeight(coordinator.episodicMemory.episodes.get("good_one"));
console.log("  Bad weight:", badWeight.toFixed(3));
console.log("  Good weight:", goodWeight.toFixed(3));

console.log("\n=== DONE ===");
