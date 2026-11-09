import { describe, expect, it } from 'vitest';

import type { ActiveEffect, Combatant, DerivedStats, EnemyCombatant, PlayerCombatant, Skill } from '@/types/game';
import { SKILL_BY_ID, SKILLS } from '@/data/skills';
import { createRng } from './rng';
import {
  applyCast,
  applyControl,
  canAct,
  canCast,
  describeModifiers,
  resolveSkillCast,
  selectTargets,
  skillPower,
  tickEffects,
} from './skills';
import { createCombatState } from './combat';

const stats: DerivedStats = {
  maxHp: 1000, maxMp: 200, atk: 200, matk: 300, def: 50, mdef: 50,
  hit: 120, flee: 20, crit: 10, critDamage: 140, attackSpeed: 1, castTime: 0,
  healPower: 100, lifesteal: 0, expBonus: 0, dropBonus: 0,
  regenPct: 0, controlResist: 0, lowHpAtk: 0, buffDuration: 0,
};

function hero(id: string, hp = 1000): PlayerCombatant {
  return {
    id, name: id, level: 25, team: 'squad', position: 'front',
    hp, maxHp: hp, mp: 200, maxMp: 200, shield: 0, stats,
    effects: [], attackCooldownSec: 0, skillCooldowns: {}, isAlive: true,
    characterId: id, baseClass: 'mage',
    skills: [],
    appearance: {
      raceId: 'race.human', bodyVariant: 0, skinTone: '#fff', hairStyle: 'short', hairColor: '#000',
      cosmetic: { aura: null, wings: null, body: null, armor: null, helmet: null, weapon: null, vfx: null },
      auraColor: null,
    },
  };
}

function enemy(id: string, hp = 5000): EnemyCombatant {
  return {
    id, name: id, level: 10, team: 'enemy', position: 'front',
    hp, maxHp: hp, mp: 0, maxMp: 0, shield: 0, stats: { ...stats, atk: 40 },
    effects: [], attackCooldownSec: 0, skillCooldowns: {}, isAlive: true,
    monsterId: 'mob', tier: 'normal', element: 'neutral', paperdoll: null, skills: [],
  };
}

function skill(id: string): Skill {
  const found = SKILL_BY_ID.get(id);
  if (!found) throw new Error(`skill ausente: ${id}`);
  return found;
}

describe('catálogo de skills (executor)', () => {
  it('todas as skills têm pelo menos um efeito', () => {
    for (const entry of SKILLS) {
      expect(entry.effects.length).toBeGreaterThan(0);
    }
  });

  it('skillPower escala com o nível do conjurador', () => {
    const meteor = skill('skill.archmage.meteor');
    const low = skillPower(meteor, stats, 1);
    const high = skillPower(meteor, stats, 50);
    expect(high).toBeGreaterThan(low);
  });
});

describe('seleção de alvos', () => {
  const caster = hero('h1');
  const front = { ...enemy('e1'), position: 'front' as const };
  const mid = { ...enemy('e3'), position: 'mid' as const };
  const back = { ...enemy('e2'), position: 'back' as const };
  const ally = hero('h2', 400);

  it('prioriza front em inimigos', () => {
    const targets = selectTargets(
      { function: 'damage', scaling: 'atk', coefficient: 1, durationSec: null, tickIntervalSec: null, targetCount: 1, targetsAlly: false, element: 'neutral', modifiers: [], maxHpDamageCapPct: null },
      caster,
      [caster, ally, back, front],
    );
    expect(targets[0]?.id).toBe('e1');

    const deadFront = { ...front, hp: 0, isAlive: false };
    expect(selectTargets(
      { function: 'damage', scaling: 'atk', coefficient: 1, durationSec: null, tickIntervalSec: null, targetCount: 1, targetsAlly: false, element: 'neutral', modifiers: [], maxHpDamageCapPct: null },
      caster,
      [caster, back, mid, deadFront],
    )[0]?.id).toBe('e3');

    const deadMid = { ...mid, hp: 0, isAlive: false };
    expect(selectTargets(
      { function: 'damage', scaling: 'atk', coefficient: 1, durationSec: null, tickIntervalSec: null, targetCount: 1, targetsAlly: false, element: 'neutral', modifiers: [], maxHpDamageCapPct: null },
      caster,
      [caster, back, deadMid, deadFront],
    )[0]?.id).toBe('e2');
  });

  it('cura o aliado com HP mais baixo', () => {
    const targets = selectTargets(
      { function: 'heal', scaling: 'matk', coefficient: 1, durationSec: null, tickIntervalSec: null, targetCount: 1, targetsAlly: true, element: 'neutral', modifiers: [], maxHpDamageCapPct: null },
      caster,
      [caster, ally, front],
    );
    expect(targets[0]?.id).toBe('h2');
  });

  it('targetCount all devolve todos os vivos', () => {
    const targets = selectTargets(
      { function: 'aoe_damage', scaling: 'matk', coefficient: 1, durationSec: null, tickIntervalSec: null, targetCount: 'all', targetsAlly: false, element: 'neutral', modifiers: [], maxHpDamageCapPct: null },
      caster,
      [caster, ally, front, back],
    );
    expect(targets.length).toBe(2);
  });
});

describe('resolveSkillCast', () => {
  it('gera dano imediato para skill de dano', () => {
    const caster = hero('h1');
    const target = enemy('e1');
    const applications = resolveSkillCast({
      caster,
      skill: skill('skill.archmage.arcane_blast'),
      combatants: [caster, target],
      now: 1000,
      rng: createRng(1),
    });
    expect(applications.length).toBeGreaterThan(0);
    expect(applications[0]?.immediate?.kind).toBe('damage');
    expect(applications[0]?.immediate?.amount).toBeGreaterThan(0);
  });

  it('DoT distribui o valor por tick', () => {
    const caster = hero('h1');
    const target = enemy('e1');
    const applications = resolveSkillCast({
      caster,
      skill: skill('skill.warlock.corruption'),
      combatants: [caster, target],
      now: 1000,
      rng: createRng(2),
    });
    const effect = applications[0]?.effect;
    expect(effect?.tickIntervalSec).toBe(1);
    expect(effect?.tickValue).toBeGreaterThan(0);
    expect(effect?.nextTickSec).toBe(1);
  });

  it('cura gera valor positivo em aliado ferido', () => {
    const caster = hero('h1');
    const wounded = hero('h2', 200);
    const applications = resolveSkillCast({
      caster,
      skill: skill('skill.divine_priest.greater_heal'),
      combatants: [caster, wounded],
      now: 1000,
      rng: createRng(3),
    });
    expect(applications[0]?.immediate?.kind).toBe('heal');
    expect(applications[0]?.immediate?.amount).toBeGreaterThan(0);
  });

  it('buffDuration (Troll) alonga buffs benéficos', () => {
    const caster = hero('h1');
    const applications = resolveSkillCast({
      caster,
      skill: skill('skill.paladin.devotion_aura'),
      combatants: [caster],
      now: 1000,
      rng: createRng(4),
      buffDurationPct: 50,
    });
    const durationMs = (applications[0]?.effect.expiresAtMs ?? 0) - 1000;
    expect(durationMs).toBe(18000); // 12s * 1.5
  });

  it('skill de controlo produz stun', () => {
    const caster = hero('h1');
    const target = enemy('e1');
    const applications = resolveSkillCast({
      caster,
      skill: skill('skill.paladin.holy_hammer'),
      combatants: [caster, target],
      now: 1000,
      rng: createRng(5),
    });
    expect(applications[0]?.control?.kind).toBe('stun');
  });

  it('é determinístico com o mesmo seed', () => {
    const run = (): number => {
      const caster = hero('h1');
      const target = enemy('e1');
      const applications = resolveSkillCast({
        caster,
        skill: skill('skill.archmage.meteor'),
        combatants: [caster, target],
        now: 1000,
        rng: createRng(99),
      });
      return applications[0]?.immediate?.amount ?? 0;
    };
    expect(run()).toBe(run());
  });
});

describe('tickEffects', () => {
  function dotEffect(overrides: Partial<ActiveEffect> = {}): ActiveEffect {
    return {
      id: 'eff-1', skillId: 'skill.warlock.corruption', sourceActorId: 'h1', targetActorId: 'e1',
      kind: 'dot', element: 'dark', tickValue: 50, tickIntervalSec: 1, expiresAtMs: 10_000,
      stacks: 1, modifiers: [], nextTickSec: 1, undispellable: false, ...overrides,
    };
  }

  it('DoT aplica dano no tick', () => {
    const target = { ...enemy('e1'), effects: [dotEffect()] };
    const result = tickEffects([target], {}, 5000, 1);
    expect(result.damage.length).toBe(1);
    expect(result.combatants[0]?.hp).toBe(4950);
  });

  it('DoT expira por tempo', () => {
    const target = { ...enemy('e1'), effects: [dotEffect({ expiresAtMs: 4000 })] };
    const result = tickEffects([target], {}, 5000, 0.1);
    expect(result.combatants[0]?.effects.length).toBe(0);
    expect(result.expired.length).toBe(1);
  });

  it('HoT cura no tick', () => {
    const base = hero('h1', 500);
    const target = { ...base, hp: 500, maxHp: 1000, effects: [dotEffect({ kind: 'hot', tickValue: 100 })] };
    const result = tickEffects([target], {}, 5000, 1);
    expect(result.healing.length).toBe(1);
    expect(result.combatants[0]?.hp).toBe(600);
  });

  it('regeneração racial cura por segundo', () => {
    const base = hero('h1', 500);
    const troll = { ...base, hp: 500, maxHp: 1000, stats: { ...stats, regenPct: 3 } };
    const result = tickEffects([troll], {}, 5000, 1);
    // 3% de 1000 HP = 30/s
    expect(result.combatants[0]?.hp).toBe(530);
  });

  it('não cura acima do MaxHP', () => {
    const base = hero('h1', 995);
    const troll = { ...base, hp: 995, maxHp: 1000, stats: { ...stats, regenPct: 3 } };
    const result = tickEffects([troll], {}, 5000, 1);
    expect(result.combatants[0]?.hp).toBe(1000);
  });

  it('morto não recebe regeneração', () => {
    const dead = { ...hero('h1', 0), isAlive: false, stats: { ...stats, regenPct: 3 } };
    const result = tickEffects([dead], {}, 5000, 1);
    expect(result.combatants[0]?.hp).toBe(0);
  });
});

describe('controlo', () => {
  it('stun bloqueia acção e expira', () => {
    const state = createCombatState({
      squad: [hero('h1')], floor: 1, wave: 1, wavesPerFloor: 9, isBossFloor: false, seed: 1,
    });
    const withControl = { ...state, control: applyControl({}, 'h1', 'stun', 2, 1000, 0) };
    expect(canAct(withControl, 'h1', 1500)).toBe(false);
    expect(canAct(withControl, 'h1', 3500)).toBe(true);
  });

  it('silêncio bloqueia cast mas não auto-ataque', () => {
    const state = createCombatState({
      squad: [hero('h1')], floor: 1, wave: 1, wavesPerFloor: 9, isBossFloor: false, seed: 1,
    });
    const withControl = { ...state, control: applyControl({}, 'h1', 'silence', 3, 1000, 0) };
    expect(canAct(withControl, 'h1', 1500)).toBe(true);
    expect(canCast(withControl, 'h1', 1500)).toBe(false);
  });

  it('controlResist (Pandaren) reduz a duração', () => {
    const control = applyControl({}, 'h1', 'stun', 10, 0, 50);
    // 50% de resistência → 5s
    expect(control['h1']?.stunUntilMs).toBe(5000);
  });

  it('resistência total anula o controlo', () => {
    const control = applyControl({}, 'h1', 'stun', 10, 0, 100);
    expect(control['h1']).toBeUndefined();
  });
});

describe('applyCast', () => {
  it('aplica dano imediato e regista efeito', () => {
    const caster = hero('h1');
    const target = enemy('e1');
    const applications = resolveSkillCast({
      caster,
      skill: skill('skill.warlock.corruption'),
      combatants: [caster, target],
      now: 1000,
      rng: createRng(7),
    });
    const result = applyCast([caster, target], applications, {}, 1000);
    const updated = result.combatants.find((actor) => actor.id === 'e1') as Combatant | undefined;
    expect(updated?.effects.length).toBe(1);
  });

  it('escudo absorve antes do HP', () => {
    const caster = hero('h1');
    const ally = hero('h2', 300);
    const applications = resolveSkillCast({
      caster,
      skill: skill('skill.archmage.mana_barrier'),
      combatants: [caster, ally],
      now: 1000,
      rng: createRng(8),
    });
    const result = applyCast([caster, ally], applications, {}, 1000);
    const shielded = result.combatants.filter((actor) => actor.shield > 0);
    expect(shielded.length).toBeGreaterThan(0);
  });
});

describe('utilidades', () => {
  it('describeModifiers formata percentagens e flat', () => {
    expect(describeModifiers([{ stat: 'atk', kind: 'percent', value: 10, source: { type: 'talent', talentId: 'x' } }])).toEqual(['+10% atk']);
    expect(describeModifiers([{ stat: 'def', kind: 'flat', value: 5, source: { type: 'talent', talentId: 'x' } }])).toEqual(['+5 def']);
  });
});
