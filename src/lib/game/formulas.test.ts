import { describe, expect, it } from 'vitest';

import { BALANCE } from './balance';
import {
  applyExp,
  computeAtk,
  computeAttackSpeed,
  computeCastTime,
  computeCrit,
  computeDamage,
  computeHitChance,
  expForLevel,
  mitigate,
  softDefReduction,
} from './formulas';

describe('ATK', () => {
  it('segue a fórmula da wiki: arma + STR + floor(STR/10)² + floor(DEX/5) + floor(LUK/5)', () => {
    // arma 100, refino 0, STR 20 → 20 + floor(20/10)² = 20 + 4
    // DEX 15 → +3 ; LUK 10 → +2
    const atk = computeAtk({ weaponAtk: 100, refineLevel: 0, str: 20, dex: 15, luk: 10 });
    expect(atk).toBe(100 + 20 + 4 + 3 + 2);
  });

  it('aplica 5% de refino por nível à arma', () => {
    const atk = computeAtk({ weaponAtk: 100, refineLevel: 4, str: 0, dex: 0, luk: 0 });
    expect(atk).toBe(120); // 100 × 1.2
  });

  it('nunca devolve menos de 1', () => {
    expect(computeAtk({ weaponAtk: 0, refineLevel: 0, str: 0, dex: 0, luk: 0 })).toBe(1);
  });

  it('ignora entradas não finitas', () => {
    const atk = computeAtk({ weaponAtk: Number.NaN, refineLevel: 0, str: 10, dex: 0, luk: 0 });
    expect(Number.isFinite(atk)).toBe(true);
  });
});

describe('ASPD / CAST / CRIT', () => {
  it('respeita o teto de 2.5 ataques por segundo', () => {
    const aspd = computeAttackSpeed({ baseAttacksPerSec: 1, agi: 1000, dex: 1000 });
    expect(aspd).toBe(BALANCE.stats.attackSpeed.maxAttacksPerSec);
  });

  it('aumenta com AGI e DEX segundo a wiki', () => {
    const aspd = computeAttackSpeed({ baseAttacksPerSec: 1, agi: 50, dex: 50 });
    expect(aspd).toBeCloseTo(1 * (1 + 0.5 + 0.1), 5);
  });

  it('zera o tempo de conjuração a 150 de DEX', () => {
    expect(computeCastTime(2, 150)).toBe(0);
    expect(computeCastTime(2, 75)).toBeCloseTo(1, 5);
  });

  it('limita o crítico a 100%', () => {
    expect(computeCrit(10_000)).toBe(100);
    expect(computeCrit(0)).toBeCloseTo(1, 5);
  });
});

describe('acerto e mitigação', () => {
  it('chance de acerto fica entre 5% e 100%', () => {
    expect(computeHitChance(0, 0)).toBeCloseTo(0.8, 5);
    expect(computeHitChance(-1000, 0)).toBe(BALANCE.stats.hitChance.minPct);
    expect(computeHitChance(1000, 0)).toBe(BALANCE.stats.hitChance.maxPct);
  });

  it('DEF macia nunca chega a 100% de redução', () => {
    expect(softDefReduction(0)).toBe(0);
    expect(softDefReduction(1_000_000)).toBeLessThan(1);
    expect(softDefReduction(100)).toBeCloseTo(0.5, 5);
  });

  it('mitigação garante sempre pelo menos 1 de dano', () => {
    expect(mitigate(10, 1_000_000)).toBe(1);
  });
});

describe('dano completo', () => {
  it('Fogo contra Terra causa 150%', () => {
    const result = computeDamage({
      rawDamage: 100,
      attackerElement: 'fire',
      defenderElement: 'earth',
      defenderRace: 'beast',
      defenderSize: 'medium',
      defenderTier: 'normal',
      weaponType: null,
      defence: 0,
      isCrit: false,
      isAoe: false,
      defenderMaxHp: 10_000,
      damageBonusPct: 0,
    });
    expect(result.amount).toBe(150);
  });

  it('Fogo contra Água causa 50%', () => {
    const result = computeDamage({
      rawDamage: 100,
      attackerElement: 'fire',
      defenderElement: 'water',
      defenderRace: 'beast',
      defenderSize: 'medium',
      defenderTier: 'normal',
      weaponType: null,
      defence: 0,
      isCrit: false,
      isAoe: false,
      defenderMaxHp: 10_000,
      damageBonusPct: 0,
    });
    expect(result.amount).toBe(50);
  });

  it('respeita o teto de AoE de 40% do MaxHP', () => {
    const result = computeDamage({
      rawDamage: 100_000,
      attackerElement: 'neutral',
      defenderElement: 'neutral',
      defenderRace: 'beast',
      defenderSize: 'medium',
      defenderTier: 'boss',
      weaponType: null,
      defence: 0,
      isCrit: false,
      isAoe: true,
      defenderMaxHp: 1000,
      damageBonusPct: 0,
    });
    expect(result.capped).toBe(true);
    expect(result.amount).toBe(400);
  });

  it('crítico multiplica por 1.4', () => {
    const base = computeDamage({
      rawDamage: 100,
      attackerElement: 'neutral',
      defenderElement: 'neutral',
      defenderRace: 'beast',
      defenderSize: 'medium',
      defenderTier: 'normal',
      weaponType: null,
      defence: 0,
      isCrit: false,
      isAoe: false,
      defenderMaxHp: 10_000,
      damageBonusPct: 0,
    });
    const crit = computeDamage({
      rawDamage: 100,
      attackerElement: 'neutral',
      defenderElement: 'neutral',
      defenderRace: 'beast',
      defenderSize: 'medium',
      defenderTier: 'normal',
      weaponType: null,
      defence: 0,
      isCrit: true,
      isAoe: false,
      defenderMaxHp: 10_000,
      damageBonusPct: 0,
    });
    expect(crit.amount / base.amount).toBeCloseTo(BALANCE.stats.crit.damageMultiplier, 2);
  });
});

describe('XP e nível', () => {
  it('curva base × 1.15 ^ nível', () => {
    expect(expForLevel(1)).toBe(Math.round(BALANCE.progression.expBase * 1.15));
    expect(expForLevel(10)).toBe(Math.round(BALANCE.progression.expBase * Math.pow(1.15, 10)));
  });

  it('resolve múltiplos níveis num só ganho (progresso offline)', () => {
    const result = applyExp({ level: 1, exp: 0, gained: 100_000 });
    expect(result.levelsGained).toBeGreaterThan(5);
    expect(result.attributePointsGained).toBe(result.levelsGained * 5);
    expect(result.talentPointsGained).toBe(result.levelsGained * 3);
    expect(result.exp).toBeLessThan(expForLevel(result.level));
  });

  it('não passa do nível máximo', () => {
    const result = applyExp({ level: 1, exp: 0, gained: Number.MAX_SAFE_INTEGER });
    expect(result.level).toBe(BALANCE.progression.maxLevel);
    expect(result.exp).toBe(0);
  });
});
