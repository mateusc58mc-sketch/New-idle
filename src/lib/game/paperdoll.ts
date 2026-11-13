/**
 * Resolvedor de Paperdoll — lógica pura, sem React.
 *
 * Transforma o estado do jogador (`Appearance` + equipamento) numa lista
 * ORDENADA de camadas prontas a desenhar. O componente só faz `map()`.
 *
 * Porquê separar:
 *  · testável sem DOM (vitest);
 *  · o inventário, o mercado e o squad usam a MESMA resolução — é o
 *    critério de pronto da wiki ("o mesmo asset no squad e no mercado");
 *  · âncoras e ordem ficam num só lugar (`data/paperdoll-layers.ts`).
 */
import type { CSSProperties } from 'react';
import type {
  Appearance,
  EquipmentSlot,
  InventoryItem,
  Item,
  PaperdollAnimation,
  PaperdollLayerKey,
  PaperdollState,
  Race,
  Rarity,
  ResolvedLayer,
  ResolvedPaperdollSlot,
} from '@/types/game';
import { PAPERDOLL_LAYER_ORDER } from '@/types/game';
import { RARITY_GLOW, SLOT_BINDING_MAP, SLOT_LAYER_BINDINGS, artRectFor } from '@/data/paperdoll-layers';
import { SPRITE_ASSET_MANIFEST } from '@/data/sprite-asset-manifest';
import { resolveRasterSprite, spriteRasterSlotFor } from './sprite-assets';

export interface ResolvePaperdollInput {
  readonly race: Race;
  readonly appearance: Appearance;
  /** Equipamento por slot — `null` = vazio. */
  readonly equipment: Readonly<Record<EquipmentSlot, InventoryItem | null>>;
  /** Catálogo para resolver `itemId` → definição. */
  readonly catalogue: ReadonlyMap<string, Item>;
  readonly animation?: PaperdollAnimation;
  /** Raridade máxima equipada — define o glow do conjunto. */
  readonly glowRarity?: Rarity | null;
  /**
   * Manifesto de PNGs raster disponíveis. Por omissão usa o gerado em
   * `src/data/sprite-asset-manifest.ts`; testes/previews podem injectar.
   */
  readonly rasterAssets?: ReadonlySet<string>;
}

export interface ResolvePaperdollResult {
  readonly state: PaperdollState;
  /** Slots resolvidos, com a raridade — usado pelo inventário/preview. */
  readonly slots: readonly ResolvedPaperdollSlot[];
}

/**
 * Resolve todas as camadas. Nunca lança: itens desconhecidos ou cosméticos
 * inválidos são simplesmente ignorados (o avatar aparece sem essa peça).
 */
export function resolvePaperdoll(input: ResolvePaperdollInput): ResolvePaperdollResult {
  const { race, appearance, equipment, catalogue } = input;
  const rasterAssets = input.rasterAssets ?? SPRITE_ASSET_MANIFEST;

  const layers: ResolvedLayer[] = [];
  const slots: ResolvedPaperdollSlot[] = [];

  /**
   * PNG hand-painted da peça, se existir em `/public/assets/sprites/**`.
   * `null` significa "desenha o template vetorial" — nunca falha.
   */
  const rasterFor = (
    layerKey: PaperdollLayerKey,
    slot: EquipmentSlot | null,
    itemId: string,
    declaredSrc?: string | null,
  ): string | null => {
    const rasterSlot = spriteRasterSlotFor(layerKey, slot);
    if (!rasterSlot) return null;
    return resolveRasterSprite({ slot: rasterSlot, id: itemId, declaredSrc, available: rasterAssets }).src;
  };

  // 1. Corpo da raça — sempre presente, é a base de tudo.
  const bodyAnchor = race.paperdoll.anchors.body;
  if (bodyAnchor) {
    layers.push({
      key: 'body',
      asset: race.paperdoll.bodyLayer,
      anchor: bodyAnchor,
      opacity: 1,
      tint: appearance.skinTone || race.palette.skin,
      rarity: null,
      order: PAPERDOLL_LAYER_ORDER.indexOf('body'),
      zOffset: 0,
      slot: null,
      rasterSrc: rasterFor('body', null, race.id, race.paperdoll.bodyLayer.src),
    });
  }

  // 2. Equipamento — pela ordem rígida de `SLOT_LAYER_BINDINGS`.
  for (const binding of SLOT_LAYER_BINDINGS) {
    const instance = equipment[binding.slot];
    if (!instance) continue;

    const definition = catalogue.get(instance.itemId);
    if (!definition || !definition.paperdoll) continue;

    const anchor = definition.paperdoll.anchorOverride ?? race.paperdoll.anchors[binding.layer];
    if (!anchor) continue;

    const layerIndex = PAPERDOLL_LAYER_ORDER.indexOf(binding.layer);
    const tint = definition.paperdoll.glow;

    layers.push({
      key: binding.layer,
      asset: definition.paperdoll.asset,
      anchor,
      opacity: 1,
      tint: null,
      rarity: instance.rarity,
      order: layerIndex,
      zOffset: binding.zOffset,
      slot: binding.slot,
      rasterSrc: rasterFor(
        binding.layer,
        binding.slot,
        instance.itemId,
        definition.paperdoll.asset.src,
      ),
    });

    slots.push({
      slot: binding.slot,
      itemId: instance.itemId,
      name: definition.name,
      rarity: instance.rarity,
      layer: binding.layer,
      glow: definition.paperdoll.glow ?? RARITY_GLOW[instance.rarity] ?? null,
      tint,
      refineLevel: instance.refineLevel,
    });
  }

  // 3. Cosméticos — sobrepõem o equipamento na mesma camada (é o ponto do
  //    sistema: um cosmético de mercado pode substituir a armadura).
  for (const [layerKey, cosmetic] of Object.entries(appearance.cosmetic)) {
    if (!cosmetic) continue;
    const key = layerKey as PaperdollLayerKey;
    const anchor = race.paperdoll.anchors[key];
    if (!anchor) continue;

    // Remove a camada de equipamento equivalente, se existir.
    const filtered = layers.filter((layer) => layer.key !== key || layer.slot === null);
    layers.length = 0;
    layers.push(...filtered);

    layers.push({
      key,
      asset: cosmetic.asset,
      anchor,
      opacity: 1,
      tint: null,
      rarity: null,
      order: PAPERDOLL_LAYER_ORDER.indexOf(key),
      zOffset: -100, // cosméticos ficam por cima da peça equivalente
      slot: null,
      rasterSrc: rasterFor(key, null, '', cosmetic.asset.src),
    });
  }

  // 4. Ordenação final: camada base → zOffset.
  const ordered = [...layers].sort((a, b) => (a.order === b.order ? a.zOffset - b.zOffset : a.order - b.order));

  const glowRarity = input.glowRarity ?? highestRarity(slots.map((slot) => slot.rarity));

  return {
    state: {
      raceId: race.id,
      canvas: race.paperdoll.canvas,
      layers: ordered,
      animation: input.animation ?? 'idle',
      glow: glowRarity ? (RARITY_GLOW[glowRarity] ?? null) : null,
    },
    slots,
  };
}

const RARITY_RANK: Readonly<Record<Rarity, number>> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
} as const;

/** Raridade mais alta de uma lista (define o glow do conjunto). */
export function highestRarity(rarities: readonly Rarity[]): Rarity | null {
  let best: Rarity | null = null;
  for (const rarity of rarities) {
    if (best === null || RARITY_RANK[rarity] > RARITY_RANK[best]) best = rarity;
  }
  return best;
}

/**
 * Gera o estilo CSS de uma camada.
 *
 * Geometria: o canvas lógico é 256×256 e cada peça tem um rect oficial
 * (`PAPERDOLL_ART_RECTS`). A camada é posicionada nesse rect, em percentagem
 * do canvas — logo o mesmo estilo serve 56 px (Arena) e 256 px (catálogo).
 * `anchor.x/y` são offsets de calibração e `anchor.scale` multiplica o rect.
 */
export function layerStyle(layer: ResolvedLayer, canvasWidth: number, canvasHeight: number): CSSProperties {
  const scale = layer.anchor.scale;
  const rect = artRectFor(layer.key, layer.slot);
  const width = (rect.size * scale * 100) / canvasWidth;
  return {
    position: 'absolute',
    left: `${((rect.x + layer.anchor.x) / canvasWidth) * 100}%`,
    top: `${((rect.y + layer.anchor.y) / canvasHeight) * 100}%`,
    width: `${width}%`,
    height: 'auto',
    opacity: layer.opacity,
    transform: layer.anchor.flipX ? 'scaleX(-1)' : undefined,
    transformOrigin: 'top left',
    imageRendering: 'pixelated',
    pointerEvents: 'none',
    filter: layer.tint ? `drop-shadow(0 0 6px ${layer.tint})` : undefined,
  };
}

/** Slot do equipamento que uma camada representa (para highlight no inventário). */
export function slotOfLayer(layer: PaperdollLayerKey): EquipmentSlot | null {
  const binding = SLOT_LAYER_BINDINGS.find((entry) => entry.layer === layer);
  return binding ? binding.slot : null;
}

/** Âncora efectiva de um slot, considerando override do item. */
export function anchorForSlot(race: Race, slot: EquipmentSlot, item: Item | null) {
  const binding = SLOT_BINDING_MAP[slot];
  const override = item?.paperdoll?.anchorOverride ?? null;
  return override ?? race.paperdoll.anchors[binding.layer] ?? null;
}
