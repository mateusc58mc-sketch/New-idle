/**
 * Fórmulas de combate — tradução literal da wiki.
 *
 * Todas as funções são puras e sem estado: recebem números, devolvem números.
 * Nada de `Math.random()` aqui (o RNG vem de fora, para determinismo).
 *
 * Fontes:
 *  · Sistemas, Atributos e Progressão (tabelas de atributos e derivados)
 *  · Combate e Atributos (dano e mitigação)
 *  · Drops e Itens (refino +1..+15, 5% por nível)
 */
import type { Element, MonsterRace, MonsterSize, MonsterTier } from '@/types/game';
import { BALANCE } from './balance';

const S = BALANCE.stats;

/** Protecção contra NaN/Infinity em toda a fronteira numérica. */
export function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/** `floor(n)` sem negativos acidentais. */
export function floorNonNegative(value: number): number {
  const v = Math.floor(safeNumber(value));
  return v < 0 ? 0 : v;
}

/* ==========================================================================
 * ATK / MATK
 * ========================================================================== */

/**
 * ATK físico:
 *   arma × (1 + refino × 5%) + STR + floor(STR/10)² + floor(DEX/5) + floor(LUK/5)
 */
export function computeAtk(input: {
  readonly weaponAtk: number;
  readonly refineLevel: number;
  readonly str: number;
  readonly dex: number;
  readonly luk: number;
}): number {
  const { weaponAtk, refineLevel, str, dex, luk } = input;
  const refineMultiplier = 1 + floorNonNegative(refineLevel) * S.atk.refineBonusPct;
  const strQuadratic = Math.pow(floorNonNegative(str / S.atk.strQuadraticDivisor), 2);
  const atk =
    safeNumber(weaponAtk) * refineMultiplier +
    safeNumber(str) * S.atk.strFlat +
    strQuadratic +
    floorNonNegative(dex / S.atk.dexDivisor) +
    floorNonNegative(luk / S.atk.lukDivisor);
  return Math.max(1, Math.round(atk));
}

/**
 * MATK mágico:
 *   INT + floor(INT/7)² + MATK da arma × (1 + refino × 5%)
 */
export function computeMatk(input: {
  readonly weaponMatk: number;
  readonly refineLevel: number;
  readonly int: number;
}): number {
  const { weaponMatk, refineLevel, int } = input;
  const refineMultiplier = 1 + floorNonNegative(refineLevel) * S.matk.refineBonusPct;
  const intQuadratic = Math.pow(floorNonNegative(int / S.matk.intQuadraticDivisor), 2);
  const matk = safeNumber(int) * S.matk.intFlat + intQuadratic + safeNumber(weaponMatk) * refineMultiplier;
  return Math.max(1, Math.round(matk));
}

/** Variação de ±10% por golpe no MATK (para os números não ficarem mortos). */
export function applyMatkVariance(matk: number, roll: number): number {
  const variance = S.matk.variancePct;
  const factor = 1 - variance + safeNumber(roll) * variance * 2;
  return Math.max(1, Math.round(matk * factor));
}

/* ==========================================================================
 * HIT / FLEE / CRIT / ASPD
 * ========================================================================== */

export function computeHit(input: { readonly level: number; readonly dex: number; readonly bonus: number }): number {
  return floorNonNegative(
    safeNumber(input.level) * S.hit.levelWeight + safeNumber(input.dex) * S.hit.dexWeight + safeNumber(input.bonus),
  );
}

export function computeFlee(input: { readonly level: number; readonly agi: number; readonly bonus: number }): number {
  return floorNonNegative(
    safeNumber(input.level) * S.flee.levelWeight + safeNumber(input.agi) * S.flee.agiWeight + safeNumber(input.bonus),
  );
}

/**
 * Chance de acerto = 80% + HIT do atacante − FLEE do alvo, limitada a 5%..100%.
 * O FLEE do alvo é a *percentagem de esquiva*, logo entra já em pontos percentuais.
 */
export function computeHitChance(hit: number, flee: number): number {
  const fleePct = Math.min(safeNumber(flee) / 100, S.flee.maxPct);
  const chance = S.hitChance.basePct + safeNumber(hit) / 100 - fleePct;
  return clamp(chance, S.hitChance.minPct, S.hitChance.maxPct);
}

/** FLEE efectivo cai 10% por cada atacante extra além do segundo. */
export function applyFleePenalty(flee: number, attackerCount: number): number {
  const extras = Math.max(0, floorNonNegative(attackerCount) - 2);
  const factor = Math.max(0, 1 - extras * S.flee.penaltyPerExtraAttacker);
  return Math.max(0, Math.round(safeNumber(flee) * factor));
}

/** CRIT = 1 + LUK × 0.3 + bónus, em percentagem, teto 100%. */
export function computeCrit(luk: number, bonus = 0): number {
  const critPct = S.crit.base + safeNumber(luk) * S.crit.lukMultiplier + safeNumber(bonus);
  return clamp(critPct, 0, S.crit.maxPct * 100);
}

/** Ataques por segundo = base da classe × (1 + AGI×1% + DEX×0.2%), teto 2.5. */
export function computeAttackSpeed(input: {
  readonly baseAttacksPerSec: number;
  readonly agi: number;
  readonly dex: number;
}): number {
  const multiplier = 1 + safeNumber(input.agi) * S.attackSpeed.agiPct + safeNumber(input.dex) * S.attackSpeed.dexPct;
  return clamp(safeNumber(input.baseAttacksPerSec) * multiplier, 0.1, S.attackSpeed.maxAttacksPerSec);
}

/** Segundos entre auto-ataques (o loop consome isto directamente). */
export function attackIntervalSec(attacksPerSec: number): number {
  return 1 / Math.max(0.1, safeNumber(attacksPerSec, 0.1));
}

/** MaxHP = HP base por nível × (1 + VIT × 1%). */
export function computeMaxHp(baseHp: number, vit: number): number {
  return Math.max(1, Math.round(safeNumber(baseHp) * (1 + safeNumber(vit) * S.maxHp.vitPct)));
}

/** Tempo de conjuração = base × (1 − DEX/150), mínimo 0. */
export function computeCastTime(baseCastSec: number, dex: number): number {
  const factor = 1 - safeNumber(dex) / S.castTime.dexDivisor;
  return Math.max(0, safeNumber(baseCastSec) * Math.max(0, factor));
}

/** Cura recebida +1% a cada 5 pontos de VIT. */
export function computeHealReceivedBonus(vit: number): number {
  return 1 + floorNonNegative(vit / S.healReceived.vitDivisor) * 0.01;
}

/* ==========================================================================
 * MITIGAÇÃO E DANO FINAL
 * ========================================================================== */

/**
 * DEF "macia" — a wiki deixa `HP / Defesa` em aberto e marca-a como ambígua.
 * Usamos a curva assimptótica clássica: redução = def / (def + k).
 * Nunca chega a 100%, o que impede builds invulneráveis no idle.
 */
export function softDefReduction(def: number): number {
  const d = Math.max(0, safeNumber(def));
  return d / (d + S.softDef.k);
}

/** Aplica DEF (física) ou MDEF (mágica) ao dano bruto. */
export function mitigate(rawDamage: number, defence: number): number {
  const reduction = softDefReduction(defence);
  return Math.max(1, Math.round(safeNumber(rawDamage) * (1 - reduction)));
}

/**
 * Multiplicador de elemento atacante → alvo.
 * Usa a tabela de `elementAffinity`; fallback 1.
 */
export function elementMultiplier(attacker: Element, defender: Element | MonsterRace): number {
  const table: Partial<Record<Element, Partial<Record<Element | MonsterRace, number>>>> = BALANCE.elementAffinity;
  const row = table[attacker];
  if (!row) return 1;
  const value = row[defender];
  return typeof value === 'number' ? value : 1;
}

/** % de dano por tipo de arma vs. tamanho do alvo. */
export function weaponSizeMultiplier(weaponType: string, size: MonsterSize): number {
  const table: Partial<Record<string, Record<MonsterSize, number>>> = BALANCE.weaponSizeModifier;
  return table[weaponType]?.[size] ?? 1;
}

/** Multiplicador por tier (normal/elite/boss). */
export function tierMultiplier(tier: MonsterTier): number {
  return BALANCE.tierModifier[tier];
}

/**
 * Pipeline completo de dano de um golpe.
 *
 * ordem: base × multiplicadores de elemento/tamanho/tier × (1 + bónus% do
 * atacante) × (crítico?) → mitigação → teto de AoE → mínimo 1.
 */
export interface DamageInput {
  readonly rawDamage: number;
  readonly attackerElement: Element;
  readonly defenderElement: Element;
  readonly defenderRace: MonsterRace;
  readonly defenderSize: MonsterSize;
  readonly defenderTier: MonsterTier;
  readonly weaponType: string | null;
  readonly defence: number;
  readonly isCrit: boolean;
  readonly isAoe: boolean;
  readonly defenderMaxHp: number;
  readonly damageBonusPct: number;
}

export interface DamageResult {
  readonly amount: number;
  readonly mitigated: number;
  readonly capped: boolean;
  readonly breakdown: Readonly<Record<string, number>>;
}

export function computeDamage(input: DamageInput): DamageResult {
  const elem = elementMultiplier(input.attackerElement, input.defenderElement);
  const elemRace = elementMultiplier(input.attackerElement, input.defenderRace);
  const size = input.weaponType ? weaponSizeMultiplier(input.weaponType, input.defenderSize) : 1;
  const tier = tierMultiplier(input.defenderTier);
  const crit = input.isCrit ? S.crit.damageMultiplier : 1;
  const bonus = 1 + safeNumber(input.damageBonusPct);

  const scaled = safeNumber(input.rawDamage) * elem * elemRace * size * tier * crit * bonus;
  const mitigated = mitigate(scaled, input.defence);

  const cap = input.isAoe ? Math.max(1, Math.floor(safeNumber(input.defenderMaxHp) * BALANCE.combat.aoeDamageCapPct)) : Infinity;
  const capped = mitigated > cap;
  const amount = Math.max(1, Math.min(mitigated, cap));

  return {
    amount,
    mitigated,
    capped,
    breakdown: {
      raw: Math.round(safeNumber(input.rawDamage)),
      element: elem,
      elementRace: elemRace,
      size,
      tier,
      crit,
      bonus,
      defence: safeNumber(input.defence),
    },
  };
}

/* ==========================================================================
 * XP E NÍVEL
 * ========================================================================== */

/** XP necessário para sair do nível `level`: base × 1.15 ^ level. */
export function expForLevel(level: number): number {
  const lvl = Math.max(0, floorNonNegative(level));
  return Math.round(BALANCE.progression.expBase * Math.pow(BALANCE.progression.expGrowthFactor, lvl));
}

export interface LevelUpResult {
  readonly level: number;
  readonly exp: number;
  readonly levelsGained: number;
  readonly attributePointsGained: number;
  readonly talentPointsGained: number;
}

/**
 * Aplica XP e resolve múltiplos level-ups de uma vez (crítico no progresso
 * offline, onde podem chegar horas de XP num só tick).
 */
export function applyExp(input: { readonly level: number; readonly exp: number; readonly gained: number }): LevelUpResult {
  const maxLevel = BALANCE.progression.maxLevel;
  let level = Math.max(1, floorNonNegative(input.level));
  let exp = Math.max(0, safeNumber(input.exp) + safeNumber(input.gained));
  let levelsGained = 0;

  while (level < maxLevel && exp >= expForLevel(level)) {
    exp -= expForLevel(level);
    level += 1;
    levelsGained += 1;
  }

  if (level >= maxLevel) {
    exp = 0;
  }

  return {
    level,
    exp,
    levelsGained,
    attributePointsGained: levelsGained * BALANCE.progression.attributePointsPerLevel,
    talentPointsGained: levelsGained * BALANCE.progression.talentPointsPerLevel,
  };
}

/* ==========================================================================
 * UTILITÁRIOS
 * ========================================================================== */

export function clamp(value: number, min: number, max: number): number {
  const v = safeNumber(value, min);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/** Arredondamento "bancário" para os números grandes ficarem legíveis no HUD. */
export function formatCompact(value: number): string {
  const n = safeNumber(value);
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.round(n));
  if (abs < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (abs < 1_000_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
}
