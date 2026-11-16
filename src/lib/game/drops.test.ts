import { describe, expect, it } from 'vitest';

import type { InventoryItem, Item, Rarity } from '@/types/game';
import { DROP_TABLES, FLOORS, MONSTERS, BOSSES } from '@/data/tower';
import { ITEM_BY_ID, ITEMS } from '@/data/items';
import { createRng } from './rng';
import {
  estimateOfflineDrops,
  raiseRarity,
  rarityWeightsForFloor,
  rollAffixes,
  rollDrops,
  rollRarity,
} from './drops';

const squadStats = { dropBonus: 10 };

describe('pesos de raridade por andar', () => {
  it('raridades altas ficam mais prováveis em andares altos', () => {
    const floor1 = rarityWeightsForFloor(1);
    const floor30 = rarityWeightsForFloor(30);
    expect(floor30.rare).toBeGreaterThan(floor1.rare);
    expect(floor30.epic).toBeGreaterThan(floor1.epic);
    expect(floor30.mythic).toBeGreaterThan(floor1.mythic);
  });

  it('Comum domina no início e perde peso no fim', () => {
    expect(rarityWeightsForFloor(1).common).toBeGreaterThan(rarityWeightsForFloor(30).common);
  });

  it('nunca devolve pesos negativos', () => {
    for (let floor = 1; floor <= 60; floor += 1) {
      const weights = rarityWeightsForFloor(floor);
      for (const value of Object.values(weights)) expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('sorteio respeita a ordem de raridade', () => {
    const rng = createRng(123);
    const counts: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
    for (let index = 0; index < 5000; index += 1) {
      counts[rollRarity(1, rng)] += 1;
    }
    expect(counts.common).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(counts.mythic);
  });

  it('é determinístico', () => {
    const a = rollRarity(15, createRng(7));
    const b = rollRarity(15, createRng(7));
    expect(a).toBe(b);
  });
});

describe('afixos', () => {
  const sword = ITEM_BY_ID.get('item.wpn.iron_sword');
  if (!sword) throw new Error('item ausente');

  it('comum não tem afixos', () => {
    expect(rollAffixes(sword, 'common', createRng(1)).length).toBe(0);
  });

  it('raridade define o número de afixos', () => {
    expect(rollAffixes(sword, 'uncommon', createRng(1)).length).toBe(1);
    expect(rollAffixes(sword, 'rare', createRng(1)).length).toBe(2);
    expect(rollAffixes(sword, 'mythic', createRng(1)).length).toBe(Math.min(5, sword.affixPool.length));
  });

  it('não repete o mesmo stat', () => {
    const affixes = rollAffixes(sword, 'legendary', createRng(9));
    const stats = affixes.map((affix) => affix.stat);
    expect(new Set(stats).size).toBe(stats.length);
  });

  it('valores são positivos e com tier', () => {
    for (const affix of rollAffixes(sword, 'epic', createRng(4))) {
      expect(affix.value).toBeGreaterThan(0);
      expect(affix.tier).toBeGreaterThanOrEqual(1);
      expect(affix.tier).toBeLessThanOrEqual(5);
    }
  });
});

describe('rollDrops', () => {
  it('chefe garante item no first-clear', () => {
    const result = rollDrops(
      {
        tableId: 'drops.rock_rex',
        floor: 10,
        isBoss: true,
        firstClear: true,
        squadStats,
        ownerId: 'p1',
        nowIso: '2026-01-01T00:00:00.000Z',
      },
      createRng(1),
    );
    expect(result.firstClearDrop).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    const replay = rollDrops(
      {
        tableId: 'drops.rock_rex',
        floor: 10,
        isBoss: true,
        firstClear: true,
        squadStats,
        ownerId: 'p1',
        nowIso: '2026-01-01T00:00:00.000Z',
      },
      createRng(1),
    );
    expect(replay.items[0]?.id).toBe(result.items[0]?.id);
  });

  it('chefe dropa gold sempre', () => {
    const result = rollDrops(
      {
        tableId: 'drops.rock_rex',
        floor: 10,
        isBoss: true,
        firstClear: false,
        squadStats,
        ownerId: 'p1',
        nowIso: '2026-01-01T00:00:00.000Z',
      },
      createRng(2),
    );
    expect(result.gold).toBeGreaterThan(0);
  });

  it('tabela inexistente devolve vazio sem lançar', () => {
    const result = rollDrops(
      { tableId: 'drops.naoexiste', floor: 1, isBoss: false, firstClear: false, squadStats, ownerId: 'p1', nowIso: '2026-01-01T00:00:00.000Z' },
      createRng(1),
    );
    expect(result.items).toEqual([]);
    expect(result.gold).toBe(0);
  });

  it('dropBonus aumenta a taxa de drop', () => {
    const count = (bonus: number): number => {
      const rng = createRng(42);
      let total = 0;
      for (let index = 0; index < 500; index += 1) {
        const result = rollDrops(
          {
            tableId: 'drops.slime',
            floor: 1,
            isBoss: false,
            firstClear: false,
            squadStats: { dropBonus: bonus },
            ownerId: 'p1',
            nowIso: '2026-01-01T00:00:00.000Z',
          },
          rng,
        );
        total += result.items.length;
      }
      return total;
    };
    expect(count(60)).toBeGreaterThan(count(0));
  });

  it('instância criada tem UUID, raridade e sockets', () => {
    const result = rollDrops(
      {
        tableId: 'drops.rock_rex',
        floor: 10,
        isBoss: true,
        firstClear: true,
        squadStats,
        ownerId: 'p1',
        nowIso: '2026-01-01T00:00:00.000Z',
      },
      createRng(3),
    );
    const item = result.items[0] as InventoryItem | undefined;
    expect(item?.id.length).toBeGreaterThan(0);
    expect(item?.droppedAtFloor).toBe(10);
    expect(item?.refineLevel).toBe(0);
    expect(Array.isArray(item?.sockets)).toBe(true);
  });

  it('chefes dropam raridade mais alta', () => {
    const rng = createRng(11);
    let bossHigh = 0;
    for (let index = 0; index < 200; index += 1) {
      const result = rollDrops(
        { tableId: 'drops.rock_rex', floor: 10, isBoss: true, firstClear: false, squadStats, ownerId: 'p1', nowIso: '2026-01-01T00:00:00.000Z' },
        rng,
      );
      const rarity = result.items[0]?.rarity;
      if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') bossHigh += 1;
    }
    expect(bossHigh).toBeGreaterThan(0);
  });
});

describe('raiseRarity', () => {
  it('sobe sem passar do topo', () => {
    expect(raiseRarity('common', 1)).toBe('uncommon');
    expect(raiseRarity('mythic', 1)).toBe('mythic');
    expect(raiseRarity('rare', 3)).toBe('mythic');
  });
});

describe('progresso offline', () => {
  it('não passa do cap de 8 horas', () => {
    const result = estimateOfflineDrops(
      {
        seconds: 3600 * 48,
        floor: 3,
        tableIds: ['drops.slime'],
        squadStats,
        ownerId: 'p1',
        nowIso: '2026-01-01T00:00:00.000Z',
      },
      createRng(1),
    );
    expect(result.gold).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThanOrEqual(10);
  });

  it('limita a 10 itens para não inundar o inventário', () => {
    const result = estimateOfflineDrops(
      { seconds: 3600 * 8, floor: 1, tableIds: ['drops.slime'], squadStats: { dropBonus: 75 }, ownerId: 'p1', nowIso: '2026-01-01T00:00:00.000Z' },
      createRng(5),
    );
    expect(result.items.length).toBeLessThanOrEqual(10);
  });

  it('tempo zero devolve vazio', () => {
    const result = estimateOfflineDrops(
      { seconds: 0, floor: 1, tableIds: ['drops.slime'], squadStats, ownerId: 'p1', nowIso: '2026-01-01T00:00:00.000Z' },
      createRng(1),
    );
    expect(result.gold).toBe(0);
    expect(result.items).toEqual([]);
  });
});

describe('integridade dos catálogos de drop', () => {
  it('todos os itens de todas as tabelas existem', () => {
    for (const table of DROP_TABLES) {
      for (const entry of table.entries) {
        expect(ITEM_BY_ID.has(entry.itemId)).toBe(true);
      }
    }
  });

  it('todas as tabelas referenciadas por monstros existem', () => {
    const tableIds = new Set(DROP_TABLES.map((table) => table.id));
    for (const monster of [...MONSTERS, ...BOSSES]) {
      expect(tableIds.has(monster.dropTableId)).toBe(true);
    }
  });

  it('cada bioma tem 4 mobs na pool', () => {
    for (const floor of FLOORS) {
      expect(floor.mobPool.length).toBe(4);
    }
  });

  it('existem 24 mobs e 6 chefes', () => {
    expect(MONSTERS.length).toBe(24);
    expect(BOSSES.length).toBe(6);
  });

  it('todos os itens têm valor de venda a NPC', () => {
    for (const item of ITEMS as readonly Item[]) {
      expect(item.npcSellValue).toBeGreaterThan(0);
    }
  });
});
