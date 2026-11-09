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
import type { EquipmentSlot, PaperdollLayerKey, Rarity } from '@/types/game';

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
