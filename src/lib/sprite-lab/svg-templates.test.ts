/**
 * Design System — canvas 256×256, rects oficiais e selecção de templates.
 *
 * Garante que o fallback paramétrico nunca volta a ser um sword genérico
 * para todos os slots e que cada instância tem um filtro de glow único.
 */
import { describe, expect, it } from 'vitest';

import {
  PAPERDOLL_ART_RECTS,
  PAPERDOLL_CANVAS,
  PAPERDOLL_SCALE_FACTOR,
  PAPERDOLL_TILE_SIZE,
  artRectFor,
} from '@/data/paperdoll-layers';
import { PAPERDOLL_LAYER_ORDER, type EquipmentSlot, type PaperdollLayerKey } from '@/types/game';
import {
  SPRITE_CANVAS_STANDARD,
  TEMPLATE_BY_ID,
  getParametricSvgForLayer,
  selectParametricTemplateId,
} from './svg-templates';

describe('design system 256×256', () => {
  it('oficializa canvas 256, tile 64 e factor 4×', () => {
    expect(PAPERDOLL_CANVAS).toEqual({ width: 256, height: 256, displayScale: 1 });
    expect(PAPERDOLL_TILE_SIZE).toBe(64);
    expect(PAPERDOLL_SCALE_FACTOR).toBe(4);
  });

  it('o Sprite Lab consome as constantes oficiais em vez de as duplicar', () => {
    expect(SPRITE_CANVAS_STANDARD.width).toBe(PAPERDOLL_CANVAS.width);
    expect(SPRITE_CANVAS_STANDARD.height).toBe(PAPERDOLL_CANVAS.height);
    expect(SPRITE_CANVAS_STANDARD.nominalTileSize).toBe(PAPERDOLL_TILE_SIZE);
    expect(SPRITE_CANVAS_STANDARD.scaleFactor).toBe(PAPERDOLL_SCALE_FACTOR);
  });

  it('todos os rects cabem no canvas', () => {
    for (const rect of Object.values(PAPERDOLL_ART_RECTS)) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.size).toBeLessThanOrEqual(PAPERDOLL_CANVAS.width);
      expect(rect.y + rect.size).toBeLessThanOrEqual(PAPERDOLL_CANVAS.height);
    }
  });

  it('o slot tem prioridade sobre a camada partilhada', () => {
    expect(artRectFor('weapon', 'offhand')).toEqual(PAPERDOLL_ART_RECTS.offhand);
    expect(artRectFor('weapon', 'weapon')).toEqual(PAPERDOLL_ART_RECTS.weapon);
    expect(artRectFor('armor', 'cloak')).toEqual(PAPERDOLL_ART_RECTS.cloak);
    expect(artRectFor('armor', null)).toEqual(PAPERDOLL_ART_RECTS.armor);
  });
});

describe('selecção de template por asset', () => {
  const cases: readonly [string, PaperdollLayerKey, EquipmentSlot | null, string][] = [
    ['/assets/paperdoll/weapon/hunter_bow.png', 'weapon', 'weapon', 'bow'],
    ['/assets/paperdoll/weapon/dragon_spear.png', 'weapon', 'weapon', 'spear'],
    ['/assets/paperdoll/weapon/arcane_staff.png', 'weapon', 'weapon', 'staff'],
    ['/assets/paperdoll/weapon/shadow_dagger.png', 'weapon', 'weapon', 'dagger'],
    ['/assets/paperdoll/armor/arcane_robe.png', 'armor', 'armor', 'mage-robe'],
    ['/assets/paperdoll/armor/plate_mail.png', 'armor', 'armor', 'plate-armor'],
    ['/assets/paperdoll/helmet/hood.png', 'helmet', 'helmet', 'rogue-hood'],
    ['/assets/paperdoll/helmet/helm.png', 'helmet', 'helmet', 'knight-helm'],
    ['/assets/paperdoll/weapon/tower_shield.png', 'weapon', 'offhand', 'tower-shield'],
    ['/assets/paperdoll/aura/charm.png', 'vfx', 'accessory', 'amulet'],
    ['/assets/paperdoll/races/human.png', 'body', null, 'hero-body'],
  ];

  it.each(cases)('%s → %s', (src, layer, slot, expected) => {
    expect(selectParametricTemplateId(layer, slot, src)).toBe(expected);
    expect(TEMPLATE_BY_ID.has(expected)).toBe(true);
  });

  it('todas as camadas produzem um template existente', () => {
    for (const key of PAPERDOLL_LAYER_ORDER) {
      expect(TEMPLATE_BY_ID.has(selectParametricTemplateId(key, null, null))).toBe(true);
    }
  });
});

describe('getParametricSvgForLayer', () => {
  it('posiciona a arte no rect oficial do canvas', () => {
    const svg = getParametricSvgForLayer('weapon', 'weapon', {
      assetSrc: '/assets/paperdoll/weapon/iron_sword.png',
      instanceId: 'hero-1',
    });
    expect(svg).toBeTruthy();
    expect(svg).toContain('viewBox="112 40 144 144"');
    expect(svg).toContain('viewBox="0 0 64 64"');
  });

  it('aplica o glow de raridade com um filtro único por instância', () => {
    const a = getParametricSvgForLayer('helmet', 'helmet', {
      assetSrc: '/assets/paperdoll/helmet/helm.png',
      rarityGlow: 'rgb(251 191 36)',
      instanceId: 'hero-1',
    });
    const b = getParametricSvgForLayer('helmet', 'helmet', {
      assetSrc: '/assets/paperdoll/helmet/helm.png',
      rarityGlow: 'rgb(251 191 36)',
      instanceId: 'hero-2',
    });
    expect(a).toContain('id="tplGlow-hero-1"');
    expect(b).toContain('id="tplGlow-hero-2"');
    expect(a).not.toContain('id="tplGlow-hero-2"');
  });

  it('sem raridade não injecta filtro', () => {
    const svg = getParametricSvgForLayer('body', null, { assetSrc: '/assets/paperdoll/races/elf.png' });
    expect(svg).not.toContain('<filter');
  });

  it('nunca devolve null para uma camada conhecida', () => {
    for (const key of PAPERDOLL_LAYER_ORDER) {
      expect(getParametricSvgForLayer(key, null)).toBeTruthy();
    }
  });
});
