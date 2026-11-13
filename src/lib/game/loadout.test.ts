/**
 * Loadout — hidratação de `equipped_items` + arma inicial do herói starter.
 *
 * A `ensureStarterWeapon` existe para a Fase 2: validar o PNG raster da
 * iron_sword na `/game` no primeiro carregamento, sem farmar.
 */
import { describe, expect, it } from 'vitest';

import { ITEM_BY_ID } from '@/data/items';
import { RACE_BY_ID } from '@/data/races';
import { resolvePaperdoll } from '@/lib/game/paperdoll';
import type { Appearance, EquipmentSlot, InventoryItem } from '@/types/game';

import { STARTER_WEAPON_ITEM_ID, ensureStarterWeapon, equipmentFromRow } from './loadout';

function emptyLoadout(): Record<EquipmentSlot, InventoryItem | null> {
  return {
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
}

const appearance: Appearance = {
  raceId: 'race.human',
  bodyVariant: 0,
  skinTone: '#e8c39e',
  hairStyle: 'short',
  hairColor: '#4a3728',
  cosmetic: { aura: null, wings: null, body: null, armor: null, helmet: null, weapon: null, vfx: null },
  auraColor: null,
};

describe('ensureStarterWeapon', () => {
  it('herói sem arma recebe a iron_sword starter (common)', () => {
    const loadout = ensureStarterWeapon(emptyLoadout(), 'owner-1');
    const weapon = loadout.weapon;

    expect(weapon).not.toBeNull();
    expect(weapon?.itemId).toBe(STARTER_WEAPON_ITEM_ID);
    expect(weapon?.itemId).toBe('item.wpn.iron_sword');
    expect(weapon?.rarity).toBe('common');
    expect(weapon?.equippedSlot).toBe('weapon');
    expect(weapon?.equippedBy).toBe('owner-1');
    expect(weapon?.refineLevel).toBe(0);
    expect(weapon?.id).toBe('item.wpn.iron_sword:starter');
  });

  it('a arma starter existe no catálogo e é do slot weapon', () => {
    const definition = ITEM_BY_ID.get(STARTER_WEAPON_ITEM_ID);
    expect(definition?.slot).toBe('weapon');
    expect(definition?.rarity).toBe('common');
  });

  it('herói com arma persistida mantém a sua', () => {
    const loadout = equipmentFromRow(
      { weapon: { item_id: 'item.wpn.hunter_bow' } },
      [],
      'owner-1',
    );
    const before = loadout.weapon;

    const result = ensureStarterWeapon(loadout, 'owner-1');
    expect(result.weapon).toBe(before);
    expect(result.weapon?.itemId).toBe('item.wpn.hunter_bow');
  });

  it('item desconhecido devolve o loadout intacto (nunca lança)', () => {
    const loadout = ensureStarterWeapon(emptyLoadout(), 'owner-1', 'item.wpn.nao_existe');
    expect(loadout.weapon).toBeNull();
  });

  it('a arma starter cai no PNG raster (manifesto real + resolver real)', () => {
    const human = RACE_BY_ID.get('race.human');
    if (!human) throw new Error('raça human ausente');

    const loadout = ensureStarterWeapon(emptyLoadout(), 'owner-1');
    const result = resolvePaperdoll({
      race: human,
      appearance,
      equipment: loadout,
      catalogue: ITEM_BY_ID,
    });

    const weaponLayer = result.state.layers.find((layer) => layer.slot === 'weapon');
    expect(weaponLayer?.rasterSrc).toBe('/assets/sprites/weapons/iron_sword.png');
    expect(weaponLayer?.rarity).toBe('common');
  });
});

describe('equipmentFromRow (contratos existentes)', () => {
  it('entrada vazia → todos os slots a null', () => {
    expect(equipmentFromRow(null)).toEqual(emptyLoadout());
  });

  it('id cru do banco resolve para o id canónico do catálogo', () => {
    const loadout = equipmentFromRow({ weapon: 'wpn.iron_sword' });
    expect(loadout.weapon?.itemId).toBe('item.wpn.iron_sword');
  });
});
