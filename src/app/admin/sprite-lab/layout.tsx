import type { ReactNode } from 'react';

import '@/app/globals.css';
import '@/styles/rarity.css';

export const metadata = {
  title: 'Sprite Lab — Ascent Gate Idle',
  description: 'Internal sprite synthesizer and parametric SVG asset mini-editor',
};

export default function SpriteLabLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {children}
    </div>
  );
}
