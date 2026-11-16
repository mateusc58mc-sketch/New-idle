/**
 * Mapa de camadas do Paperdoll.
 *
 * Duas dimensões independentes:
 *   · `PaperdollLayerKey`  → ONDE a arte é desenhada (7 camadas fixas, ordem
 *     rígida em `PAPERDOLL_LAYER_ORDER`). É o que o componente renderiza.
 *   · `EquipmentSlot`      → O QUE o jogador equipa (9 slots). É o que o
 *     inventário e o mercado vendem.
 *
 * O mapeamento entre os dois vive AQUI, num só sítio. É o que permite ter 9
 * slots visíveis (requisito aprovado) sem inventar 9 camadas: `boots` e
 * `cloak` desenham-se nas camadas `body`/`armor`, com `zOffset` para ficarem
 * atrás da armadura.
 */
import type { EquipmentSlot, PaperdollAnchor, PaperdollLayerKey, Rarity } from '@/types/game';

/* ────────────────────────────────────────────────────────────────────────────
 * DESIGN SYSTEM OFICIAL — canvas 256×256, tile nominal 64×64 (factor 4×)
 *
 * Toda a arte do Paperdoll (PNG ou SVG paramétrico) é desenhada num tile
 * nominal de 64×64 e colocada num `PAPERDOLL_ART_RECTS` do canvas 256×256.
 * Isto é o ÚNICO ponto de calibração: mudar um rect move a peça em TODAS as
 * raças e em TODOS os ecrãs (Arena, inventário, mercado, Sprite Lab).
 *
 * Regra para artistas: exportar PNG 64×64 transparente com a peça alinhada
 * ao centro do tile. O motor trata da escala 4× e da posição.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Caixa lógica comum a todas as raças (arte base 256×256). */
export const PAPERDOLL_CANVAS = { width: 256, height: 256, displayScale: 1 } as const;

/** Lado do tile nominal de arte, em px (antes da escala oficial). */
export const PAPERDOLL_TILE_SIZE = 64;

/** Factor de ampliação do tile nominal para o canvas oficial (256 / 64). */
export const PAPERDOLL_SCALE_FACTOR = PAPERDOLL_CANVAS.width / PAPERDOLL_TILE_SIZE;

/** Região quadrada do canvas onde a arte de um slot é desenhada. */
export interface PaperdollArtRect {
  /** Canto superior-esquerdo no canvas 256×256, em px. */
  readonly x: number;
  readonly y: number;
  /** Lado do rect em px do canvas (a arte 64×64 é escalada para este lado). */
  readonly size: number;
}

/**
 * Chave de arte: o slot tem prioridade sobre a camada, porque dois slots
 * partilham a mesma camada (`weapon`/`offhand` e `cloak`/`body`,
 * `boots`/`armor`).
 */
export type PaperdollArtKey = PaperdollLayerKey | EquipmentSlot;

/**
 * Posição oficial de cada peça na silhueta do herói (canvas 256×256).
 * Cabeça ~ y 40..90 · tronco ~ y 96..174 · pés ~ y 178..232.
 */
export const PAPERDOLL_ART_RECTS: Readonly<Record<PaperdollArtKey, PaperdollArtRect>> = {
  // Camadas de fundo
  aura: { x: 0, y: 0, size: 256 },
  wings: { x: 16, y: 24, size: 224 },
  cloak: { x: 24, y: 24, size: 208 },
  // Silhueta
  body: { x: 32, y: 24, size: 192 },
  armor: { x: 72, y: 80, size: 112 },
  helmet: { x: 80, y: 28, size: 96 },
  boots: { x: 80, y: 154, size: 96 },
  // Mãos
  weapon: { x: 112, y: 40, size: 144 },
  offhand: { x: 12, y: 96, size: 104 },
  accessory: { x: 92, y: 100, size: 72 },
  // Efeitos
  vfx: { x: 0, y: 0, size: 256 },
} as const;

/** Índice de arte efectivo de uma camada (slot > camada). */
export function artKeyFor(
  layerKey: PaperdollLayerKey,
  slot: EquipmentSlot | null | undefined,
): PaperdollArtKey {
  return slot ?? layerKey;
}

/** Região oficial de desenho de uma camada/slot. */
export function artRectFor(
  layerKey: PaperdollLayerKey,
  slot: EquipmentSlot | null | undefined,
): PaperdollArtRect {
  return PAPERDOLL_ART_RECTS[artKeyFor(layerKey, slot)] ?? PAPERDOLL_ART_RECTS[layerKey];
}

/**
 * Âncoras oficiais por camada. São OFFSETS de calibração sobre o rect
 * (`x`/`y` em px do canvas, `scale` multiplica o rect). O rect já posiciona a
 * peça; manter tudo a zero significa "usa o layout oficial".
 *
 * Partilhadas por TODAS as raças — é o que garante reutilização de armaduras.
 */
export const PAPERDOLL_ANCHORS: Readonly<Record<PaperdollLayerKey, PaperdollAnchor>> = {
  aura: { x: 0, y: 0, scale: 1, zOffset: 0, flipX: false },
  wings: { x: 0, y: 0, scale: 1, zOffset: 0, flipX: false },
  body: { x: 0, y: 0, scale: 1, zOffset: 0, flipX: false },
  armor: { x: 0, y: 0, scale: 1, zOffset: 0, flipX: false },
  helmet: { x: 0, y: 0, scale: 1, zOffset: 0, flipX: false },
  weapon: { x: 0, y: 0, scale: 1, zOffset: 0, flipX: false },
  vfx: { x: 0, y: 0, scale: 1, zOffset: 0, flipX: false },
} as const;

/** Camadas por baixo de tudo. */
export const BACKGROUND_LAYERS: readonly PaperdollLayerKey[] = ['aura', 'wings'] as const;

/** Camadas por cima do corpo. */
export const FOREGROUND_LAYERS: readonly PaperdollLayerKey[] = ['armor', 'helmet', 'weapon', 'vfx'] as const;

export interface SlotLayerBinding {
  readonly slot: EquipmentSlot;
  readonly layer: PaperdollLayerKey;
  /**
   * Deslocamento de z dentro da camada. Valores negativos ficam atrás da
   * arte principal da camada (ex.: capa atrás do corpo, botas atrás da
   * armadura).
   */
  readonly zOffset: number;
  /** `true` se a peça tem de ser desenhada atrás do corpo (capa). */
  readonly behindBody: boolean;
}

/**
 * Ordem de desenho final (fundo → frente). As sete camadas base mantêm a
 * ordem aprovada; `cloak` e `boots` entram como sub-camadas.
 */
export const SLOT_LAYER_BINDINGS: readonly SlotLayerBinding[] = [
  { slot: 'aura', layer: 'aura', zOffset: 0, behindBody: false },
  { slot: 'wings', layer: 'wings', zOffset: 0, behindBody: false },
  { slot: 'cloak', layer: 'body', zOffset: -20, behindBody: true },
  { slot: 'boots', layer: 'armor', zOffset: -10, behindBody: false },
  { slot: 'armor', layer: 'armor', zOffset: 0, behindBody: false },
  { slot: 'helmet', layer: 'helmet', zOffset: 0, behindBody: false },
  { slot: 'weapon', layer: 'weapon', zOffset: 0, behindBody: false },
  { slot: 'offhand', layer: 'weapon', zOffset: -5, behindBody: false },
  { slot: 'accessory', layer: 'vfx', zOffset: 0, behindBody: false },
] as const;

/** Todos os slots equipáveis, na ordem em que o Paperdoll os resolve. */
export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = SLOT_LAYER_BINDINGS.map((binding) => binding.slot);

/** Consulta rápida slot → binding. */
export const SLOT_BINDING_MAP: Readonly<Record<EquipmentSlot, SlotLayerBinding>> = SLOT_LAYER_BINDINGS.reduce(
  (accumulator, binding) => {
    accumulator[binding.slot] = binding;
    return accumulator;
  },
  {} as Record<EquipmentSlot, SlotLayerBinding>,
);

/** Camada final de um slot (para o inventário mostrar onde a peça aparece). */
export function layerForSlot(slot: EquipmentSlot): PaperdollLayerKey {
  return SLOT_BINDING_MAP[slot].layer;
}

/**
 * Cor de glow por raridade, em `rgb(...)` — espelha `src/styles/rarity.css`.
 * Mantida em TS porque o Paperdoll a injecta inline (não em classes Tailwind
 * dinâmicas, que o JIT não consegue detectar).
 */
export const RARITY_GLOW: Readonly<Record<string, string>> = {
  common: 'rgb(156 163 175 / 0.35)',
  uncommon: 'rgb(74 222 128 / 0.45)',
  rare: 'rgb(56 189 248 / 0.5)',
  epic: 'rgb(167 139 250 / 0.55)',
  legendary: 'rgb(251 191 36 / 0.6)',
  mythic: 'rgb(244 114 182 / 0.65)',
} as const;

/**
 * Cor sólida por raridade — bordas, badges e realces do HUD.
 * Mesma paleta de `rarity.css`, mantida em TS para estilos inline.
 */
export const RARITY_COLOR: Readonly<Record<Rarity, string>> = {
  common: 'rgb(156 163 175)',
  uncommon: 'rgb(74 222 128)',
  rare: 'rgb(56 189 248)',
  epic: 'rgb(167 139 250)',
  legendary: 'rgb(251 191 36)',
  mythic: 'rgb(244 114 182)',
} as const;

/** Nome legível da raridade no HUD/inventário. */
export const RARITY_LABEL: Readonly<Record<Rarity, string>> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
  mythic: 'Mítico',
} as const;
