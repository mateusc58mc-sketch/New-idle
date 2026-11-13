/**
 * Hidratação do equipamento persistido (`squad_characters.equipped_items`).
 *
 * O banco guarda o loadout como JSON livre (ver `supabase/migrations`), por
 * isso o HUD nunca pode assumir uma forma única. Este módulo aceita as duas
 * representações que o projeto já produz/escreve:
 *
 *   · `{ weapon: "<uuid do inventário>" }`        → resolve pela linha da tabela;
 *   · `{ weapon: { item_id, rarity, ... } }`      → instância completa;
 *   · `[{ slot: 'weapon', item_id: ... }]`        → forma em lista.
 *
 * Qualquer entrada inválida é ignorada — o avatar simplesmente aparece sem a
 * peça. Nada aqui lança: é o mesmo contrato de `resolvePaperdoll`.
 */
import { ITEM_BY_ID } from '@/data/items';
import { EQUIPMENT_SLOTS } from '@/data/paperdoll-layers';
import type { EquipmentLoadout, EquipmentSlot, InventoryItem, Rarity } from '@/types/game';

/** Linha mínima do inventário necessária para reconstruir uma instância. */
export interface EquippedItemRow {
  readonly id: string;
  readonly item_id: string;
  readonly rarity: string;
  readonly enhancement_level?: number | null;
}

const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEquipmentSlot(value: string): value is EquipmentSlot {
  return (EQUIPMENT_SLOTS as readonly string[]).includes(value);
}

function asRarity(value: unknown): Rarity | null {
  if (typeof value !== 'string') return null;
  return (RARITIES as readonly string[]).includes(value) ? (value as Rarity) : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function instanceFromRow(row: EquippedItemRow, ownerId: string): InventoryItem {
  return {
    id: row.id,
    itemId: row.item_id,
    ownerId,
    rarity: asRarity(row.rarity) ?? 'common',
    refineLevel: Math.max(0, Math.trunc(asNumber(row.enhancement_level) ?? 0)),
    affixes: [],
    sockets: [],
    equippedSlot: null,
    equippedBy: ownerId,
    bound: false,
    locked: false,
    obtainedAt: '',
    droppedAtFloor: null,
  };
}

function instanceFromItemId(itemId: string, ownerId: string): InventoryItem | null {
  const definition = resolveDefinition(itemId);
  if (!definition) return null;
  return {
    id: `${definition.id}:equipped`,
    itemId: definition.id,
    ownerId,
    rarity: definition.rarity,
    refineLevel: 0,
    affixes: [],
    sockets: [],
    equippedSlot: null,
    equippedBy: ownerId,
    bound: false,
    locked: false,
    obtainedAt: '',
    droppedAtFloor: null,
  };
}

/**
 * O catálogo usa ids prefixados (`item.wpn.iron_sword`), mas o banco pode
 * guardar tanto o id completo quanto o id "cru" do seed. Aceitamos ambos.
 */
function resolveDefinition(itemId: string) {
  return ITEM_BY_ID.get(itemId) ?? ITEM_BY_ID.get(`item.${itemId}`) ?? null;
}

function findRow(value: string, inventory: readonly EquippedItemRow[]): EquippedItemRow | null {
  return inventory.find((row) => row.id === value || row.item_id === value) ?? null;
}

/** Converte uma entrada bruta (string ou objecto) numa instância. */
function toInstance(
  raw: unknown,
  inventory: readonly EquippedItemRow[],
  ownerId: string,
): InventoryItem | null {
  if (typeof raw === 'string') {
    const row = findRow(raw, inventory);
    if (row) return instanceFromRow(row, ownerId);
    return instanceFromItemId(raw, ownerId);
  }

  if (!isRecord(raw)) return null;

  // `id` pode ser o UUID da instância — se casar com o inventário, ele manda.
  const rawId = asString(raw.id);
  const row = rawId ? findRow(rawId, inventory) : null;

  const itemId = asString(raw.itemId) ?? asString(raw.item_id) ?? row?.item_id ?? null;
  if (!itemId) return null;

  const definition = resolveDefinition(itemId);
  const canonicalId = definition?.id ?? itemId;
  const rarity =
    asRarity(raw.rarity) ??
    asRarity(row?.rarity) ??
    definition?.rarity ??
    'common';
  const refineLevel =
    asNumber(raw.refineLevel) ??
    asNumber(raw.enhancement_level) ??
    asNumber(row?.enhancement_level) ??
    0;

  return {
    id: rawId ?? row?.id ?? `${canonicalId}:equipped`,
    itemId: canonicalId,
    ownerId: asString(raw.ownerId) ?? ownerId,
    rarity,
    refineLevel: Math.max(0, Math.trunc(refineLevel)),
    affixes: [],
    sockets: [],
    equippedSlot: null,
    equippedBy: asString(raw.equippedBy) ?? ownerId,
    bound: raw.bound === true,
    locked: raw.locked === true,
    obtainedAt: asString(raw.obtainedAt) ?? '',
    droppedAtFloor: asNumber(raw.droppedAtFloor),
  };
}

/** Entradas `[slot, valor]` — mapa ou lista `{ slot, ... }`. */
function entriesOf(equippedItems: unknown): readonly (readonly [string, unknown])[] {
  if (Array.isArray(equippedItems)) {
    return equippedItems.flatMap((entry): (readonly [string, unknown])[] => {
      if (!isRecord(entry)) return [];
      const slot = asString(entry.slot);
      return slot ? [[slot, entry] as const] : [];
    });
  }
  return isRecord(equippedItems) ? Object.entries(equippedItems) : [];
}

/**
 * Garante uma arma inicial no loadout — validação visual imediata do raster
 * (Fase 2 do Master Visual Plan).
 *
 * Regras:
 *  · herói SEM arma equipada recebe `item.wpn.iron_sword` (common) — assim a
 *    `/game` mostra o PNG hand-painted no primeiro carregamento, sem farm;
 *  · herói COM arma persistida mantém a dele (o banco manda sobre o starter);
 *  · nunca lança: item ausente do catálogo devolve o loadout intacto.
 *
 * A instância é sintética e efémera (`id: "<itemId>:starter"`): a sync só
 * grava perfil + inventário, nunca `equipped_items`, por isso não contamina
 * o banco.
 */
export const STARTER_WEAPON_ITEM_ID = 'item.wpn.iron_sword';

export function ensureStarterWeapon(
  loadout: EquipmentLoadout,
  ownerId: string,
  itemId: string = STARTER_WEAPON_ITEM_ID,
): EquipmentLoadout {
  if (loadout.weapon) return loadout;

  const definition = resolveDefinition(itemId);
  if (!definition || definition.slot !== 'weapon') return loadout;

  const instance: InventoryItem = {
    id: `${definition.id}:starter`,
    itemId: definition.id,
    ownerId,
    rarity: definition.rarity,
    refineLevel: 0,
    affixes: [],
    sockets: [],
    equippedSlot: 'weapon',
    equippedBy: ownerId,
    bound: false,
    locked: false,
    obtainedAt: '',
    droppedAtFloor: null,
  };
  return { ...loadout, weapon: instance };
}

/**
 * `equipped_items` (JSON) + linhas do inventário → `EquipmentLoadout`.
 * Nunca lança; slots inválidos/vazios ficam a `null`.
 */
export function equipmentFromRow(
  equippedItems: unknown,
  inventory: readonly EquippedItemRow[] = [],
  ownerId = '',
): EquipmentLoadout {
  const loadout: Record<EquipmentSlot, InventoryItem | null> = {
    helmet: null,
    armor: null,
    weapon: null,
    offhand: null,
    cloak: null,
    boots: null,
    accessory: null,
    aura: null,
    wings: null,
  };

  for (const [slotKey, raw] of entriesOf(equippedItems)) {
    if (!isEquipmentSlot(slotKey)) continue;
    if (raw === null || raw === undefined) continue;
    const instance = toInstance(raw, inventory, ownerId);
    if (instance) loadout[slotKey] = instance;
  }

  return loadout;
}
