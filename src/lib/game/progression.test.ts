import { describe, expect, it } from 'vitest';

import type { BaseClass, Character, Specialization } from '@/types/game';
import { BALANCE } from './balance';
import { applyExp } from './formulas';
import {
  allocateAttributes,
  applyExperience,
  distributeByPreset,
  mergeAttributes,
  resolvePreset,
  respec,
  respecCost,
  setAllocationMode,
} from './progression';

type CharacterSlice = Pick<
  Character,
  'level' | 'exp' | 'attributes' | 'unspentPoints' | 'talentPoints' | 'baseClass' | 'specialization' | 'allocationMode'
>;

const zero = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };

function makeCharacter(overrides: Partial<CharacterSlice> = {}): CharacterSlice {
  return {
    level: 1,
    exp: 0,
    attributes: zero,
    unspentPoints: 0,
    talentPoints: 0,
    baseClass: 'warrior' as BaseClass,
    specialization: null as Specialization | null,
    allocationMode: 'auto',
    ...overrides,
  };
}

describe('distributeByPreset', () => {
  it('gasta todos os pontos (maior resto)', () => {
    const result = distributeByPreset({ str: 2, vit: 2, dex: 1 }, 5);
    const total = Object.values(result).reduce((sum, value) => sum + (value ?? 0), 0);
    expect(total).toBe(5);
  });

  it('distribui 7 pontos sem perder nenhum', () => {
    const result = distributeByPreset({ int: 3, dex: 1, vit: 1 }, 7);
    const total = Object.values(result).reduce((sum, value) => sum + (value ?? 0), 0);
    expect(total).toBe(7);
  });

  it('cai para VIT quando o preset está vazio', () => {
    expect(distributeByPreset({}, 5)).toEqual({ vit: 5 });
  });

  it('devolve vazio para 0 pontos', () => {
    expect(distributeByPreset({ str: 1 }, 0)).toEqual({});
  });

  it('é determinístico', () => {
    const a = distributeByPreset({ str: 2, vit: 2, dex: 1 }, 5);
    const b = distributeByPreset({ str: 2, vit: 2, dex: 1 }, 5);
    expect(a).toEqual(b);
  });
});

describe('presets', () => {
  it('a especialização sobrepõe a classe', () => {
    expect(resolvePreset('mage', 'archmage')).toEqual({ int: 4, dex: 1 });
    expect(resolvePreset('mage', null)).toEqual({ int: 3, dex: 1, vit: 1 });
  });
});

describe('applyExperience — modo auto', () => {
  it('distribui atributos automaticamente e acumula talentos', () => {
    const character = makeCharacter();
    const exp = expFor(character.level) + 1; // exactamente um nível
    const result = applyExperience({ character, gainedExp: exp });

    expect(result.levelsGained).toBe(1);
    const spent = Object.values(result.attributes).reduce((sum, value) => sum + value, 0);
    expect(spent).toBe(BALANCE.progression.attributePointsPerLevel);
    expect(result.unspentPoints).toBe(0);
    // Talentos NÃO são gastos automaticamente (decisão aprovada).
    expect(result.talentPoints).toBe(BALANCE.progression.talentPointsPerLevel);
  });
});

describe('applyExperience — modo manual', () => {
  it('acumula os 5 pontos para o jogador decidir', () => {
    const character = makeCharacter({ allocationMode: 'manual' });
    const result = applyExperience({ character, gainedExp: expFor(character.level) + 1 });

    expect(result.unspentPoints).toBe(BALANCE.progression.attributePointsPerLevel);
    expect(result.attributes).toEqual(zero);
    expect(result.autoAllocated).toEqual({});
  });
});

describe('allocateAttributes', () => {
  it('aceita alocação válida e devolve o restante', () => {
    const result = allocateAttributes({
      current: zero,
      unspentPoints: 10,
      request: { str: 3, vit: 2 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attributes.str).toBe(3);
      expect(result.attributes.vit).toBe(2);
      expect(result.remaining).toBe(5);
    }
  });

  it('recusa gastar mais pontos do que os disponíveis', () => {
    const result = allocateAttributes({ current: zero, unspentPoints: 2, request: { str: 5 } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('exceeds_available');
  });

  it('recusa valores negativos ou fraccionários', () => {
    expect(allocateAttributes({ current: zero, unspentPoints: 5, request: { str: -1 } }).ok).toBe(false);
    expect(allocateAttributes({ current: zero, unspentPoints: 5, request: { str: 1.5 } }).ok).toBe(false);
  });

  it('recusa pedido vazio', () => {
    expect(allocateAttributes({ current: zero, unspentPoints: 5, request: {} }).ok).toBe(false);
  });
});

describe('respec', () => {
  it('devolve todos os pontos investidos', () => {
    const result = respec({
      attributes: { str: 10, agi: 5, vit: 0, int: 0, dex: 0, luk: 0 },
      unspentPoints: 3,
      talents: ['t1', 't1', 't2'],
      talentPoints: 1,
    });
    expect(result.unspentPoints).toBe(18);
    expect(result.talentPoints).toBe(4);
    expect(result.attributes).toEqual(zero);
    expect(result.talents).toEqual([]);
  });

  it('é barato de propósito', () => {
    const level1 = respecCost(1);
    expect(level1.amount).toBe(BALANCE.progression.respec.baseCost);
    // nível 40 continua pagável com Gold de farm.
    const level40 = respecCost(40);
    expect(level40.amount).toBeLessThan(10_000);
  });
});

describe('setAllocationMode', () => {
  it('ao voltar para auto aplica os pontos pendentes', () => {
    const result = setAllocationMode({
      mode: 'auto',
      current: { attributes: zero, unspentPoints: 10, baseClass: 'mage', specialization: null },
    });
    expect(result.mode).toBe('auto');
    expect(result.unspentPoints).toBe(0);
    const spent = Object.values(result.attributes).reduce((sum, value) => sum + value, 0);
    expect(spent).toBe(10);
  });

  it('ao passar para manual não toca nos pontos', () => {
    const result = setAllocationMode({
      mode: 'manual',
      current: { attributes: { str: 5, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 }, unspentPoints: 4, baseClass: 'warrior', specialization: null },
    });
    expect(result.unspentPoints).toBe(4);
    expect(result.attributes.str).toBe(5);
  });
});

describe('mergeAttributes', () => {
  it('ignora negativos e soma o resto', () => {
    const result = mergeAttributes(zero, { str: 2, agi: -5 });
    expect(result.str).toBe(2);
    expect(result.agi).toBe(0);
  });
});

/** XP necessário para subir a partir de `level` (reexportado para legibilidade). */
function expFor(level: number): number {
  return applyExp({ level, exp: 0, gained: 0 }).exp + expForLevel(level);
}

function expForLevel(level: number): number {
  return Math.round(BALANCE.progression.expBase * Math.pow(BALANCE.progression.expGrowthFactor, level));
}
