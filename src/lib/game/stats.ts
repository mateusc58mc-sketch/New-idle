/**
 * Resolução de stats derivados.
 *
 * Ordem de aplicação (única e documentada — a wiki deixou isto em aberto):
 *
 *   1. Base da classe por nível
 *   2. Atributos primários (distribuídos + raça)
 *   3. Modificadores `flat` de raça, equipamento, cartas, talentos, prestígio
 *   4. Conversão para derivados (ATK, MATK, HIT, FLEE, CRIT, ASPD, MaxHP…)
 *   5. Modificadores `percent` somados e aplicados por cima
 *   6. Buffs temporários de combate (aplicados no motor, não aqui)
 *
 * `flat` antes de `percent` é o que impede "exploits" de arredondamento e
 * mantém a curva previsível para o balanceamento.
 */
import type {
  AttributeBlock,
  BaseClass,
  DerivedStatKey,
  DerivedStats,
  EquipmentSlot,
  InventoryItem,
  Item,
  PrimaryAttribute,
  Race,
  StatModifier,
} from '@/types/game';
import { CLASS_MAIN_ATTRIBUTE } from '@/types/game';
import { BALANCE } from './balance';
import {
  computeAttackSpeed,
  computeAtk,
  computeCastTime,
  computeCrit,
  computeFlee,
  computeHit,
  computeMatk,
  computeMaxHp,
  floorNonNegative,
  safeNumber,
} from './formulas';

/** Base de stats por classe, no nível 1. @tuning */
export const CLASS_BASE_STATS: Readonly<
  Record<BaseClass, { readonly hp: number; readonly mp: number; readonly attacksPerSec: number; readonly castSec: number }>
> = {
  warrior: { hp: 220, mp: 40, attacksPerSec: 0.85, castSec: 0 },
  hunter: { hp: 150, mp: 60, attacksPerSec: 1.15, castSec: 0 },
  cleric: { hp: 160, mp: 140, attacksPerSec: 0.8, castSec: 1.2 },
  mage: { hp: 130, mp: 180, attacksPerSec: 0.75, castSec: 2 },
} as const;

export interface StatContext {
  readonly baseClass: BaseClass;
  readonly level: number;
  readonly attributes: AttributeBlock;
  readonly race: Race | null;
  readonly equipment: readonly EquipmentEntry[];
  readonly talents: readonly StatModifier[];
  readonly prestige: readonly StatModifier[];
  readonly buffs: readonly StatModifier[];
}

export interface EquipmentEntry {
  readonly instance: InventoryItem;
  readonly definition: Item;
}

/* ==========================================================================
 * ATRIBUTOS PRIMÁRIOS FINAIS
 * ========================================================================== */

/** Atributos distribuídos + bónus racial + bónus `flat` de equipamento. */
export function resolveAttributes(ctx: StatContext): AttributeBlock {
  const total: Record<PrimaryAttribute, number> = {
    str: Math.max(0, safeNumber(ctx.attributes.str)),
    agi: Math.max(0, safeNumber(ctx.attributes.agi)),
    vit: Math.max(0, safeNumber(ctx.attributes.vit)),
    int: Math.max(0, safeNumber(ctx.attributes.int)),
    dex: Math.max(0, safeNumber(ctx.attributes.dex)),
    luk: Math.max(0, safeNumber(ctx.attributes.luk)),
  };

  if (ctx.race) {
    for (const [key, value] of Object.entries(ctx.race.attributeBonus)) {
      const attr = key as PrimaryAttribute;
      total[attr] += safeNumber(value);
    }
  }

  for (const modifier of allFlatModifiers(ctx)) {
    // Só modificadores que apontam para atributos primários entram aqui.
    const stat: string = modifier.stat;
    if (isPrimaryAttribute(stat)) {
      total[stat] += modifier.value;
    }
  }

  return {
    str: Math.round(total.str),
    agi: Math.round(total.agi),
    vit: Math.round(total.vit),
    int: Math.round(total.int),
    dex: Math.round(total.dex),
    luk: Math.round(total.luk),
  };
}

const PRIMARY_ATTRIBUTES: ReadonlySet<string> = new Set<string>(['str', 'agi', 'vit', 'int', 'dex', 'luk']);

function isPrimaryAttribute(stat: string): stat is PrimaryAttribute {
  return PRIMARY_ATTRIBUTES.has(stat);
}

/* ==========================================================================
 * MODIFICADORES
 * ========================================================================== */

function equipmentModifiers(ctx: StatContext): readonly StatModifier[] {
  const out: StatModifier[] = [];
  for (const entry of ctx.equipment) {
    const refineMultiplier = 1 + entry.instance.refineLevel * BALANCE.economy.refine.bonusPerLevelPct;

    for (const mod of entry.definition.baseModifiers) {
      out.push({
        stat: mod.stat,
        kind: mod.kind,
        // O refino escala só valores `flat` de ataque/defesa, não percentagens.
        value: mod.kind === 'flat' && isRefinable(mod.stat) ? mod.value * refineMultiplier : mod.value,
        source: mod.source,
      });
    }

    for (const affix of entry.instance.affixes) {
      out.push({
        stat: affix.stat,
        kind: affix.kind,
        value: affix.value,
        source: { type: 'item', itemId: entry.instance.id },
      });
    }

    for (const card of entry.instance.sockets) {
      if (!card) continue;
      for (const mod of card.effect.modifiers) {
        out.push({ ...mod, source: { type: 'card', cardId: card.cardId } });
      }
    }
  }
  return out;
}

const REFINABLE_STATS: ReadonlySet<DerivedStatKey> = new Set<DerivedStatKey>(['atk', 'matk', 'def', 'mdef']);

function isRefinable(stat: DerivedStatKey): boolean {
  return REFINABLE_STATS.has(stat);
}

function raceModifiers(ctx: StatContext): readonly StatModifier[] {
  if (!ctx.race) return [];
  return ctx.race.modifiers.map((mod) => ({
    stat: mod.stat,
    kind: mod.kind,
    value: mod.value,
    source: { type: 'race' as const, raceId: ctx.race?.id ?? '' },
  }));
}

function allModifiers(ctx: StatContext): readonly StatModifier[] {
  return [...raceModifiers(ctx), ...equipmentModifiers(ctx), ...ctx.talents, ...ctx.prestige, ...ctx.buffs];
}

function allFlatModifiers(ctx: StatContext): readonly StatModifier[] {
  return allModifiers(ctx).filter((mod) => mod.kind === 'flat');
}

/** Soma de percentagens por stat (ex.: 12 = +12%). */
function percentTotals(ctx: StatContext): Readonly<Record<DerivedStatKey, number>> {
  const totals = emptyStatRecord();
  for (const mod of allModifiers(ctx)) {
    if (mod.kind === 'percent') totals[mod.stat] += mod.value;
  }
  return totals;
}

/** Soma de `flat` por stat, ignorando atributos primários. */
function flatTotals(ctx: StatContext): Readonly<Record<DerivedStatKey, number>> {
  const totals = emptyStatRecord();
  for (const mod of allModifiers(ctx)) {
    if (mod.kind === 'flat' && !isPrimaryAttribute(mod.stat)) {
      totals[mod.stat] += mod.value;
    }
  }
  return totals;
}

export function emptyStatRecord(): Record<DerivedStatKey, number> {
  return {
    maxHp: 0,
    maxMp: 0,
    atk: 0,
    matk: 0,
    def: 0,
    mdef: 0,
    hit: 0,
    flee: 0,
    crit: 0,
    critDamage: 0,
    attackSpeed: 0,
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
}

/* ==========================================================================
 * STATS DERIVADOS
 * ========================================================================== */

export function resolveDerivedStats(ctx: StatContext): DerivedStats {
  const attrs = resolveAttributes(ctx);
  const flat = flatTotals(ctx);
  const pct = percentTotals(ctx);
  const base = CLASS_BASE_STATS[ctx.baseClass];
  const level = Math.max(1, floorNonNegative(ctx.level));
  const levelScale = 1 + (level - 1) * 0.08; // @tuning — crescimento linear por nível

  const applyPct = (stat: DerivedStatKey, value: number): number => value * (1 + pct[stat] / 100);

  const maxHp = applyPct('maxHp', computeMaxHp(base.hp * levelScale + flat.maxHp, attrs.vit));
  const maxMp = applyPct('maxMp', Math.round(base.mp * levelScale + flat.maxMp));

  const atk = applyPct(
    'atk',
    computeAtk({
      weaponAtk: flat.atk,
      refineLevel: 0, // o refino já entrou em `flat.atk` via equipmentModifiers
      str: attrs.str,
      dex: attrs.dex,
      luk: attrs.luk,
    }),
  );

  const matk = applyPct(
    'matk',
    computeMatk({ weaponMatk: flat.matk, refineLevel: 0, int: attrs.int }),
  );

  const mainAttr = CLASS_MAIN_ATTRIBUTE[ctx.baseClass];
  const isMagic = mainAttr === 'int';

  const attackSpeed = computeAttackSpeed({
    baseAttacksPerSec: base.attacksPerSec,
    agi: attrs.agi,
    dex: attrs.dex,
  });

  return {
    maxHp: Math.round(maxHp),
    maxMp: Math.round(maxMp),
    // ATK efectivo: a classe fisica usa o ataque fisico; a classe magica usa
    // o magico. max() garante que uma arma fisica nunca e ignorada por um mago.
    atk: Math.round(isMagic ? Math.max(matk, atk) : atk),
    matk: Math.round(matk),
    def: Math.round(applyPct('def', flat.def + attrs.vit * 0.5)),
    mdef: Math.round(applyPct('mdef', flat.mdef + attrs.int * 0.5)),
    hit: computeHit({ level, dex: attrs.dex, bonus: flat.hit }),
    flee: computeFlee({ level, agi: attrs.agi, bonus: flat.flee }),
    crit: computeCrit(attrs.luk, flat.crit),
    critDamage: BALANCE.stats.crit.damageMultiplier * 100 + flat.critDamage + pct.critDamage,
    attackSpeed,
    castTime: computeCastTime(base.castSec, attrs.dex),
    healPower: Math.round(applyPct('healPower', matk * 0.5)),
    lifesteal: clampPercent(flat.lifesteal + pct.lifesteal),
    expBonus: clampPercent(flat.expBonus + pct.expBonus),
    dropBonus: clampPercent(flat.dropBonus + pct.dropBonus + attrs.luk * BALANCE.stats.drop.lukPct * 100),
    // Stats utilitários (raças): regeneração, resistência, low-HP e duração de buff.
    regenPct: Math.max(0, flat.regenPct + pct.regenPct),
    controlResist: clampPercent(flat.controlResist + pct.controlResist),
    lowHpAtk: Math.max(0, flat.lowHpAtk + pct.lowHpAtk),
    buffDuration: Math.max(0, flat.buffDuration + pct.buffDuration),
  };
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, safeNumber(value)));
}

/**
 * Combat Power — número único do HUD (equivalente ao "CP" da Arena).
 * Ponderado para crescer com o que realmente importa no idle.
 */
export function computeCombatPower(stats: DerivedStats): number {
  const offence = stats.atk * 2 + stats.matk * 2 + stats.crit * 3 + stats.attackSpeed * 200;
  const defence = stats.maxHp * 0.6 + stats.def * 2 + stats.mdef * 2 + stats.flee;
  const utility = stats.healPower * 1.5 + stats.hit * 0.5;
  return Math.round(offence + defence + utility);
}

/** Ordena equipamento por slot, para o Paperdoll e para o cálculo. */
export function equipmentEntries(
  equipment: Readonly<Record<EquipmentSlot, InventoryItem | null>>,
  catalogue: ReadonlyMap<string, Item>,
): readonly EquipmentEntry[] {
  const out: EquipmentEntry[] = [];
  for (const instance of Object.values(equipment)) {
    if (!instance) continue;
    const definition = catalogue.get(instance.itemId);
    if (!definition) continue;
    out.push({ instance, definition });
  }
  return out;
}
