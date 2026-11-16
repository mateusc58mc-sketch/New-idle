import assert from "node:assert/strict";
import { simulateCombat, type Fighter, type Monster } from "./combat-simulator.ts";

const harmlessTarget: Monster = {
  id: "test-dummy",
  name: "Boneco de Teste",
  maxHp: 1_000_000,
  attack: 1,
  defense: 0,
  attacksPerSecond: 0.01,
};

function makeFighter(aspd: number, haste: number, skillPriority: Fighter["skillPriority"] = []): Fighter {
  return {
    id: "test-fighter",
    name: "Personagem de Teste",
    className: "Test",
    maxHp: 100_000,
    attack: 10,
    defense: 100,
    aspd,
    haste,
    skillPriority,
  };
}

// Test 1: higher ASPD increases basic attack count.
const slow = simulateCombat([makeFighter(1, 0)], harmlessTarget, { maxDurationMs: 4000 });
const fast = simulateCombat([makeFighter(2, 0)], harmlessTarget, { maxDurationMs: 4000 });
assert.ok(
  fast.fighterStats[0].basicAttackCount > slow.fighterStats[0].basicAttackCount,
  "Higher ASPD should produce more basic attacks in the same time window.",
);

// Test 2: Haste increases skill uses, but cannot change basic attacks when
// there are no skills to accelerate.
const noSkillLowHaste = simulateCombat([makeFighter(1.5, 0)], harmlessTarget, { maxDurationMs: 4000 });
const noSkillHighHaste = simulateCombat([makeFighter(1.5, 2)], harmlessTarget, { maxDurationMs: 4000 });
assert.equal(
  noSkillHighHaste.fighterStats[0].basicAttackCount,
  noSkillLowHaste.fighterStats[0].basicAttackCount,
  "Haste must not change basic attack count when the fighter has no skills.",
);

const cooldownSkill = [{ id: "test-skill", name: "Habilidade de Teste", kind: "damage" as const, power: 20, cooldownMs: 2000 }];
const lowHaste = simulateCombat([makeFighter(1, 0, cooldownSkill]], harmlessTarget, { maxDurationMs: 5000, skillActionLockMs: 1 });
const highHaste = simulateCombat([makeFighter(1, 1, cooldownSkill)], harmlessTarget, { maxDurationMs: 5000, skillActionLockMs: 1 });
assert.ok(
  highHaste.fighterStats[0].skillUseCount > lowHaste.fighterStats[0].skillUseCount,
  "Higher Haste should allow more skill uses in the same time window.",
);

console.log("PASS: ASPD increases basic attack frequency.");
console.log("PASS: Haste does not change basic attack frequency without skills.");
console.log("PASS: Haste reduces skill cooldowns and increases skill uses.");
