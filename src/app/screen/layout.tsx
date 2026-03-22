import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Big Screen — Elim Christian Garden International',
}

export default function ScreenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
