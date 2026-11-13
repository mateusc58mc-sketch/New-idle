/**
 * Ponte entre o Paperdoll modular e os PNGs hand-painted (Chibi 2D).
 *
 * Regra de ouro: o jogo NUNCA depende de um PNG existir. O manifesto gerado
 * (`src/data/sprite-asset-manifest.ts`) diz, em tempo de resolução, que artes
 * raster estão disponíveis; tudo o resto cai no template vetorial de
 * `src/lib/sprite-lab/svg-templates.ts`. Nenhum ecrã fica com buracos.
 *
 * Convenção oficial de nomes (a pasta muda, o resto é estável):
 *   /assets/sprites/weapons/[itemId].png
 *   /assets/sprites/armor/[itemId].png
 *   /assets/sprites/helmets/[itemId].png
 *   /assets/sprites/characters/[raceId].png
 *
 * Aceita-se também o id curto — último segmento de `item.wpn.iron_sword` →
 * `iron_sword` — para o artista não ter de repetir o prefixo do catálogo.
 * A ordem dos candidatos é determinística: o primeiro que existir no manifesto
 * ganha; a resolução devolve sempre o caminho canónico em `expectedSrc`.
 */
import { SPRITE_ASSET_MANIFEST } from '@/data/sprite-asset-manifest';
import type { EquipmentSlot, PaperdollLayerKey } from '@/types/game';

/** Pastas oficiais em `public/assets/sprites/**`. */
export type SpriteRasterSlot = 'weapon' | 'armor' | 'helmet' | 'character';

/** Raiz pública das artes raster do Paperdoll. */
export const SPRITE_ASSET_ROOT = '/assets/sprites';

/** Nome da pasta por tipo de peça (plural nas armas, singular no resto). */
export const SPRITE_SLOT_DIRECTORIES: Readonly<Record<SpriteRasterSlot, string>> = {
  weapon: 'weapons',
  armor: 'armor',
  helmet: 'helmets',
  character: 'characters',
} as const;

/**
 * Slot equipado → tipo de raster. Slots ausentes (`cloak`, `accessory`, `aura`,
 * `wings`) continuam 100% vetoriais: não têm pasta oficial na Fase 2.
 */
const SLOT_RASTER_KIND: Readonly<Partial<Record<EquipmentSlot, SpriteRasterSlot>>> = {
  weapon: 'weapon',
  offhand: 'weapon',
  armor: 'armor',
  boots: 'armor',
  helmet: 'helmet',
} as const;

/** Camada → tipo de raster (usado quando a camada não tem slot, ex.: corpo). */
const LAYER_RASTER_KIND: Readonly<Partial<Record<PaperdollLayerKey, SpriteRasterSlot>>> = {
  weapon: 'weapon',
  armor: 'armor',
  helmet: 'helmet',
  body: 'character',
} as const;

/**
 * Tipo de raster para uma camada/slot. `null` = só vector.
 *
 * O slot manda: uma capa desenha-se na camada `body`, mas NÃO é um corpo —
 * por isso devolve `null` em vez de cair na pasta `characters`.
 */
export function spriteRasterSlotFor(
  layerKey: PaperdollLayerKey,
  slot?: EquipmentSlot | null,
): SpriteRasterSlot | null {
  if (slot) return SLOT_RASTER_KIND[slot] ?? null;
  return LAYER_RASTER_KIND[layerKey] ?? null;
}

/** Limpa um segmento de caminho: sem barras, sem `..`, sem espaços. */
function sanitizeSegment(value: string): string {
  const lastSegment = value.replace(/\\/g, '/').split('/').pop() ?? '';
  return lastSegment
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/^[.]+/, '')
    .replace(/\.+$/, '');
}

/** `'/assets/paperdoll/weapon/sword.png'` → `'sword'`. */
function assetBasename(src: string | null | undefined): string {
  if (!src) return '';
  const file = src.replace(/\\/g, '/').split('/').pop() ?? '';
  return file.replace(/\.[a-z0-9]+$/i, '');
}

/**
 * Candidatos de PNG para uma peça, por ordem de prioridade.
 *
 * `id` vazio (cosméticos sem itemId) usa o nome do asset declarado, para que um
 * PNG largado em `characters/` continue a ser encontrado.
 */
export function spriteAssetCandidates(
  slot: SpriteRasterSlot,
  id: string,
  declaredSrc?: string | null,
): readonly string[] {
  const directory = SPRITE_SLOT_DIRECTORIES[slot];
  const names: string[] = [];

  const full = sanitizeSegment(id);
  if (full) names.push(full);

  const short = sanitizeSegment(id.split('.').pop() ?? '');
  if (short) names.push(short);

  if (!full) {
    const declared = sanitizeSegment(assetBasename(declaredSrc));
    if (declared) names.push(declared);
  }

  const unique = [...new Set(names)].filter(Boolean);
  return unique.map((name) => `${SPRITE_ASSET_ROOT}/${directory}/${name}.png`);
}

/** Caminho canónico (contrato) de uma peça, exista o PNG ou não. */
export function spriteAssetPath(
  slot: SpriteRasterSlot,
  id: string,
  declaredSrc?: string | null,
): string {
  return spriteAssetCandidates(slot, id, declaredSrc)[0] ?? `${SPRITE_ASSET_ROOT}/${SPRITE_SLOT_DIRECTORIES[slot]}/`;
}

/** O manifesto contém o caminho? (sempre POSIX, nunca URL absoluta externa) */
export function hasRasterSprite(
  path: string | null | undefined,
  available: ReadonlySet<string> = SPRITE_ASSET_MANIFEST,
): boolean {
  return typeof path === 'string' && path.length > 0 && available.has(path);
}

export interface ResolveRasterSpriteInput {
  readonly slot: SpriteRasterSlot;
  /** `itemId` (equipamento) ou `raceId` (corpo). Vazio em cosméticos. */
  readonly id: string;
  /** Asset declarado no catálogo — última pista quando não há `id`. */
  readonly declaredSrc?: string | null | undefined;
  /** Manifesto alternativo (testes / previews). */
  readonly available?: ReadonlySet<string>;
}

export interface RasterSpriteResolution {
  readonly kind: 'raster' | 'vector';
  /** PNG a desenhar; `null` quando só há vector. */
  readonly src: string | null;
  /** Caminho previsto pela convenção, mesmo que o PNG ainda não exista. */
  readonly expectedSrc: string;
  /** Todos os caminhos tentados, por ordem. */
  readonly candidates: readonly string[];
}

/**
 * Decide entre PNG raster e template vetorial. Pura e sem I/O: o manifesto já
 * espelha o disco (gerado por `scripts/generate-sprite-manifest.mjs`).
 */
export function resolveRasterSprite(input: ResolveRasterSpriteInput): RasterSpriteResolution {
  const available = input.available ?? SPRITE_ASSET_MANIFEST;
  const candidates = spriteAssetCandidates(input.slot, input.id, input.declaredSrc);
  const expectedSrc =
    candidates[0] ?? `${SPRITE_ASSET_ROOT}/${SPRITE_SLOT_DIRECTORIES[input.slot]}/`;

  const match = candidates.find((candidate) => available.has(candidate)) ?? null;

  return {
    kind: match ? 'raster' : 'vector',
    src: match,
    expectedSrc,
    candidates,
  };
}
