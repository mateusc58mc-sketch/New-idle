'use client';

/**
 * ArenaView — palco de batalha imersivo (estilo Ragnarök / idle mobile).
 *
 * Wrapper fino: a renderização da Arena inteira (mundo + nameplates + floats)
 * vive em `PixiArenaCanvas` (PixiJS/WebGL). O carregamento é client-only via
 * `next/dynamic` — o Pixi toca em `window`/WebGL, que não existem no SSR.
 *
 * Enquanto o bundle do Pixi chega, um gradiente do bioma é mantido como
 * placeholder para não piscar branco.
 */
import dynamic from 'next/dynamic';

import type { ArenaViewProps } from '@/components/combat/arena-shared';

export type { ArenaViewProps } from '@/components/combat/arena-shared';

const PixiArenaCanvas = dynamic(
  () => import('@/components/combat/PixiArenaCanvas').then((mod) => mod.PixiArenaCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #1e3a5f 0%, #020617 100%)',
        }}
      />
    ),
  },
);

export function ArenaView(props: ArenaViewProps) {
  return <PixiArenaCanvas {...props} />;
}
