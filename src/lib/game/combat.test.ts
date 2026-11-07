import { describe, expect, it } from 'vitest';

import type { CombatState, DerivedStats, EnemyCombatant, PlayerCombatant } from '@/types/game';
import { advanceCombat, createCombatState, emptyMetrics, finaliseMetrics, pickTarget } from './combat';
import { createRng } from './rng';

const stats: DerivedStats = {
  maxHp: 1000,
  maxMp: 100,
  atk: 100,
  matk: 100,
  def: 0,
  mdef: 0,
  hit: 100,
  flee: 0,
  crit: 0,
  critDamage: 140,
  attackSpeed: 1,
  castTime: 0,
  healPower: 0,
  lifesteal: 0,
  expBonus: 0,
  dropBonus: 0,
  regenPct: 0,
  controlResist: 0,
  lowHpAtk: 0,
  buffDuration: 0,
};

function makeHero(id: string, hp = 1000): PlayerCombatant {
  return {
    id,
    name: id,
    level: 10,
    team: 'squad',
    position: 'front',
    hp,
    maxHp: hp,
    mp: 100,
    maxMp: 100,
    shield: 0,
    stats,
    effects: [],
    attackCooldownSec: 0,
    skillCooldowns: {},
    isAlive: true,
    characterId: id,
    baseClass: 'warrior',
    skills: [],
    appearance: {
      raceId: 'human',
      bodyVariant: 0,
      skinTone: '#fff',
      hairStyle: 'short',
      hairColor: '#000',
      cosmetic: { aura: null, wings: null, body: null, armor: null, helmet: null, weapon: null, vfx: null },
      auraColor: null,
    },
  };
}

function makeEnemy(id: string, hp = 200): EnemyCombatant {
  return {
    id,
    name: id,
    level: 5,
    team: 'enemy',
    position: 'front',
    hp,
    maxHp: hp,
    mp: 0,
    maxMp: 0,
    shield: 0,
    stats: { ...stats, atk: 10, attackSpeed: 0.5 },
    effects: [],
    attackCooldownSec: 0,
    skillCooldowns: {},
    isAlive: true,
    monsterId: 'mob',
    tier: 'normal',
    element: 'neutral',
    paperdoll: null,
    skills: [],
  };
}

describe('RNG determinístico', () => {
  it('o mesmo seed produz a mesma sequência', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('seeds diferentes divergem', () => {
    const a = createRng(1).next();
    const b = createRng(2).next();
    expect(a).not.toBe(b);
  });

  it('respeita o intervalo de int()', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i += 1) {
      const value = rng.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
    }
  });

  it('weighted ignora pesos ≤ 0', () => {
    const rng = createRng(9);
    for (let i = 0; i < 100; i += 1) {
      expect(rng.weighted([{ value: 'a', weight: 0 }, { value: 'b', weight: 1 }])).toBe('b');
    }
  });

  it('restaura o estado exacto', () => {
    const rng = createRng(42);
    rng.next();
    rng.next();
    const state = rng.getState();
    const expected = rng.next();
    const restored = createRng(state.seed, { s0: state.s0, s1: state.s1, s2: state.s2, s3: state.s3, cursor: state.cursor });
    expect(restored.next()).toBe(expected);
  });
});

describe('targeting', () => {
  it('escolhe front antes de mid e back', () => {
    const front = makeEnemy('front');
    const back = { ...makeEnemy('back'), position: 'back' as const };
    expect(pickTarget([back, front])?.id).toBe('front');
  });

  it('devolve null sem inimigos vivos', () => {
    const dead = { ...makeEnemy('dead'), hp: 0, isAlive: false };
    expect(pickTarget([dead])).toBeNull();
  });
});

describe('advanceCombat', () => {
  it('o herói causa dano e o inimigo morre', () => {
    const state = createCombatState({
      squad: [makeHero('h1')],
      floor: 1,
      wave: 1,
      wavesPerFloor: 9,
      isBossFloor: false,
      seed: 1,
    });

    let current: CombatState = { ...state, combatants: [...state.combatants, makeEnemy('e1', 50)], phase: 'fighting' };
    const rng = createRng(1);

    for (let i = 0; i < 600; i += 1) {
      current = advanceCombat(current, 1 / 60, { rng, now: 1000 + i });
      if (current.phase === 'wave_clear') break;
    }

    expect(current.phase).toBe('wave_clear');
    expect(current.metrics.totalDamage).toBeGreaterThan(0);
  });

  it('é determinístico para o mesmo seed', () => {
    const run = (): number => {
      const base = createCombatState({
        squad: [makeHero('h1')],
        floor: 1,
        wave: 1,
        wavesPerFloor: 9,
        isBossFloor: false,
        seed: 777,
      });
      let current: CombatState = { ...base, combatants: [...base.combatants, makeEnemy('e1', 5000)], phase: 'fighting' };
      const rng = createRng(777);
      for (let i = 0; i < 300; i += 1) {
        current = advanceCombat(current, 1 / 60, { rng, now: i });
      }
      return current.metrics.totalDamage;
    };

    expect(run()).toBe(run());
  });

  it('wipe quando o squad morre', () => {
    const hero = { ...makeHero('h1', 10), position: 'front' as const };
    const enemy = { ...makeEnemy('e1', 100_000), stats: { ...stats, atk: 500, attackSpeed: 2 } };
    const base = createCombatState({
      squad: [hero],
      floor: 1,
      wave: 1,
      wavesPerFloor: 9,
      isBossFloor: false,
      seed: 3,
    });
    let current: CombatState = { ...base, combatants: [hero, enemy], phase: 'fighting' };
    const rng = createRng(3);

    for (let i = 0; i < 600; i += 1) {
      current = advanceCombat(current, 1 / 60, { rng, now: i });
      if (current.phase === 'wipe') break;
    }

    expect(current.phase).toBe('wipe');
  });

  it('não avança quando está em pausa', () => {
    const base = createCombatState({
      squad: [makeHero('h1')],
      floor: 1,
      wave: 1,
      wavesPerFloor: 9,
      isBossFloor: false,
      seed: 1,
    });
    const paused = { ...base, running: false };
    const next = advanceCombat(paused, 1, { rng: createRng(1), now: 0 });
    expect(next).toBe(paused);
  });
});

describe('métricas', () => {
  it('calcula DPS, share e crit%', () => {
    const metrics = finaliseMetrics(
      {
        ...emptyMetrics(),
        totalDamage: 300,
        perActor: {
          h1: {
            damageDealt: 300,
            damageTaken: 0,
            healingDone: 0,
            critCount: 3,
            hitCount: 10,
            missCount: 0,
            deaths: 0,
            dps: 0,
            dpsSharePct: 0,
            critRatePct: 0,
          },
        },
      },
      10,
    );

    const actor = metrics.perActor['h1'];
    expect(actor?.dps).toBe(30);
    expect(actor?.dpsSharePct).toBe(100);
    expect(actor?.critRatePct).toBe(30);
  });
});
