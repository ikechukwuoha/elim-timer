import { NextResponse } from 'next/server'
import {
  CONTROL_AUTH_COOKIE,
  CONTROL_AUTH_MESSAGE,
  CONTROL_AUTH_TTL_SECONDS,
  createControlSessionToken,
  getControlAuthSettings,
} from '@/lib/controlAuth'

export async function POST(request: Request) {
  const settings = getControlAuthSettings()
  if (!settings.configured) {
    return NextResponse.json({ error: CONTROL_AUTH_MESSAGE }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const username =
    typeof body === 'object' && body !== null && 'username' in body ? body.username : null
  const password =
    typeof body === 'object' && body !== null && 'password' in body ? body.password : null

  if (username !== settings.username || password !== settings.password) {
    return NextResponse.json(
      { error: 'Invalid username or password.' },
      { status: 401 }
    )
  }

  const response = NextResponse.json({ success: true, username })
  response.cookies.set({
    name: CONTROL_AUTH_COOKIE,
    value: createControlSessionToken(username),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CONTROL_AUTH_TTL_SECONDS,
  })

  return response
}
