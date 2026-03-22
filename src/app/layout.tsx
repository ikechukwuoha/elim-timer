import type { Metadata } from 'next'
import { Bebas_Neue, Inter, Cinzel } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Elim Christian Garden International — Service Timer',
  description: 'Church service activity countdown timer',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${inter.variable} ${cinzel.variable}`}
      suppressHydrationWarning={true}
    >
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  )
}
