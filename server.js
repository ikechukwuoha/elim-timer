process.on('uncaughtException',  (err)    => console.warn('[Server] Uncaught exception:', err.message))
process.on('unhandledRejection', (reason) => console.warn('[Server] Unhandled rejection:', reason))

const { createServer }    = require('http')
const { parse }           = require('url')
const next                = require('next')
const fs                  = require('fs')
const path                = require('path')
const crypto              = require('crypto')

const dev  = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const app  = next({ dev })
const handle = app.getRequestHandler()

const CONTROL_AUTH_COOKIE = 'elim_control_session'
const CONTROL_AUTH_TTL_SECONDS = 60 * 60 * 12
const CONTROL_AUTH_MESSAGE = 'Control authentication is not configured. Set ELIM_AUTH_USERNAME, ELIM_AUTH_PASSWORD, and ELIM_SESSION_SECRET.'

function getAuthSettings() {
  const username = process.env.ELIM_AUTH_USERNAME || 'admin'
  const password = process.env.ELIM_AUTH_PASSWORD || ''
  const secret = process.env.ELIM_SESSION_SECRET || ''
  return { username, password, secret, configured: Boolean(password && secret) }
}

function signAuthPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function createControlSessionToken(username) {
  const settings = getAuthSettings()
  const expiresAt = Date.now() + (CONTROL_AUTH_TTL_SECONDS * 1000)
  const encodedUser = Buffer.from(username, 'utf8').toString('base64url')
  const payload = `${encodedUser}.${expiresAt}`
  const signature = signAuthPayload(payload, settings.secret)
  return `${payload}.${signature}`
}

function verifyControlSessionToken(token) {
  const settings = getAuthSettings()
  if (!token || !settings.secret) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [encodedUser, expiresRaw, providedSignature] = parts
  const payload = `${encodedUser}.${expiresRaw}`
  const expectedSignature = signAuthPayload(payload, settings.secret)
  const providedBuffer = Buffer.from(providedSignature, 'utf8')
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8')

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null
  }

  const expiresAt = Number(expiresRaw)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null

  try {
    const username = Buffer.from(encodedUser, 'base64url').toString('utf8')
    if (!username) return null
    return { username, expiresAt }
  } catch {
    return null
  }
}

function parseCookies(req) {
  const raw = req.headers.cookie || ''
  return raw.split(';').reduce((acc, part) => {
    const trimmed = part.trim()
    if (!trimmed) return acc
    const idx = trimmed.indexOf('=')
    if (idx < 0) return acc
    const key = trimmed.slice(0, idx)
    const value = trimmed.slice(idx + 1)
    acc[key] = decodeURIComponent(value)
    return acc
  }, {})
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req)
  return verifyControlSessionToken(cookies[CONTROL_AUTH_COOKIE])
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function setSessionCookie(res, token) {
  const secure = dev ? '' : '; Secure'
  res.setHeader(
    'Set-Cookie',
    `${CONTROL_AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${CONTROL_AUTH_TTL_SECONDS}${secure}`
  )
}

function clearSessionCookie(res) {
  const secure = dev ? '' : '; Secure'
  res.setHeader(
    'Set-Cookie',
    `${CONTROL_AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`
  )
}

function requireControlAuth(req, res) {
  const settings = getAuthSettings()
  if (!settings.configured) {
    sendJson(res, 503, { error: CONTROL_AUTH_MESSAGE })
    return null
  }

  const session = getSessionFromRequest(req)
  if (!session) {
    sendJson(res, 401, { error: 'Unauthorized' })
    return null
  }

  return session
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk.toString() })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

// ── Bible DB ──────────────────────────────────────────────────
let bibleDb = null
try {
  const Database = require('better-sqlite3')
  const dbPath   = path.join(__dirname, 'bible.db')
  if (fs.existsSync(dbPath)) {
    bibleDb = new Database(dbPath, { readonly: true })
    console.log('📖  Bible DB loaded')
  } else {
    console.log('ℹ️   No bible.db — Bible will use bolls.life. Run: node scripts/seed-bible.js to go offline.')
  }
} catch (e) {
  console.warn('⚠  Bible DB not available:', e.message)
}

// ── State persistence ─────────────────────────────────────────
const STATE_FILE = path.join(__dirname, 'server-state.json')
let lastTimerState   = null
let lastPresentState = null

try {
  const saved      = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  lastTimerState   = saved.timer   ?? null
  lastPresentState = saved.present ?? null
  console.log('💾  Restored server state from disk')
} catch { /* first run */ }

function persistState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ timer: lastTimerState, present: lastPresentState }))
  } catch (e) {
    console.warn('[Server] Could not persist state:', e.message)
  }
}

// ── Timer logging DB ─────────────────────────────────────────
const TIMER_DB_FILE = path.join(__dirname, 'timer.db')
let timerDb = null
try {
  const Database = require('better-sqlite3')
  timerDb = new Database(TIMER_DB_FILE)
  timerDb.prepare(`
    CREATE TABLE IF NOT EXISTS timer_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT NOT NULL,
      planned_seconds INTEGER NOT NULL,
      actual_seconds INTEGER NOT NULL,
      overtime_seconds INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      user TEXT,
      notes TEXT
    )
  `).run()
  timerDb.prepare('CREATE INDEX IF NOT EXISTS idx_timer_logs_created_at ON timer_logs(created_at)').run()
  timerDb.prepare(`
    CREATE TABLE IF NOT EXISTS operator_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note TEXT NOT NULL,
      source TEXT,
      created_at INTEGER NOT NULL
    )
  `).run()
  timerDb.prepare('CREATE INDEX IF NOT EXISTS idx_operator_notes_created_at ON operator_notes(created_at)').run()
  console.log('⏱  Timer log DB ready')
} catch (e) {
  timerDb = null
  console.warn('⚠  Timer log DB not available:', e.message)
}

app.prepare().then(() => {

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)

    if (parsedUrl.pathname === '/api/auth/session' && req.method === 'GET') {
      const settings = getAuthSettings()
      const session = settings.configured ? getSessionFromRequest(req) : null
      return sendJson(res, 200, {
        configured: settings.configured,
        authenticated: Boolean(session),
        username: session?.username ?? null,
      })
    }

    if (parsedUrl.pathname === '/api/auth/login' && req.method === 'POST') {
      const settings = getAuthSettings()
      if (!settings.configured) {
        return sendJson(res, 503, { error: CONTROL_AUTH_MESSAGE })
      }

      readRequestBody(req)
        .then(raw => {
          try {
            const data = JSON.parse(raw || '{}')
            const { username, password } = data

            if (username !== settings.username || password !== settings.password) {
              return sendJson(res, 401, { error: 'Invalid username or password.' })
            }

            setSessionCookie(res, createControlSessionToken(username))
            return sendJson(res, 200, { success: true, username })
          } catch {
            return sendJson(res, 400, { error: 'Invalid JSON' })
          }
        })
        .catch(() => sendJson(res, 500, { error: 'Unable to read request body' }))
      return
    }

    if (parsedUrl.pathname === '/api/auth/logout' && req.method === 'POST') {
      clearSessionCookie(res)
      return sendJson(res, 200, { success: true })
    }

    // ── GET /api/time — clock sync endpoint ──────────────────
    if (parsedUrl.pathname === '/api/time') {
      return sendJson(res, 200, { serverTime: Date.now() })
    }

    // ── GET /api/timer — retrieve timer state ────────────────
    if (parsedUrl.pathname === '/api/timer' && req.method === 'GET') {
      if (!requireControlAuth(req, res)) return
      return sendJson(res, 200, { state: lastTimerState })
    }

    // ── POST /api/timer — save timer state ───────────────────
    if (parsedUrl.pathname === '/api/timer' && req.method === 'POST') {
      if (!requireControlAuth(req, res)) return
      res.setHeader('Content-Type', 'application/json')
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const data = JSON.parse(body)
          lastTimerState = data.state || null
          persistState()
          res.end(JSON.stringify({ success: true }))
        } catch (e) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Invalid JSON' }))
        }
      })
      return
    }

    // ── GET /api/present — retrieve present state ────────────
    if (parsedUrl.pathname === '/api/present' && req.method === 'GET') {
      if (!requireControlAuth(req, res)) return
      return sendJson(res, 200, { state: lastPresentState })
    }

    // ── POST /api/present — save present state ───────────────
    if (parsedUrl.pathname === '/api/present' && req.method === 'POST') {
      if (!requireControlAuth(req, res)) return
      res.setHeader('Content-Type', 'application/json')
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const data = JSON.parse(body)
          lastPresentState = data.state || null
          persistState()
          res.end(JSON.stringify({ success: true }))
        } catch (e) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Invalid JSON' }))
        }
      })
      return
    }

    // ── POST /api/timer/log — record completed service timer with overtime ─────────────────
    if (parsedUrl.pathname === '/api/timer/log' && req.method === 'POST') {
      if (!requireControlAuth(req, res)) return
      res.setHeader('Content-Type', 'application/json')
      if (!timerDb) {
        res.statusCode = 503
        return res.end(JSON.stringify({ error: 'Timer DB not available' }))
      }
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const data = JSON.parse(body)
          const { service, plannedSeconds, actualSeconds, overtimeSeconds, startedAt, endedAt, user = null, notes = null } = data
          if (!service || typeof plannedSeconds !== 'number' || typeof actualSeconds !== 'number' || typeof overtimeSeconds !== 'number' || typeof startedAt !== 'number' || typeof endedAt !== 'number') {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'Missing or invalid fields' }))
          }
          const stmt = timerDb.prepare(`INSERT INTO timer_logs (service, planned_seconds, actual_seconds, overtime_seconds, started_at, ended_at, created_at, user, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          const result = stmt.run(service, plannedSeconds, actualSeconds, overtimeSeconds, startedAt, endedAt, Date.now(), user, notes)
          res.end(JSON.stringify({ success: true, id: result.lastInsertRowid }))
        } catch (e) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Invalid JSON' }))
        }
      })
      return
    }

    // ── GET /api/timer/logs?from=<ms>&to=<ms> — fetch raw records ─────────────────
    if (parsedUrl.pathname === '/api/timer/logs' && req.method === 'GET') {
      if (!requireControlAuth(req, res)) return
      res.setHeader('Content-Type', 'application/json')
      if (!timerDb) {
        res.statusCode = 503
        return res.end(JSON.stringify({ error: 'Timer DB not available' }))
      }
      const q = parsedUrl.query
      const from = q.from ? Number(q.from) : 0
      const to = q.to ? Number(q.to) : Date.now()
      const rows = timerDb.prepare('SELECT * FROM timer_logs WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC').all(from, to)
      return res.end(JSON.stringify({ logs: rows }))
    }

    // ── GET /api/timer/report?year=YYYY&month=MM — monthly overtime report ────────────
    if (parsedUrl.pathname === '/api/timer/report' && req.method === 'GET') {
      if (!requireControlAuth(req, res)) return
      res.setHeader('Content-Type', 'application/json')
      if (!timerDb) {
        res.statusCode = 503
        return res.end(JSON.stringify({ error: 'Timer DB not available' }))
      }
      const year = Number(parsedUrl.query.year) || new Date().getFullYear()
      const month = Number(parsedUrl.query.month) || (new Date().getMonth() + 1)
      if (month < 1 || month > 12) {
        res.statusCode = 400
        return res.end(JSON.stringify({ error: 'Invalid month' }))
      }
      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).getTime()
      const end = new Date(Date.UTC(year, month, 1, 0, 0, 0)).getTime() - 1
      const rows = timerDb.prepare(`
        SELECT service,
          COUNT(*) AS sessions,
          SUM(planned_seconds) AS total_planned_seconds,
          SUM(actual_seconds) AS total_actual_seconds,
          SUM(overtime_seconds) AS total_overtime_seconds
        FROM timer_logs
        WHERE created_at BETWEEN ? AND ?
        GROUP BY service
        ORDER BY total_overtime_seconds DESC
      `).all(start, end)
      const report = rows.map(r => ({
        ...r,
        average_overtime_seconds: r.sessions > 0 ? Math.round(r.total_overtime_seconds / r.sessions) : 0,
      }))
      return res.end(JSON.stringify({ year, month, from: start, to: end, report }))
    }

    // ── POST /api/operator-note — save operator note record ─────────────────
    if (parsedUrl.pathname === '/api/operator-note' && req.method === 'POST') {
      if (!requireControlAuth(req, res)) return
      res.setHeader('Content-Type', 'application/json')
      if (!timerDb) {
        res.statusCode = 503
        return res.end(JSON.stringify({ error: 'Timer DB not available' }))
      }
      let body = ''
      req.on('data', chunk => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const data = JSON.parse(body)
          const { note, source = null } = data
          if (!note || typeof note !== 'string') {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'Missing or invalid note' }))
          }
          const stmt = timerDb.prepare('INSERT INTO operator_notes (note, source, created_at) VALUES (?, ?, ?)')
          const result = stmt.run(note, source, Date.now())
          res.end(JSON.stringify({ success: true, id: result.lastInsertRowid }))
        } catch (e) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Invalid JSON' }))
        }
      })
      return
    }

    // ── GET /api/operator-notes?from=<ms>&to=<ms> — fetch operator notes ─────────
    if (parsedUrl.pathname === '/api/operator-notes' && req.method === 'GET') {
      if (!requireControlAuth(req, res)) return
      res.setHeader('Content-Type', 'application/json')
      if (!timerDb) {
        res.statusCode = 503
        return res.end(JSON.stringify({ error: 'Timer DB not available' }))
      }
      const q = parsedUrl.query
      const from = q.from ? Number(q.from) : 0
      const to = q.to ? Number(q.to) : Date.now()
      const rows = timerDb.prepare('SELECT * FROM operator_notes WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC').all(from, to)
      return res.end(JSON.stringify({ notes: rows }))
    }

    // ── Bible API ─────────────────────────────────────────────
    if (parsedUrl.pathname.startsWith('/api/bible/')) {
      if (!requireControlAuth(req, res)) return
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')

      if (!bibleDb) {
        res.statusCode = 503
        return res.end(JSON.stringify({ error: 'Bible DB not seeded. Run: node scripts/seed-bible.js' }))
      }

      const parts = parsedUrl.pathname.replace('/api/bible/', '').split('/')

      if (parts[0] === 'translations' && parts.length === 1) {
        const rows = bibleDb.prepare('SELECT id, name, language FROM translations ORDER BY id').all()
        return res.end(JSON.stringify(rows))
      }

      if (parts[0] === 'books' && parts[1]) {
        const rows = bibleDb.prepare(
          'SELECT book_id as bookid, name, chapters FROM books WHERE translation=? ORDER BY book_id'
        ).all(parts[1])
        return res.end(JSON.stringify(rows))
      }

      if (parts[0] === 'text' && parts[1] && parts[2] && parts[3]) {
        const rows = bibleDb.prepare(
          'SELECT verse, text FROM verses WHERE translation=? AND book_id=? AND chapter=? ORDER BY verse'
        ).all(parts[1], parseInt(parts[2], 10), parseInt(parts[3], 10))
        return res.end(JSON.stringify(rows))
      }

      res.statusCode = 404
      return res.end(JSON.stringify({ error: 'Not found' }))
    }

    handle(req, res, parsedUrl)
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`\n✅  Server ready`)
    console.log(`    Local:   http://localhost:${port}`)
    console.log(`    Network: http://<your-local-ip>:${port}\n`)
  })
})
