/**
 * Fase 2 — o avatar desenha PNG raster como `<image>` no artRect oficial.
 *
 * Renderização via SSR (`renderToStaticMarkup`) para validar o markup real do
 * componente sem precisar de DOM/jsdom: é o mesmo HTML que o browser recebe.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ITEM_BY_ID } from '@/data/items';
import { RACE_BY_ID } from '@/data/races';
import { resolvePaperdoll } from '@/lib/game/paperdoll';
import type { Appearance, EquipmentSlot, InventoryItem } from '@/types/game';

import { PaperdollAvatar } from './PaperdollAvatar';

const human = RACE_BY_ID.get('race.human');

const appearance: Appearance = {
  raceId: 'race.human',
  bodyVariant: 0,
  skinTone: '#e8c39e',
  hairStyle: 'short',
  hairColor: '#4a3728',
  cosmetic: {
    aura: null,
    wings: null,
    body: null,
    armor: null,
    helmet: null,
    weapon: null,
    vfx: null,
  },
  auraColor: null,
};

function emptyEquipment(): Record<EquipmentSlot, InventoryItem | null> {
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

function legendarySword(): InventoryItem {
  return {
    id: 'inst-dragon-spear',
    itemId: 'item.wpn.dragon_spear',
    ownerId: 'player-1',
    rarity: 'legendary',
    refineLevel: 0,
    affixes: [],
    sockets: [],
    equippedSlot: 'weapon',
    equippedBy: 'char-1',
    bound: false,
    locked: false,
    obtainedAt: '2026-01-01T00:00:00.000Z',
    droppedAtFloor: 30,
  };
}

function render(rasterAssets: ReadonlySet<string>): string {
  if (!human) throw new Error('raça human ausente');

  const equipment = { ...emptyEquipment(), weapon: legendarySword() };
  const { state } = resolvePaperdoll({
    race: human,
    appearance,
    equipment,
    catalogue: ITEM_BY_ID,
    rasterAssets,
  });

  return renderToStaticMarkup(createElement(PaperdollAvatar, { state, size: 'md' }));
}

describe('PaperdollAvatar — raster híbrido', () => {
  it('desenha <image> dentro do artRect 144×144 da arma', () => {
    const html = render(new Set(['/assets/sprites/weapons/dragon_spear.png']));

    expect(html).toContain('data-layer-kind="raster"');
    expect(html).toContain('href="/assets/sprites/weapons/dragon_spear.png"');
    expect(html).toContain('x="112" y="40" width="144" height="144"');
  });

  it('aplica o filtro de glow de raridade ao raster', () => {
    const html = render(new Set(['/assets/sprites/weapons/dragon_spear.png']));

    expect(html).toContain('<filter');
    expect(html).toContain('flood-color="rgb(251 191 36 / 0.6)"');
  });

  it('sem PNG registado não há <image>: fica o template vectorial', () => {
    // Fase 3: com rasterAssets vazio o corpo NÃO resolve PNG — mas o src
    // declarado (`/assets/sprites/characters/human.png`) continua a ser o da
    // convenção oficial (sheet branch + probe). O que interessa provar em SSR
    // é que nenhuma camada RasterLayer (`<image>`) é renderizada; o React 19
    // acrescenta <link rel="preload"> por si só, por isso negamos o caminho
    // do <image>, não o da string inteira.
    const html = render(new Set());

    expect(html).not.toContain('data-layer-kind="raster"');
    expect(html).not.toContain('<image href="/assets/sprites/');
  });
});
