import type { ReactNode } from 'react'

export default async function ControlLayout({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>
}
