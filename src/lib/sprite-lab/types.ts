/**
 * Sprite Lab — types for the internal sprite synthesizer.
 *
 * These are LOCAL to the sprite-lab tool and never leak into the game engine.
 * Game-domain types are imported read-only from `@/types/game`.
 */
import type { PaperdollLayerKey, Rarity } from '@/types/game';

/** A single SVG layer in the synthesizer */
export interface SpriteLayerConfig {
  readonly id: string;
  readonly key: PaperdollLayerKey;
  readonly label: string;
  readonly visible: boolean;
  readonly opacity: number;
  /** Position offset from anchor in px */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
  readonly rotation: number;
  readonly flipX: boolean;
  /** SVG path data or reference image data URL */
  readonly content: SpriteContent;
  readonly zIndex: number;
}

export type SpriteContent =
  | {
      readonly type: 'svg';
      readonly pathData: string;
      readonly fill: string;
      readonly stroke: string;
      readonly strokeWidth: number;
    }
  | { readonly type: 'image'; readonly dataUrl: string };

/** State of the full synthesizer canvas */
export interface SynthesizerState {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly backgroundColor: string;
  readonly showGrid: boolean;
  readonly gridSize: number;
  readonly selectedLayerId: string | null;
  readonly layers: readonly SpriteLayerConfig[];
  readonly rarity: Rarity;
  readonly glowEnabled: boolean;
  readonly glowIntensity: number;
  readonly animationState: 'idle' | 'attack' | 'hit' | 'cast' | 'death';
  readonly referenceImage: string | null;
  readonly referenceOpacity: number;
}

/** Category for SVG templates */
export type SvgTemplateCategory =
  | 'weapon'
  | 'armor'
  | 'helmet'
  | 'shield'
  | 'aura'
  | 'wings';

/** Parameters passed to SVG template renderers */
export interface SvgTemplateParams {
  readonly fill: string;
  readonly stroke: string;
  readonly glowColor: string | null;
  readonly scale: number;
}

/** A parametric SVG template */
export interface SvgTemplate {
  readonly id: string;
  readonly name: string;
  readonly category: SvgTemplateCategory;
  readonly layer: PaperdollLayerKey;
  readonly defaultWidth: number;
  readonly defaultHeight: number;
  readonly render: (params: SvgTemplateParams) => string;
}
