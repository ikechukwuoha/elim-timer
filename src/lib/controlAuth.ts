import crypto from 'node:crypto'

export const CONTROL_AUTH_COOKIE = 'elim_control_session'
export const CONTROL_AUTH_TTL_SECONDS = 60 * 60 * 12
export const CONTROL_AUTH_MESSAGE =
  'Control authentication is not configured. Set ELIM_AUTH_USERNAME, ELIM_AUTH_PASSWORD, and ELIM_SESSION_SECRET.'

type ControlAuthSettings = {
  username: string
  password: string
  secret: string
  configured: boolean
}

export type ControlSession = {
  username: string
  expiresAt: number
}

export function getControlAuthSettings(): ControlAuthSettings {
  const username = process.env.ELIM_AUTH_USERNAME ?? 'admin'
  const password = process.env.ELIM_AUTH_PASSWORD ?? ''
  const secret = process.env.ELIM_SESSION_SECRET ?? ''

  return {
    username,
    password,
    secret,
    configured: Boolean(password && secret),
  }
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

export function createControlSessionToken(username: string): string {
  const settings = getControlAuthSettings()
  if (!settings.secret) {
    throw new Error(CONTROL_AUTH_MESSAGE)
  }

  const expiresAt = Date.now() + CONTROL_AUTH_TTL_SECONDS * 1000
  const encodedUser = Buffer.from(username, 'utf8').toString('base64url')
  const payload = `${encodedUser}.${expiresAt}`
  const signature = signPayload(payload, settings.secret)

  return `${payload}.${signature}`
}

export function verifyControlSessionToken(token?: string | null): ControlSession | null {
  const settings = getControlAuthSettings()
  if (!token || !settings.secret) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [encodedUser, expiresRaw, providedSignature] = parts
  const payload = `${encodedUser}.${expiresRaw}`
  const expectedSignature = signPayload(payload, settings.secret)

  const providedBuffer = Buffer.from(providedSignature, 'utf8')
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8')

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null
  }

  const expiresAt = Number(expiresRaw)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null
  }

  try {
    const username = Buffer.from(encodedUser, 'base64url').toString('utf8')
    if (!username) return null
    return { username, expiresAt }
  } catch {
    return null
  }
}

export function isSafeNextPath(path: string | null | undefined): path is string {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'))
}
