import type { ReactNode } from 'react';

import '@/app/globals.css';
import '@/styles/rarity.css';

export const metadata = {
  title: 'Ascent Gate Idle - Idle RPG',
  description: 'Ascent Gate Idle — Idle RPG de navegador com Paperdoll, torre de andares e mercado entre jogadores.',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="pt" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
