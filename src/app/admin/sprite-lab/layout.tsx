import type { ReactNode } from 'react';

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
    <div className="min-h-screen bg-void-950 text-slate-100 flex flex-col font-sans">
      {children}
    </div>
  );
}
