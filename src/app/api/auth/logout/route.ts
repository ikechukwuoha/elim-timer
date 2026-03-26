import { NextResponse } from 'next/server'
import { CONTROL_AUTH_COOKIE } from '@/lib/controlAuth'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: CONTROL_AUTH_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}
