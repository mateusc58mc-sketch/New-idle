'use client';

/**
 * PaperdollAvatar — composição de camadas PNG transparentes.
 *
 * Ordem rígida (fundo → frente):
 *   Aura → Asas → Corpo da Raça → Armadura → Elmo → Arma → VFX
 *
 * As âncoras vêm de `Race.paperdoll.anchors`, que é IDÊNTICO em todas as
 * raças — é isso que garante alinhamento. O componente não sabe nada de jogo:
 * recebe `PaperdollState` já resolvido e desenha.
 *
 * Estratégia de render: DOM/CSS (não Canvas). Razões:
 *  · 4 avatares em combate não justificam um canvas;
 *  · permite glow por `box-shadow`/`filter` sem shaders;
 *  · acessibilidade e selecção de texto funcionam;
 *  · sprite-sheet de 1 frame por vez com `background-position` é trivial.
 * Se um dia forem 20+ avatares, `mode="canvas"` fica preparado para migrar.
 */
import { useMemo, useState } from 'react';

import { RACE_BY_ID } from '@/data/races';
import { layerStyle } from '@/lib/game/paperdoll';
import type { PaperdollLayerKey, PaperdollState, ResolvedLayer } from '@/types/game';

export type PaperdollSize = 'sm' | 'md' | 'lg' | 'xl';

export interface PaperdollAvatarProps {
  readonly state: PaperdollState;
  /** Tamanho em px (o `displayScale` da raça multiplica por cima). */
  readonly size?: PaperdollSize;
  /** Anel de glow por raridade do conjunto. */
  readonly showGlow?: boolean;
  /** Moldura + fundo do slot. */
  readonly showFrame?: boolean;
  /** Nome acessível; sem ele o avatar é decorativo. */
  readonly label?: string;
  readonly className?: string;
}

const SIZE_PX: Readonly<Record<PaperdollSize, number>> = {
  sm: 48,
  md: 96,
  lg: 160,
  xl: 256,
} as const;

const LAYER_Z_INDEX: Readonly<Record<PaperdollLayerKey, number>> = {
  aura: 10,
  wings: 20,
  body: 30,
  armor: 40,
  helmet: 50,
  weapon: 60,
  vfx: 70,
};

export function PaperdollAvatar({
  state,
  size = 'md',
  showGlow = true,
  showFrame = true,
  label,
  className,
}: PaperdollAvatarProps) {
  const px = SIZE_PX[size];
  const race = RACE_BY_ID.get(state.raceId);

  // Camadas já vêm ordenadas de `resolvePaperdoll`; não reordenar aqui.
  const layers = state.layers;

  const containerStyle = useMemo(
    () => ({
      width: px,
      height: px,
      position: 'relative' as const,
      overflow: 'hidden' as const,
      borderRadius: showFrame ? Math.round(px * 0.16) : 0,
      background: showFrame
        ? 'radial-gradient(circle at 50% 32%, #243049 0%, #111827 70%)'
        : 'transparent',
      boxShadow:
        showGlow && state.glow
          ? `inset 0 0 ${Math.round(px * 0.12)}px ${state.glow}, 0 0 ${Math.round(px * 0.09)}px ${state.glow}`
          : showFrame
            ? 'inset 0 0 0 1px #334155'
            : 'none',
      transition: 'box-shadow 200ms ease',
    }),
    [px, showFrame, showGlow, state.glow],
  );

  return (
    <div
      className={className}
      style={containerStyle}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-animation={state.animation}
    >
      {layers.length === 0 ? (
        // Placeholder: nunca deixar um buraco negro no HUD.
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: Math.round(px * 0.4),
            opacity: 0.4,
          }}
        >
          {race ? race.palette.accent : '?'}
        </div>
      ) : (
        layers.map((layer, index) => (
          <LayerImage
            key={`${layer.key}-${layer.slot ?? 'base'}-${index}`}
            layer={layer}
            canvasWidth={state.canvas.width}
            canvasHeight={state.canvas.height}
            fallbackColor={race?.palette.accent ?? '#64748b'}
          />
        ))
      )}
    </div>
  );
}

function LayerImage({
  layer,
  canvasWidth,
  canvasHeight,
  fallbackColor,
}: {
  readonly layer: ResolvedLayer;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly fallbackColor: string;
}) {
  const [failed, setFailed] = useState(false);
  const zIndex = LAYER_Z_INDEX[layer.key] + (layer.zOffset < 0 ? -5 : 0);
  const style = { ...layerStyle(layer, canvasWidth, canvasHeight), zIndex };
  const sheet = layer.asset.sheet;

  if (failed) {
    if (layer.key !== 'body') return null;
    return (
      <div
        aria-hidden
        style={{
          ...style,
          aspectRatio: `${canvasWidth} / ${canvasHeight}`,
          borderRadius: '46% 46% 38% 38%',
          background: `radial-gradient(ellipse at 50% 38%, ${fallbackColor} 0%, transparent 68%)`,
          opacity: 0.35,
        }}
      />
    );
  }

  if (sheet) {
    // Sprite-sheet: mostra o primeiro frame via background-position.
    return (
      <div
        aria-hidden
        style={{
          ...style,
          aspectRatio: `${sheet.frameWidth} / ${sheet.frameHeight}`,
          backgroundImage: `url(${layer.asset.src})`,
          backgroundSize: `${sheet.columns * 100}% ${sheet.rows * 100}%`,
          backgroundPosition: '0 0',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <img
          alt=""
          aria-hidden
          onError={() => setFailed(true)}
          src={layer.asset.src}
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
        />
      </div>
    );
  }

  return (
    <img
      src={layer.asset.src}
      alt=""
      aria-hidden
      draggable={false}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      style={{
        ...style,
        objectFit: 'contain',
      }}
    />
  );
}

/** Esqueleto para estados de carregamento (inventário, mercado). */
export function PaperdollSkeleton({ size = 'md' }: { readonly size?: PaperdollSize }) {
  const px = SIZE_PX[size];
  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: Math.round(px * 0.16),
        background: 'linear-gradient(110deg, #12121f 8%, #1a1a2e 18%, #12121f 33%)',
        backgroundSize: '200% 100%',
        animation: 'paperdoll-shimmer 1.4s linear infinite',
      }}
    />
  );
}
