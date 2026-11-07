'use client';

/**
 * useGameLoop — acumulador de tempo fixo sobre requestAnimationFrame.
 *
 * Porquê um acumulador fixo e não `delta` variável:
 *  · o resultado do combate não depende do FPS do utilizador (70 Hz ≠ 144 Hz);
 *  · o mesmo seed produz a mesma luta em qualquer máquina — requisito de
 *    validação server-side e dos testes de balanceamento;
 *  · tab em background (rAF pausado) recupera com passos limitados, sem
 *    "espiral da morte" e sem pular horas de combate num frame.
 *
 * O hook NÃO sabe nada de jogo: recebe um `onTick(stepSec)` e chama-o N vezes.
 * Isso permite testá-lo com um relógio falso e reutilizá-lo para o progresso
 * offline (que só precisa de um grande `stepSec`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { BALANCE } from '@/lib/game/balance';

export interface UseGameLoopOptions {
  /** Passo fixo em segundos (por omissão 1/60). */
  readonly stepSec?: number;
  /** Máximo de passos por frame (protecção contra catch-up). */
  readonly maxStepsPerFrame?: number;
  /** Arranca automaticamente. */
  readonly autoStart?: boolean;
  /** Não corre com o separador em background (poupa bateria). */
  readonly pauseWhenHidden?: boolean;
}

export interface UseGameLoopResult {
  readonly running: boolean;
  /** Segundos de jogo simulados desde o arranque (tempo de jogo, não de parede). */
  readonly gameTimeSec: number;
  /** FPS suavizado — útil para o modo de economia de bateria. */
  readonly fps: number;
  start(): void;
  pause(): void;
  toggle(): void;
  /** Reinicia o acumulador (ex.: ao mudar de andar). */
  reset(): void;
  /** Avança manualmente N passos (usado pelo progresso offline e testes). */
  step(count: number): void;
}

interface LoopStats {
  readonly fps: number;
  readonly gameTimeSec: number;
}

export function useGameLoop(
  onTick: (stepSec: number) => void,
  options: UseGameLoopOptions = {},
): UseGameLoopResult {
  const stepSec = options.stepSec ?? BALANCE.combat.tickIntervalSec;
  const maxStepsPerFrame = options.maxStepsPerFrame ?? BALANCE.combat.maxCatchUpSteps;
  const pauseWhenHidden = options.pauseWhenHidden ?? true;

  const [running, setRunning] = useState(options.autoStart ?? true);
  const [stats, setStats] = useState<LoopStats>({ fps: 0, gameTimeSec: 0 });

  // `onTick` muda a cada render (closures); guardar em ref evita reiniciar o loop.
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  const gameTimeRef = useRef<number>(0);
  const fpsSamplesRef = useRef<readonly number[]>([]);

  const runSteps = useCallback(
    (steps: number): void => {
      for (let i = 0; i < steps; i += 1) {
        tickRef.current(stepSec);
        gameTimeRef.current += stepSec;
      }
    },
    [stepSec],
  );

  useEffect(() => {
    if (!running) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    lastFrameRef.current = 0;
    accumulatorRef.current = 0;

    const frame = (timestamp: number): void => {
      if (lastFrameRef.current === 0) lastFrameRef.current = timestamp;
      const rawDelta = (timestamp - lastFrameRef.current) / 1000;
      lastFrameRef.current = timestamp;

      // Limita o delta a 250ms: um tab parado 10 min não simula 10 min.
      const delta = Math.min(Math.max(rawDelta, 0), 0.25);
      accumulatorRef.current += delta;

      let steps = 0;
      while (accumulatorRef.current >= stepSec && steps < maxStepsPerFrame) {
        accumulatorRef.current -= stepSec;
        steps += 1;
      }
      if (steps > 0) runSteps(steps);

      const instantFps = delta > 0 ? 1 / delta : 0;
      const samples = [...fpsSamplesRef.current, instantFps].slice(-30);
      fpsSamplesRef.current = samples;
      const avgFps = samples.reduce((sum, value) => sum + value, 0) / Math.max(1, samples.length);

      setStats({ fps: Math.round(avgFps), gameTimeSec: gameTimeRef.current });
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [running, stepSec, maxStepsPerFrame, runSteps]);

  // Pausa em background (bateria). Voltar repõe o acumulador sem salto.
  useEffect(() => {
    if (!pauseWhenHidden) return;
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        accumulatorRef.current = 0;
        lastFrameRef.current = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [pauseWhenHidden]);

  const start = useCallback((): void => setRunning(true), []);
  const pause = useCallback((): void => setRunning(false), []);
  const toggle = useCallback((): void => setRunning((value) => !value), []);
  const reset = useCallback((): void => {
    accumulatorRef.current = 0;
    lastFrameRef.current = 0;
    gameTimeRef.current = 0;
    setStats({ fps: 0, gameTimeSec: 0 });
  }, []);
  const step = useCallback((count: number): void => runSteps(Math.max(0, Math.floor(count))), [runSteps]);

  return { running, gameTimeSec: stats.gameTimeSec, fps: stats.fps, start, pause, toggle, reset, step };
}
