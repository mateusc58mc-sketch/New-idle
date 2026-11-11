'use client';

/**
 * SynthesizerCanvas — main SVG workspace for the Sprite Lab.
 *
 * Renders all layers in z-order with transforms, rarity glow via SVG filters,
 * optional reference image underneath, grid overlay, and CSS animation states.
 */
import { useMemo } from 'react';
import { RARITY_GLOW } from '@/data/paperdoll-layers';
import type { SynthesizerState, SpriteLayerConfig } from '@/lib/sprite-lab/types';

/* ────────────────────────────────────────────────────────────────────────────
 * Animation keyframe styles — injected once via a <style> tag in the SVG.
 * ──────────────────────────────────────────────────────────────────────────── */

const ANIMATION_CSS = `
@keyframes sprite-idle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
@keyframes sprite-attack {
  0% { transform: translateX(0); }
  20% { transform: translateX(12px); }
  50% { transform: translateX(-4px); }
  100% { transform: translateX(0); }
}
@keyframes sprite-hit {
  0% { transform: translateX(0); filter: brightness(1); }
  15% { transform: translateX(-6px); filter: brightness(1.8) saturate(2); }
  30% { transform: translateX(6px); filter: brightness(1.4); }
  50% { transform: translateX(-3px); filter: brightness(1.1); }
  100% { transform: translateX(0); filter: brightness(1); }
}
@keyframes sprite-cast {
  0% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.08); filter: brightness(1.4); }
  100% { transform: scale(1); filter: brightness(1); }
}
@keyframes sprite-death {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(20px) rotate(12deg); opacity: 0; }
}
.anim-idle { animation: sprite-idle 2.4s ease-in-out infinite; }
.anim-attack { animation: sprite-attack 0.4s ease-out; }
.anim-hit { animation: sprite-hit 0.5s ease-out; }
.anim-cast { animation: sprite-cast 0.8s ease-in-out; }
.anim-death { animation: sprite-death 1s ease-in forwards; }
`;

const ANIM_CLASS: Readonly<Record<SynthesizerState['animationState'], string>> = {
  idle: 'anim-idle',
  attack: 'anim-attack',
  hit: 'anim-hit',
  cast: 'anim-cast',
  death: 'anim-death',
};

/* ────────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────────── */

export interface SynthesizerCanvasProps {
  readonly state: SynthesizerState;
  readonly onSelectLayer?: ((layerId: string) => void) | undefined;
}

export function SynthesizerCanvas({ state, onSelectLayer }: SynthesizerCanvasProps) {
  const {
    canvasWidth,
    canvasHeight,
    backgroundColor,
    showGrid,
    gridSize,
    selectedLayerId,
    layers,
    rarity,
    glowEnabled,
    glowIntensity,
    animationState,
    referenceImage,
    referenceOpacity,
  } = state;

  const glowRgb = RARITY_GLOW[rarity] ?? 'rgb(156 163 175 / 0.35)';
  const stdDev = Math.round(glowIntensity * 8);

  const sortedLayers = useMemo(
    () => [...layers].sort((a, b) => a.zIndex - b.zIndex),
    [layers],
  );

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-700/80 shadow-2xl ring-1 ring-white/10"
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        width={canvasWidth}
        height={canvasHeight}
        className={ANIM_CLASS[animationState]}
        style={{ display: 'block' }}
      >
        {/* Inject animation keyframes */}
        <defs>
          <style>{ANIMATION_CSS}</style>

          {/* Grid pattern */}
          {showGrid ? (
            <pattern
              id="sprite-grid"
              width={gridSize}
              height={gridSize}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="0.5"
              />
            </pattern>
          ) : null}

          {/* Rarity glow filter */}
          {glowEnabled ? (
            <filter id="rarityGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={stdDev} result="blur" />
              <feFlood floodColor={glowRgb} result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ) : null}

          {/* Selection highlight filter */}
          <filter id="selectionHighlight" x="-10%" y="-10%" width="120%" height="120%">
            <feMorphology operator="dilate" radius="1" in="SourceAlpha" result="expanded" />
            <feFlood floodColor="rgb(56 189 248)" floodOpacity="0.7" result="color" />
            <feComposite in="color" in2="expanded" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width={canvasWidth} height={canvasHeight} fill={backgroundColor} />

        {/* Reference image */}
        {referenceImage ? (
          <image
            href={referenceImage}
            x="0"
            y="0"
            width={canvasWidth}
            height={canvasHeight}
            opacity={referenceOpacity}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : null}

        {/* Grid overlay */}
        {showGrid ? (
          <rect width={canvasWidth} height={canvasHeight} fill="url(#sprite-grid)" />
        ) : null}

        {/* Layers */}
        {sortedLayers.map((layer) => (
          <SpriteLayer
            key={layer.id}
            layer={layer}
            isSelected={layer.id === selectedLayerId}
            glowEnabled={glowEnabled}
            onSelect={onSelectLayer}
          />
        ))}

        {/* Canvas border */}
        <rect
          width={canvasWidth}
          height={canvasHeight}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Individual Layer Renderer
 * ──────────────────────────────────────────────────────────────────────────── */

interface SpriteLayerProps {
  readonly layer: SpriteLayerConfig;
  readonly isSelected: boolean;
  readonly glowEnabled: boolean;
  readonly onSelect?: ((layerId: string) => void) | undefined;
}

function SpriteLayer({ layer, isSelected, glowEnabled, onSelect }: SpriteLayerProps) {
  if (!layer.visible) return null;

  const { offsetX, offsetY, scale, rotation, flipX, opacity, content } = layer;
  const sx = flipX ? -scale : scale;

  const transform = [
    `translate(${offsetX}, ${offsetY})`,
    `scale(${sx}, ${scale})`,
    `rotate(${rotation})`,
  ].join(' ');

  const filterVal = isSelected
    ? 'url(#selectionHighlight)'
    : glowEnabled
      ? 'url(#rarityGlow)'
      : undefined;

  const handleClick = () => {
    onSelect?.(layer.id);
  };

  if (content.type === 'image') {
    return (
      <g
        transform={transform}
        opacity={opacity}
        filter={filterVal}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      >
        <image
          href={content.dataUrl}
          width="64"
          height="64"
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
    );
  }

  if (content.pathData.trim().startsWith('<')) {
    return (
      <g
        transform={transform}
        opacity={opacity}
        filter={filterVal}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
        dangerouslySetInnerHTML={{ __html: content.pathData }}
      />
    );
  }

  return (
    <g
      transform={transform}
      opacity={opacity}
      filter={filterVal}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      <path
        d={content.pathData}
        fill={content.fill}
        stroke={content.stroke}
        strokeWidth={content.strokeWidth}
      />
    </g>
  );
}
