/**
 * Sorteio de loot.
 *
 * Regras da wiki aplicadas:
 *  · `DropTable` por monstro, com pesos relativos e faixa de andar.
 *  · Gold por inimigo com chance e intervalo.
 *  · `firstClearOnly` garante o drop de chefe no primeiro clear.
 *  · LUK aumenta o drop (`dropBonus`, já calculado em `DerivedStats`).
 *  · Raridade por andar: andares altos puxam a distribuição para cima, mas
 *    nunca garantem Mítica — é isso que mantém o mercado RMT vivo.
 *
 * Tudo puro: recebe `Rng`, devolve drops. Nenhum `Math.random()`.
 */
import type {
  ContentId,
  DerivedStats,
  DropEntry,
  DropTable,
  InventoryItem,
  Item,
  Rarity,
  RandomAffix,
  DerivedStatKey,
  Uuid,
} from '@/types/game';
import { RARITY_ORDER } from '@/types/game';
import { DROP_TABLE_BY_ID, floorDropTables } from '@/data/tower';
import { ITEM_BY_ID } from '@/data/items';
import type { Rng } from './rng';

/* ==========================================================================
 * TABELA DE RARIDADE POR ANDAR
 * ========================================================================== */

/**
 * Peso base de cada raridade por faixa de andar.
 * O andar desloca a curva; `shiftForFloor` interpola entre faixas.
 *
 * @tuning — estes números definem a economia. Mexer aqui muda o preço de
 * tudo no mercado; validar com telemetria antes de subir para produção.
 */
const RARITY_WEIGHTS_BY_TIER: readonly {
  readonly minFloor: number;
  readonly weights: Readonly<Record<Rarity, number>>;
}[] = [
  {
    minFloor: 1,
    weights: { common: 78, uncommon: 18, rare: 3.4, epic: 0.5, legendary: 0.09, mythic: 0.01 },
  },
  {
    minFloor: 10,
    weights: { common: 60, uncommon: 28, rare: 9, epic: 2.4, legendary: 0.5, mythic: 0.1 },
  },
  {
    minFloor: 20,
    weights: { common: 42, uncommon: 34, rare: 17, epic: 5.5, legendary: 1.3, mythic: 0.2 },
  },
  {
    minFloor: 30,
    weights: { common: 28, uncommon: 36, rare: 24, epic: 9, legendary: 2.5, mythic: 0.5 },
  },
] as const;

/** Pesos de raridade para um andar (interpolação linear entre faixas). */
export function rarityWeightsForFloor(floor: number): Readonly<Record<Rarity, number>> {
  const safeFloor = Math.max(1, Math.floor(floor));
  const tiers = RARITY_WEIGHTS_BY_TIER;

  let lower = tiers[0];
  let upper = tiers[tiers.length - 1];
  if (!lower || !upper) throw new Error('tabela de raridades vazia');

  for (let index = 0; index < tiers.length; index += 1) {
    const tier = tiers[index];
    if (!tier) continue;
    if (safeFloor >= tier.minFloor) {
      lower = tier;
      upper = tiers[index + 1] ?? tier;
    }
  }

  if (lower === upper || upper.minFloor === lower.minFloor) return lower.weights;

  const span = upper.minFloor - lower.minFloor;
  const progress = Math.min(1, (safeFloor - lower.minFloor) / span);

  const blended = {} as Record<Rarity, number>;
  for (const rarity of RARITY_ORDER) {
    blended[rarity] = lower.weights[rarity] + (upper.weights[rarity] - lower.weights[rarity]) * progress;
  }
  return blended;
}

/** Sorteia a raridade de um item dropado. */
export function rollRarity(floor: number, rng: Rng): Rarity {
  const weights = rarityWeightsForFloor(floor);
  return rng.weighted(
    RARITY_ORDER.map((rarity) => ({ value: rarity, weight: Math.max(0, weights[rarity]) })),
  );
}

/* ==========================================================================
 * AFIXOS ALEATÓRIOS
 * ========================================================================== */

/** Faixa de valor por tier de afixo (1 = baixo … 5 = perfeito). */
const AFFIX_TIERS: readonly { readonly tier: number; readonly min: number; readonly max: number }[] = [
  { tier: 1, min: 1, max: 3 },
  { tier: 2, min: 4, max: 7 },
  { tier: 3, min: 8, max: 13 },
  { tier: 4, min: 14, max: 21 },
  { tier: 5, min: 22, max: 34 },
] as const;

/** Número de afixos por raridade (0 para comum). */
const AFFIX_COUNT: Readonly<Record<Rarity, number>> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
} as const;

/** Rola os afixos de uma instância. */
export function rollAffixes(item: Item, rarity: Rarity, rng: Rng): readonly RandomAffix[] {
  const count = Math.min(AFFIX_COUNT[rarity], item.affixPool.length);
  if (count === 0) return [];

  const pool = rng.shuffle(item.affixPool);
  const affixes: RandomAffix[] = [];

  for (let index = 0; index < count; index += 1) {
    const stat = pool[index];
    if (!stat) break;
    // Tier puxado para cima em raridades altas.
    const tierFloor = Math.max(1, RARITY_ORDER.indexOf(rarity) - 1);
    const tierEntry = AFFIX_TIERS[rng.int(tierFloor - 1, AFFIX_TIERS.length - 1)] ?? AFFIX_TIERS[0];
    if (!tierEntry) continue;
    const value = rng.int(tierEntry.min, tierEntry.max);
    affixes.push({ stat, kind: isPercentStat(stat) ? 'percent' : 'flat', value, tier: tierEntry.tier });
  }

  return affixes;
}

const PERCENT_STATS: ReadonlySet<DerivedStatKey> = new Set<DerivedStatKey>([
  'crit',
  'critDamage',
  'lifesteal',
  'expBonus',
  'dropBonus',
  'attackSpeed',
  'castTime',
]);

function isPercentStat(stat: DerivedStatKey): boolean {
  return PERCENT_STATS.has(stat);
}

/* ==========================================================================
 * SORTEIO PRINCIPAL
 * ========================================================================== */

export interface DropContext {
  readonly tableId: ContentId;
  readonly floor: number;
  readonly isBoss: boolean;
  readonly firstClear: boolean;
  /** Stats do líder do squad (LUK → dropBonus). */
  readonly squadStats: Pick<DerivedStats, 'dropBonus'>;
  readonly ownerId: Uuid;
  readonly nowIso: string;
}

export interface DropResult {
  readonly items: readonly InventoryItem[];
  readonly gold: number;
  /** `true` quando o drop de first-clear disparou. */
  readonly firstClearDrop: boolean;
}

/**
 * Sorteia o loot de um inimigo derrotado.
 *
 * Chance base de item: 25% para mob normal, 100% para chefe.
 * `dropBonus` (LUK + raça) multiplica a chance, com teto de 75%.
 */
export function rollDrops(context: DropContext, rng: Rng): DropResult {
  const table: DropTable | undefined = DROP_TABLE_BY_ID.get(context.tableId);
  if (!table) return { items: [], gold: 0, firstClearDrop: false };

  const items: InventoryItem[] = [];
  let firstClearDrop = false;

  const gold = rng.chance(table.goldChance)
    ? rng.int(table.goldRange[0], table.goldRange[1]) * (context.isBoss ? 4 : 1)
    : 0;

  const baseChance = context.isBoss ? 1 : 0.25;
  const bonus = Math.min(0.75, context.squadStats.dropBonus / 100);
  const dropChance = Math.min(1, baseChance * (1 + bonus));

  // Elegibilidade: itens não aparecem cedo demais (minFloor), mas continuam a
  // cair em andares acima do maxFloor — o conteúdo escala com a torre.
  // Só entram aqui entradas de drop NORMAL (o first-clear é tratado à parte).
  let eligible: DropEntry[] = table.entries.filter(
    (entry) => entry.minFloor <= context.floor && !entry.firstClearOnly,
  );

  // Fallback: tabelas de chefe só têm o drop de first-clear. Depois do
  // primeiro clear, o chefe dropa da pool normal do bioma (senão dava só gold).
  if (eligible.length === 0) {
    eligible = collectBiomeEntries(context.floor);
  }

  // 1. Drop garantido de first-clear (antes do fallback, para não o perder)
  if (context.firstClear) {
    const guaranteed = table.entries.find((entry) => entry.firstClearOnly);
    if (guaranteed) {
      const created = buildInstance(guaranteed, context, rng);
      if (created) {
        items.push(created);
        firstClearDrop = true;
      }
    }
  }

  // 2. Drop normal ponderado
  const normal = eligible;
  if (normal.length > 0 && rng.chance(dropChance)) {
    const entry = rng.weighted(normal.map((candidate) => ({ value: candidate, weight: candidate.weight })));
    const created = buildInstance(entry, context, rng);
    if (created) items.push(created);
  }

  return { items, gold, firstClearDrop };
}

/**
 * Junta as entradas de todas as tabelas do bioma do andar, sem duplicados e
 * sem os drops de first-clear.
 */
function collectBiomeEntries(floor: number): DropEntry[] {
  const seen = new Set<ContentId>();
  const collected: DropEntry[] = [];

  for (const tableId of floorDropTables(floor)) {
    const candidate = DROP_TABLE_BY_ID.get(tableId);
    if (!candidate) continue;
    for (const entry of candidate.entries) {
      if (entry.firstClearOnly || entry.minFloor > floor) continue;
      if (seen.has(entry.itemId)) continue;
      seen.add(entry.itemId);
      collected.push(entry);
    }
  }

  return collected;
}


function buildInstance(entry: DropEntry, context: DropContext, rng: Rng): InventoryItem | null {
  const item = ITEM_BY_ID.get(entry.itemId);
  if (!item) return null;

  // Chefes sobem 2 tiers de raridade — é o que sustenta o valor de mercado.
  const rarity = context.isBoss
    ? raiseRarity(rollRarity(context.floor, rng), 2)
    : rollRarity(context.floor, rng);

  const socketCount = Math.min(item.socketCount, 4);
  const sockets = Array.from({ length: socketCount }, () => null);

  return {
    id: `item-${context.floor}-${rng.int(0, 0xffffffff).toString(16)}` as Uuid,
    itemId: item.id,
    ownerId: context.ownerId,
    rarity,
    refineLevel: 0,
    affixes: rollAffixes(item, rarity, rng),
    sockets,
    equippedSlot: null,
    equippedBy: null,
    bound: false,
    locked: false,
    obtainedAt: context.nowIso,
    droppedAtFloor: context.floor,
  };
}

/** Sobe uma raridade `steps` níveis (chefes dropam melhor). */
export function raiseRarity(rarity: Rarity, steps: number): Rarity {
  const index = RARITY_ORDER.indexOf(rarity);
  const target = Math.min(RARITY_ORDER.length - 1, Math.max(0, index + steps));
  return RARITY_ORDER[target] ?? rarity;
}

/* ==========================================================================
 * PROGRESSO OFFLINE
 * ========================================================================== */

export interface OfflineDropInput {
  readonly seconds: number;
  readonly floor: number;
  readonly tableIds: readonly ContentId[];
  readonly squadStats: Pick<DerivedStats, 'dropBonus'>;
  readonly ownerId: Uuid;
  readonly nowIso: string;
}

/**
 * Estima os drops de um período offline.
 *
 * Não simula o combate: usa a taxa média de kills por segundo do andar e
 * multiplica. É o que a wiki pede ("calcula XP e Ouro ao retornar") sem
 * obrigar o servidor a correr horas de loop.
 */
export function estimateOfflineDrops(input: OfflineDropInput, rng: Rng): DropResult {
  const killsPerSecond = 0.35 / (1 + input.floor * 0.05); // @tuning
  const kills = Math.floor(input.seconds * killsPerSecond);
  if (kills <= 0 || input.tableIds.length === 0) {
    return { items: [], gold: 0, firstClearDrop: false };
  }

  const items: InventoryItem[] = [];
  let gold = 0;

  for (let kill = 0; kill < kills; kill += 1) {
    const tableId = rng.pick(input.tableIds);
    const result = rollDrops(
      {
        tableId,
        floor: input.floor,
        isBoss: false,
        firstClear: false,
        squadStats: input.squadStats,
        ownerId: input.ownerId,
        nowIso: input.nowIso,
      },
      rng,
    );
    gold += result.gold;
    // Offline guarda no máximo 10 itens — evita inundar o inventário.
    if (items.length < 10) items.push(...result.items);
  }

  return { items: items.slice(0, 10), gold, firstClearDrop: false };
}
