import type { ReactNode } from 'react';

import '@/styles/rarity.css';

export const metadata = {
  title: 'Ascent Gate Idle - Idle RPG',
  description: 'Ascent Gate Idle — Idle RPG de navegador com Paperdoll, torre de andares e mercado entre jogadores.',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  )
}
