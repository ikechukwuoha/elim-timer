import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  CONTROL_AUTH_COOKIE,
  getControlAuthSettings,
  verifyControlSessionToken,
} from '@/lib/controlAuth'

export async function GET() {
  const settings = getControlAuthSettings()
  const cookieStore = await cookies()
  const session = settings.configured
    ? verifyControlSessionToken(cookieStore.get(CONTROL_AUTH_COOKIE)?.value ?? null)
    : null

  return NextResponse.json({
    configured: settings.configured,
    authenticated: Boolean(session),
    username: session?.username ?? null,
  })
}
