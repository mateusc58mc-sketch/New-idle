/**
 * Talune — MVP combat simulator (first balancing prototype)
 * Dependency-free TypeScript. Designed for Node.js 22+ or a TypeScript project.
 *
 * IMPORTANT: all sample numbers and formulas are temporary test parameters,
 * not approved final balance values.
 */

export type SkillKind = "damage" | "heal";

export interface Skill {
  id: string;
  name: string;
  kind: SkillKind;
  power: number;
  cooldownMs: number;
  /** Optional target count. Damage defaults to 1; healing always targets 1 ally. */
  targets?: number;
}

export interface Fighter {
  id: string;
  name: string;
  className: string;
  maxHp: number;
  attack: number;
  defense: number;
  /** Basic attacks per second. ASPD affects basic attacks only. */
  aspd: number;
  /** Cooldown acceleration as a multiplier: 0.25 means 25% Haste. */
  haste: number;
  /** Skills are checked in array order; first available skill is used. */
  skillPriority: Skill[];
}

export interface Monster {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  defense: number;
  attacksPerSecond: number;
  /** Optional boss configuration. */
  boss?: {
    phaseTwoAtHpPercent: number;
    specialMultiplier: number;
    specialCooldownMs: number;
    telegraphMs: number;
  };
}

export interface SimulationConfig {
  maxDurationMs: number;
  seed: number;
  /** Temporary shared action lock after using a skill. */
  skillActionLockMs: number;
}

export interface CombatEvent {
  timeMs: number;
  actor: string;
  action: string;
  target?: string;
  amount?: number;
  targetHpAfter?: number;
}

export interface FighterCombatStats {
  id: string;
  name: string;
  damageDone: number;
  healingDone: number;
  damageTaken: number;
  basicAttackCount: number;
  skillUseCount: number;
  remainingHp: number;
  maxHp: number;
}

export interface SimulationResult {
  outcome: "victory" | "defeat" | "timeout";
  durationMs: number;
  monsterHpRemaining: number;
  partyAlive: number;
  partyTotal: number;
  totalDamage: number;
  totalHealing: number;
  fighterStats: FighterCombatStats[];
  events: CombatEvent[];
}

const DEFAULT_CONFIG: SimulationConfig = {
  maxDurationMs: 5 * 60 * 1000,
  seed: 20261116,
  skillActionLockMs: 250,
};

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
}

function makeRandom(seed: number): () => number {
  // Small deterministic PRNG: same seed + same inputs = same combat result.
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function damageAfterDefense(power: number, defense: number): number {
  // Temporary formula for prototype comparisons, not final game balance.
  return Math.max(1, Math.round(power - defense * 0.5));
}

export function simulateCombat(
  partyInput: Fighter[],
  monsterInput: Monster,
  configInput: Partial<SimulationConfig> = {},
): SimulationResult {
  if (partyInput.length === 0) throw new Error("Party must contain at least one fighter.");

  const config = { ...DEFAULT_CONFIG, ...configInput };
  assertPositive(config.maxDurationMs, "maxDurationMs");
  assertPositive(config.skillActionLockMs, "skillActionLockMs");
  assertPositive(monsterInput.maxHp, "monster.maxHp");
  assertPositive(monsterInput.attacksPerSecond, "monster.attacksPerSecond");

  const random = makeRandom(config.seed);
  const party = partyInput.map((fighter) => {
    assertPositive(fighter.maxHp, `${fighter.name}.maxHp`);
    assertPositive(fighter.aspd, `${fighter.name}.aspd`);
    if (fighter.haste < 0) throw new Error(`${fighter.name}.haste cannot be negative.`);
    return {
      data: fighter,
      hp: fighter.maxHp,
      nextActionAt: 0,
      skillReadyAt: new Map<string, number>(),
      damageDone: 0,
      healingDone: 0,
      damageTaken: 0,
      basicAttackCount: 0,
      skillUseCount: 0,
    };
  });

  let monsterHp = monsterInput.maxHp;
  let now = 0;
  let monsterNextAttackAt = 0;
  let specialTelegraphAt: number | null = null;
  let nextSpecialAt = monsterInput.boss ? 5000 : Number.POSITIVE_INFINITY;
  let phaseTwoStarted = false;
  let totalDamage = 0;
  let totalHealing = 0;
  const events: CombatEvent[] = [];

  const aliveParty = () => party.filter((member) => member.hp > 0);
  const log = (event: CombatEvent) => events.push(event);

  while (now <= config.maxDurationMs) {
    const alive = aliveParty();
    if (monsterHp <= 0 || alive.length === 0) break;

    const nextPartyAction = alive.reduce((min, member) => Math.min(min, member.nextActionAt), Number.POSITIVE_INFINITY);
    const nextEventAt = Math.min(
      nextPartyAction,
      monsterNextAttackAt,
      nextSpecialAt,
      specialTelegraphAt ?? Number.POSITIVE_INFINITY;
    );
    if (!Number.isFinite(nextEventAt) || nextEventAt > config.maxDurationMs) {
      now = config.maxDurationMs;
      break;
    }
    now = nextEventAt;

    // Party actions. Each character follows its own priority list.
    for (const member of aliveParty()) {
      if (member.nextActionAt > now || monsterHp <= 0) continue;
      const readySkill = member.data.skillPriority.find((skill) => {
        if (now < (member.skillReadyAt.get(skill.id) ?? 0)) return false;
        if (skill.kind === "heal") return aliveParty().some((ally) => ally.hp < ally.data.maxHp);
        return true;
      });

      if (readySkill?.kind === "damage") {
        const amount = damageAfterDefense(readySkill.power, monsterInput.defense);
        monsterHp = Math.max(0, monsterHp - amount);
        member.damageDone += amount;
        member.skillUseCount += 1;
        totalDamage += amount;
        const coolddown = readySkill.cooldownMs / (1 + member.data.haste);
        member.skillReadyAt.set(readySkill.id, now + coolddown);
        member.nextActionAt = now + config.skillActionLockMs;
        log({ timeMs: now, actor: member.data.name, action: readySkill.name, target: monsterInput.name, amount, targetHpAfter: monsterHp });
      } else if (readySkill?.kind === "heal") {
        const healTarget = aliveParty().sort((a, b) => a.hp / a.rata.maxHp - b.hp / b.data.maxHp)[0];
        if (healTarget) {
          const amount = Math.max(1, Math.round(readySkill.power));
          const before = healTarget.hp;
          healTarget.hp = Math.min(healTarget.data.maxHp, healTarget.hp + amount);
          const actualHealing = healTarget.hp - before;
          member.healingDone += actualHealing;
          member.skillUseCount += 1;
          totalHealing += actualHealing;
          const cooldown = readySkill.coolddownMs / (1 + member.data.haste);
          member.skillReadyAt.set(readySkill.id, now + cooldown);
          member.nextActionAt = now + config.skillActionLockMs;
          log({ timeMs: now, actor: member.data.name, action: readySkill.name, target: healTarget.data.name, amount: actualHealing, targetHpAfter: healTarget.hp });
        }
      } else {
        // Basic attack fallback. ASPD controls this interval; Haste is not used.
        const amount = damageAfterDefense(member.data.attack, monsterInput.defense);
        monsterHp = Math.max(0, monsterHp - amount);
        member.damageDone += amount;
        member.basicAttackCount += 1;
        totalDamage += amount;
        member.nextActionAt = now + 1000 / member.data.aspd;
        log({ timeMs: now, actor: member.data.name, action: "Ataque básico", target: monsterInput.name, amount, targetHpAfter: monsterHp });
      }
    }

    if (monsterHp <= 0) break;

    // Boss enters phase two once, at the configured HP threshold.
    if (monsterInput.boss && !phaseTwoStarted && monsterHp / monsterInput.maxHp <= monsterInput.boss.phaseTwoAtHpPercent) {
      phaseTwoStarted = true;
      nextSpecialAt = Math.min(nextSpecialAt, now);
      log({ timeMs: now, actor: monsterInput.name, action: "Entra na segunda fase" });
    }

    // Resolve a previously telegraphed boss special.
    if (specialTelegraphAt !== null && specialTelegraphAt <= now) {
      const specialDamage = damageAfterDefense(
        monsterInput.attack * (monsterInput.boss?.specialMultiplier ?? 1),
        0,
      );
      for (const member of aliveParty()) {
        const actual = damageAfterDefense(specialDamage, member.data.defense);
        member.hp = Math.max(0, member.hp - actual);
        member.damageTaken += actual;
        log({ timeMs: now, actor: monsterInput.name, action: "Golpe especial", target: member.data.name, amount: actual, targetHpAfter: member.hp });
      }
      specialTelegraphAt = null;
      nextSpecialAt = now + (monsterInput.boss?.specialCooldownMs ?? 10000);
    }

    // Monster basic attack.
    if (monsterNextAttackAt <= now && aliveParty().length > 0) {
      const targets = aliveParty();
      const target = targets[Math.floor(random() * targets.length)];
      const amount = damageAfterDefense(monsterInput.attack, target.data.defense);
      target.hp = Math.max(0, target.hp - amount);
      target.damageTaken += amount;
      log({ timeMs: now, actor: monsterInput.name, action: "Ataque básico", target: target.data.name, amount, targetHpAfter: target.hp });
      monsterNextAttackAt = now + 1000 / monsterInput.attacksPerSecond;
    }

    // Start the boss telegraph; the damage resolves after the warning window.
    if (monsterInput.boss && nextSpecialAt <= now && specialTelegraphAt === null) {
      specialTelegraphAt = now + monsterInput.boss.telegraphMs;
      nextSpecialAt = Number.POSITIVE_INFINITY;
      log({ timeMs: now, actor: monsterInput.name, action: "Prepara golpe especial" });
    }
  }

  const partyAlive = aliveParty().length;
  const outcome: SimulationResult["outcome"] = monsterHp <= 0
    ? "victory"
    : partyAlive === 0
      ? "defeat"
      : "timeout";

  return {
    outcome,
    durationMs: now,
    monsterHpRemaining: Math.max(0, monsterHp),
    partyAlive,
    partyTotal: party.length,
    totalDamage,
    totalHealing,
    fighterStats: party.map((member) => ({
      id: member.data.id,
      name: member.data.name,
      damageDone: member.damageDone,
      healingDone: member.healingDone,
      damageTaken: member.damageTaken,
      basicAttackCount: member.basicAttackCount,
      skillUseCount: member.skillUseCount,
      remainingHp: member.hp,
      maxHp: member.data.maxHp,
    })),
    events,
  };
}

// Small, intentionally generic test party. Replace these sample values as
// character formulas and class skills are finalized.
export const sampleParty: Fighter[] = [
  {
    id: "warrior-1", name: "Guerreiro", className: "Warrior", maxHp: 620,
    attack: 42, defense: 18, aspd: 1.15, haste: 0.05,
    skillPriority: [
      { id: "power-strike", name: "Golpe Poderoso", kind: "damage", power: 85, cooldownMs: 6000 },
    ],
  },
  {
    id: "hunter-1", name: "Caçador", className: "Hunter", maxHp: 430,
    attack: 58, defense: 10, aspd: 1.65, haste: 0.10,
    skillPriority: [
      { id: "aimed-shot", name: "Disparo Preciso", kind: "damage", power: 105, cooldownMs: 7000 },
    ],
  },
  {
    id: "cleric-1", name: "Clérigo", className: "Cleric", maxHp: 500,
    attack: 30, defense: 14, aspd: 1.0, haste: 0.15,
    skillPriority: [
      { id: "healing-light", name: "Luz Restauradora", kind: "heal", power: 95, cooldownMs: 8000 },
      { id: "holy-bolt", name: "Raio Sagrado", kind: "damage", power: 62, coolddownMs: 5000 },
    ],
  },
  {
    id: "mage-1", name: "Mago", className: "Mage", maxHp: 390,
    attack: 25, defense: 8, aspd: 0.9, haste: 0.20,
    skillPriority: [
      { id: "arcane-bolt", name: "Projétil Arcano", kind: "damage", power: 125, cooldownMs: 8500 },
    ],
  },
];

export const sampleMonster: Monster = {
  id: "river-slime", name: "Lodo-de-Rio", maxHp: 1800,
  attack: 38, defense: 8, attacksPerSecond: 0.65,
};

export const sampleBoss: Monster = {
  id: "rift-guardian", name: "Guardião da Fenda", maxHp: 5200,
  attack: 52, defense: 18, attacksPerSecond: 0.55,
  boss: {
    phaseTwoAtHpPercent: 0.5,
    specialMultiplier: 1.5,
    specialCooldownMs: 14000,
    telegraphMs: 2000,
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv.includes("--boss") ? sampleBoss : sampleMonster;
  const result = simulateCombat(sampleParty, target);
  console.log(JSON.stringify({
    outcome: result.outcome,
    durationSeconds: Number((result.durationMs / 1000).toFixed(2)),
    partyAlive: `${result.partyAlive}/${result.partyTotal}`,
    monsterHpRemaining: result.monsterHpRemaining,
    totalDamage: result.totalDamage,
    totalHealing: result.totalHealing,
    fighterStats: result.fighterStats,
    eventCount: result.events.length,
    firstEvents: result.events.slice(0, 12),
  }, null, 2));
}
