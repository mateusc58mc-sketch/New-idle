import type { ReactNode } from 'react';

import '@/styles/rarity.css';

export const metadata = {
  title: 'Aetheria Online - Idle RPG',
  description: 'Aetheria Idle RPG Game',
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
