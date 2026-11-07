export const metadata = {
  title: 'Aetheria Online - Idle RPG',
  description: 'Aetheria Idle RPG Game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  )
}
