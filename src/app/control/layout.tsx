import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  CONTROL_AUTH_COOKIE,
  verifyControlSessionToken,
} from '@/lib/controlAuth'

export default async function ControlLayout({
  children,
}: {
  children: ReactNode
}) {
  const cookieStore = await cookies()
  const session = verifyControlSessionToken(
    cookieStore.get(CONTROL_AUTH_COOKIE)?.value ?? null
  )

  if (!session) {
    redirect('/login?next=%2Fcontrol')
  }

  return <>{children}</>
}
