'use client';

/**
 * FloatingCombatText — camada visual dos números de dano/cura.
 *
 * Desenha cada float posicionado sobre o combatente correspondente.
 * A posição chega do pai (`positions`), que a calcula a partir do layout das
 * lanes — assim o número aparece exactamente sobre o sprite, em qualquer
 * tamanho de ecrã.
 */
import { useMemo } from 'react';

import type { FloatingNumber } from '@/hooks/useFloatingText';
import type { Uuid } from '@/types/game';

export interface FloatingCombatTextProps {
  readonly floats: readonly FloatingNumber[];
  /** Posição (px, relativa ao contentor) de cada combatente. */
  readonly positions: Readonly<Record<Uuid, { readonly x: number; readonly y: number }>>;
  readonly reducedMotion?: boolean;
}

const COLOR: Readonly<Record<FloatingNumber['kind'], string>> = {
  damage: 'rgb(var(--dmg-normal))',
  crit: 'rgb(var(--dmg-crit))',
  miss: 'rgb(var(--dmg-miss))',
  heal: 'rgb(var(--dmg-heal))',
  shield: '#7dd3fc',
  death: '#f87171',
  skill: '#c4b5fd',
} as const;

const FONT_SIZE: Readonly<Record<FloatingNumber['kind'], number>> = {
  damage: 15,
  crit: 21,
  miss: 12,
  heal: 15,
  shield: 13,
  death: 18,
  skill: 12,
} as const;

export function FloatingCombatText({ floats, positions, reducedMotion = false }: FloatingCombatTextProps) {
  const visible = useMemo(
    () => floats.filter((float) => positions[float.targetId] !== undefined),
    [floats, positions],
  );

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 20,
      }}
    >
      {visible.map((float) => {
        const origin = positions[float.targetId];
        if (!origin) return null;
        const isCrit = float.kind === 'crit';

        return (
          <span
            key={float.id}
            style={{
              position: 'absolute',
              left: origin.x + float.offsetX,
              top: origin.y,
              transform: 'translate(-50%, -50%)',
              fontFamily: 'var(--mono, ui-monospace, monospace)',
              fontWeight: isCrit ? 800 : 700,
              fontSize: FONT_SIZE[float.kind],
              color: COLOR[float.kind],
              textShadow: isCrit
                ? '0 0 8px rgba(251,191,36,.9), 0 1px 3px #000'
                : '0 1px 3px #000, 0 0 4px rgba(0,0,0,.6)',
              letterSpacing: isCrit ? '0.5px' : '0.2px',
              whiteSpace: 'nowrap',
              animation: reducedMotion
                ? 'none'
                : `aetheria-float ${float.durationMs}ms cubic-bezier(.16,.84,.44,1) forwards`,
              opacity: reducedMotion ? 0.9 : undefined,
              willChange: 'transform, opacity',
            }}
          >
            {float.text}
          </span>
        );
      })}
    </div>
  );
}

/** Keyframes injectados uma vez — evita dependência de ficheiro CSS global. */
export const FLOATING_TEXT_KEYFRAMES = `
@keyframes aetheria-float {
  0%   { opacity: 0; transform: translate(-50%, -40%) scale(0.7); }
  18%  { opacity: 1; transform: translate(-50%, -58%) scale(1.08); }
  100% { opacity: 0; transform: translate(-50%, -120%) scale(0.94); }
}
@keyframes aetheria-wave-flash {
  0%   { opacity: 0; }
  30%  { opacity: 0.85; }
  100% { opacity: 0; }
}
@keyframes aetheria-floor-rise {
  0%   { opacity: 0; transform: translateY(18px) scale(0.96); }
  20%  { opacity: 1; transform: translateY(0) scale(1); }
  80%  { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-14px) scale(1.02); }
}
@keyframes aetheria-boss-pulse {
  0%, 100% { box-shadow: inset 0 0 40px rgba(239,68,68,.25); }
  50%      { box-shadow: inset 0 0 70px rgba(239,68,68,.55); }
}
@keyframes aetheria-target-pulse {
  0%, 100% { opacity: .62; box-shadow: 0 0 6px #38bdf8; }
  50%      { opacity: 1; box-shadow: 0 0 14px #38bdf8; }
}
`;
