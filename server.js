process.on('uncaughtException',  (err)    => console.warn('[Server] Uncaught exception:', err.message))
process.on('unhandledRejection', (reason) => console.warn('[Server] Unhandled rejection:', reason))

const { createServer }    = require('http')
const { parse }           = require('url')
const next                = require('next')
const fs                  = require('fs')
const path                = require('path')

const dev  = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const app  = next({ dev })
const handle = app.getRequestHandler()

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

    // ── GET /api/time — clock sync endpoint ──────────────────
    if (parsedUrl.pathname === '/api/time') {
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ serverTime: Date.now() }))
    }

    // ── GET /api/timer — retrieve timer state ────────────────
    if (parsedUrl.pathname === '/api/timer' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ state: lastTimerState }))
    }

    // ── POST /api/timer — save timer state ───────────────────
    if (parsedUrl.pathname === '/api/timer' && req.method === 'POST') {
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
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ state: lastPresentState }))
    }

    // ── POST /api/present — save present state ───────────────
    if (parsedUrl.pathname === '/api/present' && req.method === 'POST') {
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