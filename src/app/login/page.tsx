import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'
import {
  CONTROL_AUTH_COOKIE,
  getControlAuthSettings,
  verifyControlSessionToken,
} from '@/lib/controlAuth'

export default async function LoginPage() {
  const settings = getControlAuthSettings()
  const cookieStore = await cookies()
  const session = verifyControlSessionToken(
    cookieStore.get(CONTROL_AUTH_COOKIE)?.value ?? null
  )

  if (session) {
    redirect('/control')
  }

  return <LoginForm configured={settings.configured} />
}
