/**
 * Fase 2 — resolução híbrida raster (PNG) vs vector (SVG).
 *
 * O que estes testes protegem:
 *  · a convenção de pastas nunca muda sem se notar;
 *  · um manifesto vazio (hoje) devolve sempre fallback vectorial;
 *  · um PNG registado devolve o caminho certo, na ordem certa;
 *  · ids vindos de fora não conseguem escapar da pasta do slot.
 */
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SPRITE_ASSET_COUNT, SPRITE_ASSET_MANIFEST } from '@/data/sprite-asset-manifest';
import {
  SPRITE_ASSET_ROOT,
  hasRasterSprite,
  resolveRasterSprite,
  spriteAssetCandidates,
  spriteAssetPath,
  spriteRasterSlotFor,
} from './sprite-assets';

describe('spriteRasterSlotFor', () => {
  it('mapeia slots de equipamento para as pastas oficiais', () => {
    expect(spriteRasterSlotFor('weapon', 'weapon')).toBe('weapon');
    expect(spriteRasterSlotFor('weapon', 'offhand')).toBe('weapon');
    expect(spriteRasterSlotFor('armor', 'armor')).toBe('armor');
    expect(spriteRasterSlotFor('armor', 'boots')).toBe('armor');
    expect(spriteRasterSlotFor('helmet', 'helmet')).toBe('helmet');
  });

  it('o corpo usa characters/ quando não há slot', () => {
    expect(spriteRasterSlotFor('body', null)).toBe('character');
    expect(spriteRasterSlotFor('weapon', undefined)).toBe('weapon');
  });

  it('capa, acessório, aura e asas continuam vetoriais', () => {
    expect(spriteRasterSlotFor('body', 'cloak')).toBeNull();
    expect(spriteRasterSlotFor('vfx', 'accessory')).toBeNull();
    expect(spriteRasterSlotFor('aura', 'aura')).toBeNull();
    expect(spriteRasterSlotFor('wings', 'wings')).toBeNull();
  });
});

describe('convenção de caminhos', () => {
  it('o caminho canónico é /assets/sprites/[pasta]/[itemId].png', () => {
    expect(spriteAssetPath('weapon', 'item.wpn.iron_sword')).toBe(
      `${SPRITE_ASSET_ROOT}/weapons/item.wpn.iron_sword.png`,
    );
    expect(spriteAssetPath('armor', 'item.arm.plate_mail')).toBe(
      `${SPRITE_ASSET_ROOT}/armor/item.arm.plate_mail.png`,
    );
    expect(spriteAssetPath('helmet', 'item.hlm.iron_helm')).toBe(
      `${SPRITE_ASSET_ROOT}/helmets/item.hlm.iron_helm.png`,
    );
    expect(spriteAssetPath('character', 'race.human')).toBe(
      `${SPRITE_ASSET_ROOT}/characters/race.human.png`,
    );
  });

  it('aceita o id curto como segundo candidato', () => {
    expect(spriteAssetCandidates('weapon', 'item.wpn.iron_sword')).toEqual([
      '/assets/sprites/weapons/item.wpn.iron_sword.png',
      '/assets/sprites/weapons/iron_sword.png',
    ]);
  });

  it('cosméticos sem id usam o nome do asset declarado', () => {
    expect(
      spriteAssetCandidates('character', '', '/assets/paperdoll/races/human.png'),
    ).toEqual(['/assets/sprites/characters/human.png']);
  });

  it('ids hostis não escapam da pasta do slot', () => {
    const candidates = spriteAssetCandidates('weapon', '../../etc/passwd');
    expect(candidates.every((path) => path.startsWith('/assets/sprites/weapons/'))).toBe(true);
    expect(candidates.join()).not.toContain('..');
    expect(candidates.join()).not.toContain('/etc/');
  });
});

describe('resolveRasterSprite', () => {
  it('sem PNG no manifesto devolve fallback vectorial', () => {
    // Set vazio injectado: o manifesto real cresce à medida que os artistas
    // largam PNGs — o comportamento de fallback não pode depender disso.
    const resolution = resolveRasterSprite({
      slot: 'weapon',
      id: 'item.wpn.iron_sword',
      available: new Set(),
    });

    expect(resolution.kind).toBe('vector');
    expect(resolution.src).toBeNull();
    expect(resolution.expectedSrc).toBe('/assets/sprites/weapons/item.wpn.iron_sword.png');
  });

  it('com PNG no manifesto devolve o caminho do raster', () => {
    const available = new Set(['/assets/sprites/weapons/iron_sword.png']);
    const resolution = resolveRasterSprite({
      slot: 'weapon',
      id: 'item.wpn.iron_sword',
      available,
    });

    expect(resolution.kind).toBe('raster');
    expect(resolution.src).toBe('/assets/sprites/weapons/iron_sword.png');
    expect(resolution.expectedSrc).toBe('/assets/sprites/weapons/item.wpn.iron_sword.png');
  });

  it('o caminho completo tem prioridade sobre o id curto', () => {
    const available = new Set([
      '/assets/sprites/weapons/item.wpn.iron_sword.png',
      '/assets/sprites/weapons/iron_sword.png',
    ]);

    expect(resolveRasterSprite({ slot: 'weapon', id: 'item.wpn.iron_sword', available }).src).toBe(
      '/assets/sprites/weapons/item.wpn.iron_sword.png',
    );
  });

  it('hasRasterSprite é sensível ao manifesto', () => {
    const path = '/assets/sprites/armor/plate_mail.png';
    expect(hasRasterSprite(path)).toBe(false);
    expect(hasRasterSprite(path, new Set([path]))).toBe(true);
    expect(hasRasterSprite(null)).toBe(false);
  });
});

describe('manifesto gerado', () => {
  it('espelha exactamente os PNGs de public/assets/sprites', () => {
    const publicDir = join(process.cwd(), 'public');
    const spritesDir = join(publicDir, 'assets', 'sprites');

    const walk = (directory: string): string[] => {
      let entries;
      try {
        entries = readdirSync(directory, { withFileTypes: true });
      } catch {
        return [];
      }
      return entries.flatMap((entry) => {
        const absolute = join(directory, entry.name);
        return entry.isDirectory() ? walk(absolute) : [absolute];
      });
    };

    const onDisk = walk(spritesDir)
      .filter((file) => /\.(png|webp)$/i.test(file))
      .map((file) => `/${relative(publicDir, file).split(sep).join('/')}`)
      .sort();

    expect([...SPRITE_ASSET_MANIFEST].sort()).toEqual(onDisk);
    expect(SPRITE_ASSET_COUNT).toBe(SPRITE_ASSET_MANIFEST.size);
  });
});
