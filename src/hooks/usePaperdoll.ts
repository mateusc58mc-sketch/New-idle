'use client';

/**
 * usePaperdoll — resolve o avatar em camadas e memoiza o resultado.
 *
 * A resolução é pura (`lib/game/paperdoll.ts`); o hook só:
 *  · memoiza por identidade estável (evita recompor 7 camadas por frame);
 *  · pré-carrega as imagens para não haver "pop-in" no combate;
 *  · expõe `imageLoaded` para a UI mostrar placeholder até estar pronto.
 *
 * Nota de performance: o avatar NÃO é re-renderizado pelo loop de combate.
 * O `state` do Paperdoll só muda quando raça/equipamento/cosmético mudam.
 */
import { useEffect, useMemo, useState } from 'react';

import { RACE_BY_ID } from '@/data/races';
import { ITEM_BY_ID } from '@/data/items';
import { resolvePaperdoll, type ResolvePaperdollResult } from '@/lib/game/paperdoll';
import type {
  Appearance,
  EquipmentSlot,
  InventoryItem,
  Item,
  PaperdollAnimation,
  PaperdollState,
} from '@/types/game';

export interface UsePaperdollOptions {
  readonly raceId: string;
  readonly appearance: Appearance;
  readonly equipment: Readonly<Record<EquipmentSlot, InventoryItem | null>>;
  readonly animation?: PaperdollAnimation;
  /** Catálogo alternativo (testes). Por omissão usa o catálogo estático. */
  readonly catalogue?: ReadonlyMap<string, Item>;
  /** Desliga o pré-carregamento (SSR, testes). */
  readonly preload?: boolean;
}

export interface UsePaperdollResult {
  readonly state: PaperdollState | null;
  readonly slots: ResolvePaperdollResult['slots'];
  readonly ready: boolean;
  /** `true` quando a raça não existe no catálogo. */
  readonly invalid: boolean;
}

export function usePaperdoll(options: UsePaperdollOptions): UsePaperdollResult {
  const { raceId, appearance, equipment, animation, catalogue, preload = true } = options;

  const race = RACE_BY_ID.get(raceId) ?? null;

  const resolved = useMemo<ResolvePaperdollResult | null>(() => {
    if (!race) return null;
    return resolvePaperdoll({
      race,
      appearance,
      equipment,
      catalogue: catalogue ?? ITEM_BY_ID,
      animation: animation ?? 'idle',
    });
  }, [race, appearance, equipment, catalogue, animation]);

  const sources = useMemo<readonly string[]>(() => {
    if (!resolved) return [];
    return resolved.state.layers.map((layer) => layer.asset.src);
  }, [resolved]);

  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    if (!preload || sources.length === 0) {
      setLoadedCount(sources.length);
      return;
    }
    let cancelled = false;
    let done = 0;
    setLoadedCount(0);

    for (const src of sources) {
      const image = new Image();
      const settle = (): void => {
        done += 1;
        if (!cancelled) setLoadedCount(done);
      };
      image.onload = settle;
      image.onerror = settle; // asset em falta não bloqueia a UI
      image.src = src;
    }

    return () => {
      cancelled = true;
    };
  }, [sources, preload]);

  const ready = sources.length === 0 || loadedCount >= sources.length;

  return {
    state: resolved?.state ?? null,
    slots: resolved?.slots ?? [],
    ready,
    invalid: race === null,
  };
}
