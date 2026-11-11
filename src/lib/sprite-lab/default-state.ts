/**
 * Factory for the default SynthesizerState.
 *
 * 256×256 canvas, grid on (16 px), with an initial sample weapon layer
 * showcasing parametric SVG rendering and rarity glow right out of the box.
 */
import { RARITY_GLOW } from '@/data/paperdoll-layers';
import { TEMPLATE_BY_ID } from './svg-templates';
import type { SpriteLayerConfig, SynthesizerState } from './types';

export function createDefaultSynthesizerState(): SynthesizerState {
  const swordTpl = TEMPLATE_BY_ID.get('sword');
  const initialMarkup = swordTpl
    ? swordTpl.render({
        fill: '#38bdf8',
        stroke: '#0284c7',
        glowColor: RARITY_GLOW.legendary ?? null,
        scale: 1,
      })
    : 'M28 8 L32 2 L36 8 L36 50 L34 54 L30 54 L28 50 Z';

  const defaultLayers: readonly SpriteLayerConfig[] = [
    {
      id: 'layer-weapon-1',
      key: 'weapon',
      label: 'Lâmina Lendária (Demo)',
      visible: true,
      opacity: 1,
      offsetX: 96,
      offsetY: 96,
      scale: 1.2,
      rotation: 0,
      flipX: false,
      content: {
        type: 'svg',
        pathData: initialMarkup,
        fill: '#38bdf8',
        stroke: '#0284c7',
        strokeWidth: 1.5,
      },
      zIndex: 60,
    },
  ];

  return {
    canvasWidth: 256,
    canvasHeight: 256,
    backgroundColor: '#0b0b14',
    showGrid: true,
    gridSize: 16,
    selectedLayerId: 'layer-weapon-1',
    layers: defaultLayers,
    rarity: 'legendary',
    glowEnabled: true,
    glowIntensity: 0.75,
    animationState: 'idle',
    referenceImage: null,
    referenceOpacity: 0.35,
  };
}
