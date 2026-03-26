'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import styles from './page.module.css'

function isSafeNextPath(path: string | null | undefined): path is string {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'))
}

export default function LoginForm({ configured }: { configured: boolean }) {
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const nextPath = useMemo(() => {
    const requested = searchParams.get('next')
    return isSafeNextPath(requested) ? requested : '/control'
  }, [searchParams])

  const loggedOut = searchParams.get('logged_out') === '1'

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!configured || submitting) return

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(
          typeof data.error === 'string' ? data.error : 'Unable to sign in right now.'
        )
        return
      }

      window.location.assign(nextPath)
    } catch {
      setError('Unable to reach the server right now.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.orbPrimary} />
      <div className={styles.orbSecondary} />

      <main className={styles.main}>
        <section className={styles.infoPanel}>
          <span className={styles.kicker}>Authorized access only</span>
          <h1 className={styles.title}>Control access is now protected.</h1>
          <p className={styles.lead}>
            Only approved operators can open the service control screen, manage live content,
            or use the reporting tools.
          </p>

          <div className={styles.featureList}>
            <p>Secure the live control interface with a server-issued session cookie.</p>
            <p>Keep the public big-screen display available without exposing the operator tools.</p>
            <p>Protect the control-related API endpoints so the gate is not only visual.</p>
          </div>

          <Link href="/" className={styles.backLink}>
            Return to home page
          </Link>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.formHeader}>
            <span className={styles.formBadge}>Control login</span>
            <h2 className={styles.formTitle}>Sign in to continue</h2>
            <p className={styles.formText}>
              Use the operator credentials configured on the server to access the control panel.
            </p>
          </div>

          {loggedOut && (
            <div className={styles.infoMessage}>
              You have been logged out. Sign in again to continue.
            </div>
          )}

          {!configured ? (
            <div className={styles.errorBox}>
              Authentication has not been configured yet. Add `ELIM_AUTH_USERNAME`,
              `ELIM_AUTH_PASSWORD`, and `ELIM_SESSION_SECRET` to `.env.local`, then restart the
              server.
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.field}>
                <span>Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </label>

              {error && <div className={styles.errorBox}>{error}</div>}

              <button type="submit" className={styles.submitButton} disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in to control'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  )
}
