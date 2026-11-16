/**
 * Progressão do personagem — sistema híbrido aprovado.
 *
 * Regras:
 *  · 5 pontos de atributo e 3 pontos de talento por nível.
 *  · `auto`:   o jogo aplica o preset da classe aos 5 pontos de atributo.
 *              Os 3 pontos de talento ACUMULAM para o jogador decidir.
 *  · `manual`: o jogador aloca os 5 pontos de atributo e cada ponto de talento.
 *  · Reset de atributos barato (Gold), para incentivar experimentação no idle.
 *
 * Tudo aqui é puro: recebe `Character`-like e devolve o próximo estado.
 * O servidor reexecuta exactamente estas funções antes de persistir.
 */
import type {
  AllocationMode,
  AttributeBlock,
  AttributePreset,
  BaseClass,
  Character,
  ContentId,
  Currency,
  LevelUpPoints,
  PrimaryAttribute,
  RespecCost,
  Specialization,
  TalentNode,
} from '@/types/game';
import { BALANCE } from './balance';
import { applyExp, floorNonNegative, safeNumber } from './formulas';

const P = BALANCE.progression;

/* ==========================================================================
 * PRESETS DE CLASSE
 * ========================================================================== */

/**
 * Presets de atributos por classe. Os pesos são proporcionais: a distribuição
 * de 5 pontos usa o maior resto para não "perder" pontos por arredondamento.
 *
 * @tuning — a wiki define o atributo-chave por classe; os pesos exactos são
 * decisão de design. Ajustar aqui muda o auto-build de todos os jogadores.
 */
export const ATTRIBUTE_PRESETS: Readonly<Record<BaseClass, AttributePreset>> = {
  // Tanque: STR + VIT
  warrior: { str: 2, vit: 2, dex: 1 },
  // DPS físico: DEX + AGI
  hunter: { dex: 2, agi: 2, luk: 1 },
  // Healer: INT + VIT
  cleric: { int: 2, vit: 2, dex: 1 },
  // DPS mágico: INT puro com apoio de DEX para cast
  mage: { int: 3, dex: 1, vit: 1 },
} as const;

/** Preset da especialização sobrepõe-se ao da classe quando existe. */
export const SPEC_ATTRIBUTE_PRESETS: Readonly<Partial<Record<Specialization, AttributePreset>>> = {
  paladin: { str: 2, vit: 2, int: 1 },
  berserker: { str: 3, vit: 2 },
  sharpshooter: { dex: 3, luk: 2 },
  assassin: { agi: 2, dex: 2, luk: 1 },
  divine_priest: { int: 3, vit: 2 },
  inquisitor: { int: 3, dex: 1, vit: 1 },
  archmage: { int: 4, dex: 1 },
  warlock: { int: 3, vit: 1, dex: 1 },
} as const;

/** Preset efectivo: especialização > classe. */
export function resolvePreset(baseClass: BaseClass, specialization: Specialization | null): AttributePreset {
  if (specialization) {
    const specPreset = SPEC_ATTRIBUTE_PRESETS[specialization];
    if (specPreset) return specPreset;
  }
  return ATTRIBUTE_PRESETS[baseClass];
}

/* ==========================================================================
 * DISTRIBUIÇÃO
 * ========================================================================== */

/**
 * Distribui `points` segundo os pesos do preset, usando o método do maior
 * resto (Hare quota). Garante que TODOS os pontos são gastos e que nenhum
 * atributo fica negativo.
 */
export function distributeByPreset(
  preset: AttributePreset,
  points: number,
): Readonly<Partial<AttributeBlock>> {
  const total = floorNonNegative(points);
  if (total === 0) return {};

  const entries = (Object.entries(preset) as readonly [PrimaryAttribute, number][]).filter(
    (entry): entry is [PrimaryAttribute, number] => typeof entry[1] === 'number' && entry[1] > 0,
  );

  if (entries.length === 0) {
    // Sem preset válido: cai para VIT, que nunca é desperdício.
    return { vit: total };
  }

  const weightSum = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const raw = entries.map(([attr, weight]) => ({ attr, exact: (total * weight) / weightSum }));
  const result: Record<PrimaryAttribute, number> = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };

  let assigned = 0;
  for (const item of raw) {
    const whole = Math.floor(item.exact);
    result[item.attr] += whole;
    assigned += whole;
  }

  // Maior resto: ordena por parte fraccionária descendente.
  const remainder = raw
    .map((item) => ({ attr: item.attr, rest: item.exact - Math.floor(item.exact) }))
    .sort((a, b) => b.rest - a.rest);

  let i = 0;
  while (assigned < total) {
    const slot = remainder[i % remainder.length];
    if (!slot) break;
    result[slot.attr] += 1;
    assigned += 1;
    i += 1;
  }

  const out: Record<PrimaryAttribute, number> = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
  for (const [attr, value] of Object.entries(result) as [PrimaryAttribute, number][]) {
    if (value > 0) out[attr] = value;
  }
  return out;
}

/** Soma dois blocos parciais de atributos, ignorando negativos. */
export function mergeAttributes(
  current: AttributeBlock,
  delta: Readonly<Partial<AttributeBlock>>,
): AttributeBlock {
  const mutable: Record<PrimaryAttribute, number> = {
    str: current.str,
    agi: current.agi,
    vit: current.vit,
    int: current.int,
    dex: current.dex,
    luk: current.luk,
  };
  for (const [key, value] of Object.entries(delta) as [PrimaryAttribute, number | undefined][]) {
    if (typeof value !== 'number' || value <= 0) continue;
    mutable[key] += Math.floor(value);
  }
  return mutable;
}

/* ==========================================================================
 * LEVEL UP
 * ========================================================================== */

export interface LevelUpOutcome {
  readonly attributes: AttributeBlock;
  readonly unspentPoints: number;
  readonly talentPoints: number;
  readonly level: number;
  readonly exp: number;
  readonly levelsGained: number;
  readonly autoAllocated: Readonly<Partial<AttributeBlock>>;
}

/**
 * Resolve um ganho de XP aplicando a política de alocação do personagem.
 * `auto` → distribui pelos presets; `manual` → acumula em `unspentPoints`.
 */
export function applyExperience(input: {
  readonly character: Pick<Character, 'level' | 'exp' | 'attributes' | 'unspentPoints' | 'talentPoints' | 'baseClass' | 'specialization' | 'allocationMode'>;
  readonly gainedExp: number;
}): LevelUpOutcome {
  const { character } = input;
  const result = applyExp({ level: character.level, exp: character.exp, gained: input.gainedExp });

  const preset = resolvePreset(character.baseClass, character.specialization);
  const autoPoints =
    character.allocationMode === 'auto'
      ? result.attributePointsGained
      : 0;

  const distributed = distributeByPreset(preset, autoPoints);
  const attributes = mergeAttributes(character.attributes, distributed);

  return {
    attributes,
    unspentPoints: character.unspentPoints + (result.attributePointsGained - autoPoints),
    talentPoints: character.talentPoints + result.talentPointsGained,
    level: result.level,
    exp: result.exp,
    levelsGained: result.levelsGained,
    autoAllocated: distributed,
  };
}

/** Pontos concedidos por um nível (constantes, expostas para a UI). */
export function levelUpPoints(): LevelUpPoints {
  return {
    attributePoints: P.attributePointsPerLevel,
    talentPoints: P.talentPointsPerLevel,
  };
}

/* ==========================================================================
 * VALIDAÇÃO DE ALOCAÇÃO MANUAL
 * ========================================================================== */

export type AllocationCheck =
  | { readonly ok: true; readonly attributes: AttributeBlock; readonly remaining: number }
  | { readonly ok: false; readonly reason: 'negative' | 'exceeds_available' | 'empty' };

/**
 * Valida e aplica uma alocação manual de atributos.
 * O cliente envia o delta; o servidor chama esta função — nunca confia no total.
 */
export function allocateAttributes(input: {
  readonly current: AttributeBlock;
  readonly unspentPoints: number;
  readonly request: Readonly<Partial<AttributeBlock>>;
}): AllocationCheck {
  const entries = Object.entries(input.request) as [PrimaryAttribute, number | undefined][];
  if (entries.length === 0) return { ok: false, reason: 'empty' };

  let requested = 0;
  for (const [, value] of entries) {
    if (typeof value !== 'number') continue;
    if (!Number.isInteger(value) || value < 0) return { ok: false, reason: 'negative' };
    requested += value;
  }

  if (requested === 0) return { ok: false, reason: 'empty' };
  if (requested > input.unspentPoints) return { ok: false, reason: 'exceeds_available' };

  const attributes = mergeAttributes(input.current, input.request);
  return { ok: true, attributes, remaining: input.unspentPoints - requested };
}

/* ==========================================================================
 * TALENTOS
 * ========================================================================== */

export interface TalentAllocationCheck {
  readonly ok: boolean;
  readonly reason: 'unknown_talent' | 'wrong_spec' | 'level' | 'max_rank' | 'prerequisite' | 'no_points' | null;
  readonly spent: number;
  readonly talents: readonly ContentId[];
}

/**
 * Valida a alocação de talentos contra o catálogo.
 * `request` mapeia talentId → TOTAL de pontos investidos (idempotente).
 */
export function validateTalentAllocation(input: {
  readonly specialization: Specialization | null;
  readonly level: number;
  readonly availablePoints: number;
  readonly current: readonly ContentId[];
  readonly request: Readonly<Record<ContentId, number>>;
  readonly catalogue: ReadonlyMap<ContentId, TalentNode>;
}): TalentAllocationCheck {
  if (!input.specialization) {
    return { ok: false, reason: 'wrong_spec', spent: 0, talents: input.current };
  }

  const currentRanks = rankMap(input.current);
  let spent = 0;

  for (const [talentId, rank] of Object.entries(input.request)) {
    const node = input.catalogue.get(talentId);
    if (!node) return { ok: false, reason: 'unknown_talent', spent, talents: input.current };
    if (node.specialization !== input.specialization) {
      return { ok: false, reason: 'wrong_spec', spent, talents: input.current };
    }
    if (input.level < node.levelRequirement) {
      return { ok: false, reason: 'level', spent, talents: input.current };
    }
    const clampedRank = Math.max(0, Math.floor(safeNumber(rank)));
    if (clampedRank > node.maxRank) {
      return { ok: false, reason: 'max_rank', spent, talents: input.current };
    }
    for (const requirement of node.requires) {
      if ((currentRanks.get(requirement) ?? 0) < 1) {
        return { ok: false, reason: 'prerequisite', spent, talents: input.current };
      }
    }
    spent += clampedRank - (currentRanks.get(talentId) ?? 0);
  }

  if (spent > input.availablePoints) {
    return { ok: false, reason: 'no_points', spent, talents: input.current };
  }

  // Expande ranks em lista plana de ids (1 entrada por ponto investido).
  const talents: ContentId[] = [];
  for (const [talentId, rank] of Object.entries(input.request)) {
    const count = Math.max(0, Math.floor(safeNumber(rank)));
    for (let i = 0; i < count; i += 1) talents.push(talentId);
  }

  return { ok: true, reason: null, spent, talents };
}

function rankMap(talents: readonly ContentId[]): Map<ContentId, number> {
  const map = new Map<ContentId, number>();
  for (const id of talents) {
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

/* ==========================================================================
 * RESET (RESPEC)
 * ========================================================================== */

/**
 * Custo do reset: base × perLevelMultiplier ^ (nível − 1).
 * Barato de propósito — no idle o jogador testa builds.
 */
export function respecCost(level: number, currency: Currency = 'gold'): RespecCost {
  const lvl = Math.max(1, floorNonNegative(level));
  return {
    currency,
    amount: Math.round(P.respec.baseCost * Math.pow(P.respec.perLevelMultiplier, lvl - 1)),
    perLevelMultiplier: P.respec.perLevelMultiplier,
  };
}

export interface RespecOutcome {
  readonly attributes: AttributeBlock;
  readonly unspentPoints: number;
  readonly talents: readonly ContentId[];
  readonly talentPoints: number;
}

/**
 * Devolve todos os pontos investidos (atributos + talentos) sem alterar o
 * nível. `allocationMode` não muda — o jogador escolhe se volta a auto.
 */
export function respec(character: Pick<Character, 'attributes' | 'unspentPoints' | 'talents' | 'talentPoints'>): RespecOutcome {
  const invested = Object.values(character.attributes).reduce((sum, value) => sum + floorNonNegative(value), 0);
  const talentSpent = character.talents.length;

  return {
    attributes: { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 },
    unspentPoints: character.unspentPoints + invested,
    talents: [],
    talentPoints: character.talentPoints + talentSpent,
  };
}

/** Alterna o modo e, ao entrar em `auto`, aplica imediatamente os pendentes. */
export function setAllocationMode(input: {
  readonly mode: AllocationMode;
  readonly current: Pick<Character, 'attributes' | 'unspentPoints' | 'baseClass' | 'specialization'>;
}): { readonly mode: AllocationMode; readonly attributes: AttributeBlock; readonly unspentPoints: number } {
  if (input.mode === 'manual') {
    return { mode: 'manual', attributes: input.current.attributes, unspentPoints: input.current.unspentPoints };
  }
  const preset = resolvePreset(input.current.baseClass, input.current.specialization);
  const distributed = distributeByPreset(preset, input.current.unspentPoints);
  const applied = Object.values(distributed).reduce((sum, value) => sum + safeNumber(value), 0);
  return {
    mode: 'auto',
    attributes: mergeAttributes(input.current.attributes, distributed),
    unspentPoints: input.current.unspentPoints - applied,
  };
}
