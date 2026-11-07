'use client';

/**
 * useFloatingText — floating combat text (números de dano/cura na tela).
 *
 * Consome a fila de eventos do motor e transforma cada evento num "float"
 * com posição, cor e duração. A posição é derivada do alvo (actorId), não
 * aleatória, para o número aparecer sobre o combatente certo.
 *
 * Porquê um hook separado:
 *  · o motor publica eventos a 60 Hz; a UI só quer os últimos ~40;
 *  · cada float tem o seu próprio ciclo de vida (700–1100 ms);
 *  · animar via CSS `animation` + `requestAnimationFrame` de limpeza é mais
 *    barato que re-renderizar o avatar a cada número.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { CombatEvent, Uuid } from '@/types/game';

export type FloatKind = 'damage' | 'crit' | 'miss' | 'heal' | 'shield' | 'death' | 'skill';

export interface FloatingNumber {
  readonly id: string;
  readonly targetId: Uuid;
  readonly kind: FloatKind;
  readonly text: string;
  readonly value: number;
  /** Deslocamento horizontal para números simultâneos não colidirem. */
  readonly offsetX: number;
  readonly createdAt: number;
  readonly durationMs: number;
}

export interface UseFloatingTextOptions {
  /** Máximo de números em ecrã ao mesmo tempo. */
  readonly maxItems?: number;
  /** Duração base da animação. */
  readonly baseDurationMs?: number;
  /** Desliga animações (acessibilidade / economia de bateria). */
  readonly disabled?: boolean;
}

export interface UseFloatingTextResult {
  readonly floats: readonly FloatingNumber[];
  /** Empurra eventos do motor para a camada visual. */
  push(events: readonly CombatEvent[]): void;
  /** Marca uma animação de skill (chamado pelo consumidor no evento de cast). */
  pushSkill(targetId: Uuid, label: string): void;
  clear(): void;
}

const DURATION_BY_KIND: Readonly<Record<FloatKind, number>> = {
  damage: 800,
  crit: 1000,
  miss: 700,
  heal: 900,
  shield: 900,
  death: 1100,
  skill: 750,
} as const;

export function useFloatingText(options: UseFloatingTextOptions = {}): UseFloatingTextResult {
  const maxItems = options.maxItems ?? 40;
  const baseDurationMs = options.baseDurationMs ?? 900;
  const disabled = options.disabled ?? false;

  const [floats, setFloats] = useState<readonly FloatingNumber[]>([]);
  const sequenceRef = useRef(0);
  const offsetRef = useRef<Map<Uuid, number>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleCleanup = useCallback((): void => {
    if (timerRef.current !== null) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const now = Date.now();
      setFloats((current) => current.filter((float) => now - float.createdAt < float.durationMs));
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const push = useCallback(
    (events: readonly CombatEvent[]): void => {
      if (disabled || events.length === 0) return;
      const now = Date.now();

      const created: FloatingNumber[] = [];
      for (const event of events) {
        const float = toFloatingNumber(event, now, baseDurationMs, offsetRef, sequenceRef);
        if (float) created.push(float);
      }
      if (created.length === 0) return;

      setFloats((current) => [...current, ...created].slice(-maxItems));
      scheduleCleanup();
    },
    [baseDurationMs, disabled, maxItems, scheduleCleanup],
  );

  const pushSkill = useCallback(
    (targetId: Uuid, label: string): void => {
      if (disabled) return;
      const now = Date.now();
      sequenceRef.current += 1;
      setFloats((current) =>
        [
          ...current,
          {
            id: `skill-${sequenceRef.current}`,
            targetId,
            kind: 'skill' as const,
            text: label,
            value: 0,
            offsetX: 0,
            createdAt: now,
            durationMs: DURATION_BY_KIND.skill,
          },
        ].slice(-maxItems),
      );
      scheduleCleanup();
    },
    [disabled, maxItems, scheduleCleanup],
  );

  const clear = useCallback((): void => {
    setFloats([]);
    offsetRef.current.clear();
  }, []);

  return { floats, push, pushSkill, clear };
}

/* ==========================================================================
 * CONVERSÃO
 * ========================================================================== */

function toFloatingNumber(
  event: CombatEvent,
  now: number,
  baseDurationMs: number,
  offsets: React.MutableRefObject<Map<Uuid, number>>,
  sequence: React.MutableRefObject<number>,
): FloatingNumber | null {
  switch (event.type) {
    case 'damage': {
      if (event.isMiss) {
        return make(event.targetId, 'miss', 'MISS', 0, now, baseDurationMs, offsets, sequence);
      }
      const isCrit = event.isCrit;
      return make(
        event.targetId,
        isCrit ? 'crit' : 'damage',
        isCrit ? `✦ ${formatNumber(event.amount)}` : formatNumber(event.amount),
        event.amount,
        now,
        baseDurationMs,
        offsets,
        sequence,
        isCrit ? 1.35 : 1,
      );
    }
    case 'heal':
      return make(event.targetId, 'heal', `+${formatNumber(event.amount)}`, event.amount, now, baseDurationMs, offsets, sequence);
    case 'shield':
      return make(event.targetId, 'shield', `⬡ ${formatNumber(event.amount)}`, event.amount, now, baseDurationMs, offsets, sequence);
    case 'death':
      return make(event.actorId, 'death', '☠', 0, now, baseDurationMs, offsets, sequence);
    case 'skill_cast':
      return null;
    default:
      return null;
  }
}

function make(
  targetId: Uuid,
  kind: FloatKind,
  text: string,
  value: number,
  now: number,
  baseDurationMs: number,
  offsets: React.MutableRefObject<Map<Uuid, number>>,
  sequence: React.MutableRefObject<number>,
  durationMultiplier = 1,
): FloatingNumber {
  sequence.current += 1;
  const stack = (offsets.current.get(targetId) ?? 0) + 1;
  offsets.current.set(targetId, stack);
  // Liberta o contador depois de a animação terminar.
  setTimeout(() => {
    const current = offsets.current.get(targetId) ?? 1;
    if (current <= 1) offsets.current.delete(targetId);
    else offsets.current.set(targetId, current - 1);
  }, DURATION_BY_KIND[kind]);

  return {
    id: `${kind}-${sequence.current}`,
    targetId,
    kind,
    text,
    value,
    // -1, 0, 1, -2, 2 … para não sobrepor números simultâneos.
    offsetX: stack % 2 === 0 ? (stack / 2) * 14 : -((stack - 1) / 2) * 14,
    createdAt: now,
    durationMs: Math.round(DURATION_BY_KIND[kind] * durationMultiplier * (baseDurationMs / 900)),
  };
}

/** 12345 → "12,3k" — números grandes não cabem no ecrã. */
export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1000) return String(Math.round(value));
  if (abs < 1_000_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (abs < 1_000_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
}
