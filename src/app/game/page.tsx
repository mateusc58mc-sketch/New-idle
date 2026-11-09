import type { Metadata } from 'next';

import { GameArena } from '@/components/game/GameArena';

export const metadata: Metadata = {
  title: 'Arena — Ascent Gate Idle',
  description: 'Combate e progresso sincronizado do Ascent Gate Idle.',
};

export default function GamePage() {
  return (
    <main style={{ minHeight: '100vh', padding: '1px 20px 48px', background: '#07070c' }}>
      <GameArena />
    </main>
  );
}
