import { describe, expect, it } from 'vitest';

import { RACES, RACE_BY_ID, STARTER_RACES } from '@/data/races';
import { BASE_CLASSES, SPECIALIZATIONS, TALENTS, talentsFor } from '@/data/classes';
import { SKILLS, skillsFor } from '@/data/skills';
import { ITEMS, itemsForSlot } from '@/data/items';
import { BOSSES, FLOORS, MONSTERS, getFloor } from '@/data/tower';
import { resolvePaperdoll, highestRarity } from './paperdoll';
import type { Appearance, EquipmentSlot, InventoryItem, Item } from '@/types/game';

describe('catálogo de raças', () => {
  it('tem as 9 raças clássicas', () => {
    expect(RACES.length).toBe(9);
    const slugs = RACES.map((race) => race.slug);
    expect(slugs).toEqual([
      'human', 'dwarf', 'elf', 'goblin', 'orc', 'tauren', 'pandaren', 'undead', 'troll',
    ]);
  });

  it('todas partilham o MESMO canvas', () => {
    const first = RACES[0]?.paperdoll.canvas;
    for (const race of RACES) {
      expect(race.paperdoll.canvas).toEqual(first);
    }
  });

  it('todas partilham as MESMAS âncoras (alinhamento garantido)', () => {
    const first = RACES[0]?.paperdoll.anchors;
    for (const race of RACES) {
      expect(race.paperdoll.anchors).toEqual(first);
    }
  });

  it('só o corpo difere entre raças', () => {
    const sources = new Set(RACES.map((race) => race.paperdoll.bodyLayer.src));
    expect(sources.size).toBe(RACES.length);
  });

  it('todas as raças têm âncora de corpo', () => {
    for (const race of RACES) {
      expect(race.paperdoll.anchors.body).toBeDefined();
    }
  });

  it('tem raças iniciais suficientes para criar personagem', () => {
    expect(STARTER_RACES.length).toBeGreaterThanOrEqual(4);
  });

  it('índice por id funciona', () => {
    expect(RACE_BY_ID.get('race.elf')?.name).toBe('Elfo');
    expect(RACE_BY_ID.get('race.naoexiste')).toBeUndefined();
  });
});

describe('catálogo de classes', () => {
  it('tem 4 classes-base e 8 especializações', () => {
    expect(BASE_CLASSES.length).toBe(4);
    expect(SPECIALIZATIONS.length).toBe(8);
  });

  it('cada classe tem 2 especializações', () => {
    for (const base of BASE_CLASSES) {
      expect(base.specializations.length).toBe(2);
    }
  });

  it('tem 12 talentos por especialização (3 árvores × 4)', () => {
    for (const spec of SPECIALIZATIONS) {
      expect(talentsFor(spec.id).length).toBe(12);
    }
    expect(TALENTS.length).toBe(96);
  });

  it('os pré-requisitos apontam para talentos existentes', () => {
    const ids = new Set(TALENTS.map((talent) => talent.id));
    for (const talent of TALENTS) {
      for (const requirement of talent.requires) {
        expect(ids.has(requirement)).toBe(true);
      }
    }
  });
});

describe('catálogo de skills', () => {
  it('tem 32 skills do MVP', () => {
    expect(SKILLS.length).toBe(32);
  });

  it('4 skills por especialização', () => {
    for (const spec of SPECIALIZATIONS) {
      expect(skillsFor(spec.id).length).toBe(4);
    }
  });

  it('os valores por raridade são crescentes', () => {
    for (const skill of SKILLS) {
      const v = skill.rarityValues;
      expect(v.common).toBeLessThanOrEqual(v.uncommon);
      expect(v.uncommon).toBeLessThanOrEqual(v.rare);
      expect(v.rare).toBeLessThanOrEqual(v.epic);
      expect(v.epic).toBeLessThanOrEqual(v.legendary);
      expect(v.legendary).toBeLessThanOrEqual(v.mythic);
    }
  });

  it('ids são únicos', () => {
    expect(new Set(SKILLS.map((skill) => skill.id)).size).toBe(SKILLS.length);
  });
});

describe('catálogo de itens', () => {
  it('tem 20 itens base', () => {
    expect(ITEMS.length).toBe(20);
  });

  it('cobre os 9 slots de equipamento', () => {
    const slots = new Set(ITEMS.map((item) => item.slot));
    const expected: EquipmentSlot[] = [
      'helmet',
      'armor',
      'weapon',
      'offhand',
      'cloak',
      'boots',
      'accessory',
    ];
    for (const slot of expected) {
      expect(slots.has(slot)).toBe(true);
    }
  });

  it('todas as peças têm referência de Paperdoll', () => {
    for (const item of ITEMS) {
      expect(item.paperdoll).not.toBeNull();
      expect(item.paperdoll?.asset.src.startsWith('/assets/paperdoll/')).toBe(true);
    }
  });

  it('peitoral e arma têm sockets de carta', () => {
    expect(itemsForSlot('armor').every((item) => item.socketCount > 0)).toBe(true);
    expect(itemsForSlot('weapon').every((item) => item.socketCount > 0)).toBe(true);
  });

  it('ids são únicos', () => {
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(ITEMS.length);
  });
});

describe('catálogo da torre', () => {
  it('tem 30 andares', () => {
    expect(FLOORS.length).toBe(30);
  });

  it('andares múltiplos de 10 são de chefão', () => {
    for (const floor of FLOORS) {
      expect(floor.isBossFloor).toBe(floor.floor % 10 === 0);
      if (floor.isBossFloor) expect(floor.bossMonsterId).not.toBeNull();
    }
  });

  it('todos os mobs referenciados existem', () => {
    const ids = new Set([...MONSTERS, ...BOSSES].map((monster) => monster.id));
    for (const floor of FLOORS) {
      for (const mob of floor.mobPool) expect(ids.has(mob)).toBe(true);
      if (floor.bossMonsterId) expect(ids.has(floor.bossMonsterId)).toBe(true);
    }
  });

  it('cada bioma tem fundo próprio', () => {
    const biomes = new Set(FLOORS.map((floor) => floor.backgroundAsset.src));
    expect(biomes.size).toBe(6);
  });

  it('getFloor escala além dos 30 andares', () => {
    expect(getFloor(45).floor).toBe(45);
    expect(getFloor(0).floor).toBe(1);
  });
});

describe('resolvePaperdoll', () => {
  const catalogue: ReadonlyMap<string, Item> = new Map(ITEMS.map((item) => [item.id, item]));

  function instance(itemId: string, slot: EquipmentSlot, rarity: Item['rarity']): InventoryItem {
    return {
      id: `inst-${itemId}`,
      itemId,
      ownerId: 'player-1',
      rarity,
      refineLevel: 0,
      affixes: [],
      sockets: [],
      equippedSlot: slot,
      equippedBy: 'char-1',
      bound: false,
      locked: false,
      obtainedAt: '2026-01-01T00:00:00.000Z',
      droppedAtFloor: 1,
    };
  }

  const emptyEquipment: Record<EquipmentSlot, InventoryItem | null> = {
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

  const appearance: Appearance = {
    raceId: 'race.human',
    bodyVariant: 0,
    skinTone: '#e8c39e',
    hairStyle: 'short',
    hairColor: '#4a3728',
    cosmetic: { aura: null, wings: null, body: null, armor: null, helmet: null, weapon: null, vfx: null },
    auraColor: null,
  };

  const human = RACE_BY_ID.get('race.human');
  if (!human) throw new Error('raça human ausente');

  it('sem equipamento desenha só o corpo', () => {
    const result = resolvePaperdoll({ race: human, appearance, equipment: emptyEquipment, catalogue });
    expect(result.state.layers.length).toBe(1);
    expect(result.state.layers[0]?.key).toBe('body');
  });

  it('respeita a ordem das camadas', () => {
    const equipment: Record<EquipmentSlot, InventoryItem | null> = {
      ...emptyEquipment,
      weapon: instance('item.wpn.iron_sword', 'weapon', 'common'),
      helmet: instance('item.hlm.iron_helm', 'helmet', 'uncommon'),
      armor: instance('item.arm.plate_mail', 'armor', 'uncommon'),
    };
    const result = resolvePaperdoll({ race: human, appearance, equipment, catalogue });
    const keys = result.state.layers.map((layer) => layer.key);
    expect(keys).toEqual(['body', 'armor', 'helmet', 'weapon']);
  });

  it('capa desenha-se atrás do corpo', () => {
    const equipment: Record<EquipmentSlot, InventoryItem | null> = {
      ...emptyEquipment,
      cloak: instance('item.clk.traveler_cloak', 'cloak', 'uncommon'),
      armor: instance('item.arm.plate_mail', 'armor', 'uncommon'),
    };
    const result = resolvePaperdoll({ race: human, appearance, equipment, catalogue });
    const cloak = result.state.layers.find((layer) => layer.slot === 'cloak');
    const armor = result.state.layers.find((layer) => layer.slot === 'armor');
    expect(cloak?.zOffset).toBeLessThan(armor?.zOffset ?? 0);
  });

  it('ignora itens desconhecidos sem lançar', () => {
    const equipment: Record<EquipmentSlot, InventoryItem | null> = {
      ...emptyEquipment,
      weapon: instance('item.naoexiste', 'weapon', 'common'),
    };
    const result = resolvePaperdoll({ race: human, appearance, equipment, catalogue });
    expect(result.state.layers.length).toBe(1);
  });

  it('glow segue a raridade mais alta equipada', () => {
    const equipment: Record<EquipmentSlot, InventoryItem | null> = {
      ...emptyEquipment,
      weapon: instance('item.wpn.dragon_spear', 'weapon', 'legendary'),
      armor: instance('item.arm.plate_mail', 'armor', 'uncommon'),
    };
    const result = resolvePaperdoll({ race: human, appearance, equipment, catalogue });
    expect(result.state.glow).toContain('251 191 36');
  });

  it('highestRarity ordena correctamente', () => {
    expect(highestRarity(['common', 'epic', 'rare'])).toBe('epic');
    expect(highestRarity([])).toBeNull();
  });

  it('a mesma resolução serve squad e mercado (mesma arte)', () => {
    const equipment: Record<EquipmentSlot, InventoryItem | null> = {
      ...emptyEquipment,
      armor: instance('item.arm.arcane_robe', 'armor', 'rare'),
    };
    const a = resolvePaperdoll({ race: human, appearance, equipment, catalogue });
    const b = resolvePaperdoll({ race: human, appearance, equipment, catalogue });
    expect(a.state.layers).toEqual(b.state.layers);
  });

  it('usa o PNG raster do manifesto quando existe', () => {
    const equipment: Record<EquipmentSlot, InventoryItem | null> = {
      ...emptyEquipment,
      weapon: instance('item.wpn.iron_sword', 'weapon', 'common'),
    };
    const result = resolvePaperdoll({
      race: human,
      appearance,
      equipment,
      catalogue,
      rasterAssets: new Set(['/assets/sprites/weapons/iron_sword.png']),
    });
    const weapon = result.state.layers.find((layer) => layer.slot === 'weapon');
    expect(weapon?.rasterSrc).toBe('/assets/sprites/weapons/iron_sword.png');
  });

  it('sem PNG cai no template vectorial (rasterSrc null)', () => {
    const equipment: Record<EquipmentSlot, InventoryItem | null> = {
      ...emptyEquipment,
      helmet: instance('item.hlm.iron_helm', 'helmet', 'uncommon'),
    };
    const result = resolvePaperdoll({ race: human, appearance, equipment, catalogue });
    const helmet = result.state.layers.find((layer) => layer.slot === 'helmet');
    expect(helmet?.rasterSrc).toBeNull();
  });

  it('o corpo usa characters/[raceId].png quando registado', () => {
    const result = resolvePaperdoll({
      race: human,
      appearance,
      equipment: emptyEquipment,
      catalogue,
      rasterAssets: new Set(['/assets/sprites/characters/human.png']),
    });
    expect(result.state.layers[0]?.key).toBe('body');
    expect(result.state.layers[0]?.rasterSrc).toBe('/assets/sprites/characters/human.png');
  });

  it('capa e acessório permanecem vectoriais na Fase 2', () => {
    const equipment: Record<EquipmentSlot, InventoryItem | null> = {
      ...emptyEquipment,
      cloak: instance('item.clk.traveler_cloak', 'cloak', 'uncommon'),
      accessory: instance('item.acc.lucky_charm', 'accessory', 'epic'),
    };
    const result = resolvePaperdoll({
      race: human,
      appearance,
      equipment,
      catalogue,
      rasterAssets: new Set([
        '/assets/sprites/armor/traveler_cloak.png',
        '/assets/sprites/armor/lucky_charm.png',
      ]),
    });
    expect(result.state.layers.find((layer) => layer.slot === 'cloak')?.rasterSrc).toBeNull();
    expect(result.state.layers.find((layer) => layer.slot === 'accessory')?.rasterSrc).toBeNull();
  });
});
