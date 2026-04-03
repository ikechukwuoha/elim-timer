process.on('uncaughtException',  (err)    => console.warn('[Server] Uncaught exception:', err.message))
process.on('unhandledRejection', (reason) => console.warn('[Server] Unhandled rejection:', reason))

const { createServer }    = require('http')
const { parse }           = require('url')
const next                = require('next')
const fs                  = require('fs')
const path                = require('path')
const crypto              = require('crypto')
const {
  getOpenAIScriptureAssistSettings,
  transcribeAudioChunkWithOpenAI,
  extractScriptureSuggestionsWithOpenAI,
} = require('./src/lib/openaiScriptureAssist')

const dev  = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const app  = next({ dev })
const handle = app.getRequestHandler()

const CONTROL_AUTH_COOKIE = 'elim_control_session'
const CONTROL_AUTH_TTL_SECONDS = 60 * 60 * 12
const CONTROL_AUTH_MESSAGE = 'Control authentication is not configured. Set ELIM_AUTH_USERNAME, ELIM_AUTH_PASSWORD, and ELIM_SESSION_SECRET in your environment.'

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
  const timerLogColumns = timerDb.prepare('PRAGMA table_info(timer_logs)').all()
  const ensureTimerLogColumn = (name, definition) => {
    if (!timerLogColumns.some(column => column.name === name)) {
      timerDb.prepare(`ALTER TABLE timer_logs ADD COLUMN ${name} ${definition}`).run()
    }
  }
  ensureTimerLogColumn('programme_seconds', 'INTEGER')
  ensureTimerLogColumn('additional_seconds', 'INTEGER DEFAULT 0')
  ensureTimerLogColumn('total_allotted_seconds', 'INTEGER')
  ensureTimerLogColumn('used_seconds', 'INTEGER')
  ensureTimerLogColumn('excess_seconds', 'INTEGER')
  ensureTimerLogColumn('unused_seconds', 'INTEGER DEFAULT 0')
  ensureTimerLogColumn('unfinished_seconds', 'INTEGER DEFAULT 0')
  ensureTimerLogColumn('exit_reason', 'TEXT')
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

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseDateInput(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

function formatDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getReportWindow(query) {
  const period = query.period === 'weekly' ? 'weekly' : 'monthly'

  if (period === 'weekly') {
    const weekStartDate = parseDateInput(query.weekStart) || (() => {
      const today = new Date()
      const offset = (today.getDay() + 6) % 7
      today.setDate(today.getDate() - offset)
      today.setHours(0, 0, 0, 0)
      return today
    })()
    const start = weekStartDate.getTime()
    const endDate = new Date(weekStartDate)
    endDate.setDate(endDate.getDate() + 7)
    const end = endDate.getTime() - 1

    return {
      period,
      label: `Week of ${weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      from: start,
      to: end,
      weekStart: formatDateInputValue(weekStartDate),
      year: weekStartDate.getFullYear(),
      month: weekStartDate.getMonth() + 1,
    }
  }

  const today = new Date()
  const year = toFiniteNumber(query.year, today.getFullYear())
  const month = toFiniteNumber(query.month, today.getMonth() + 1)
  if (month < 1 || month > 12) {
    throw new Error('Invalid month')
  }

  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const endDate = new Date(year, month, 1, 0, 0, 0, 0)

  return {
    period,
    label: startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    from: startDate.getTime(),
    to: endDate.getTime() - 1,
    year,
    month,
    weekStart: null,
  }
}

function buildTimerReport(from, to) {
  const sessions = timerDb.prepare(`
    SELECT
      id,
      service,
      COALESCE(programme_seconds, planned_seconds, 0) AS programme_seconds,
      COALESCE(additional_seconds, 0) AS additional_seconds,
      COALESCE(total_allotted_seconds, planned_seconds, 0) AS total_allotted_seconds,
      COALESCE(used_seconds, actual_seconds, 0) AS used_seconds,
      COALESCE(excess_seconds, overtime_seconds, 0) AS excess_seconds,
      COALESCE(unused_seconds, 0) AS unused_seconds,
      COALESCE(unfinished_seconds, 0) AS unfinished_seconds,
      started_at,
      ended_at,
      created_at,
      COALESCE(exit_reason, '') AS exit_reason,
      user,
      notes
    FROM timer_logs
    WHERE created_at BETWEEN ? AND ?
    ORDER BY created_at DESC, id DESC
  `).all(from, to).map(row => ({
    id: toFiniteNumber(row.id),
    service: row.service,
    programme_seconds: toFiniteNumber(row.programme_seconds),
    additional_seconds: toFiniteNumber(row.additional_seconds),
    total_allotted_seconds: toFiniteNumber(row.total_allotted_seconds),
    used_seconds: toFiniteNumber(row.used_seconds),
    excess_seconds: toFiniteNumber(row.excess_seconds),
    unused_seconds: toFiniteNumber(row.unused_seconds),
    unfinished_seconds: toFiniteNumber(row.unfinished_seconds),
    started_at: toFiniteNumber(row.started_at),
    ended_at: toFiniteNumber(row.ended_at),
    created_at: toFiniteNumber(row.created_at),
    exit_reason: row.exit_reason || '',
    user: row.user ?? null,
    notes: row.notes ?? null,
  }))

  const rowMap = new Map()
  sessions.forEach(session => {
    const current = rowMap.get(session.service) || {
      service: session.service,
      sessions: 0,
      total_programme_seconds: 0,
      total_additional_seconds: 0,
      total_allotted_seconds: 0,
      total_used_seconds: 0,
      total_excess_seconds: 0,
      total_unused_seconds: 0,
      total_unfinished_seconds: 0,
    }

    current.sessions += 1
    current.total_programme_seconds += session.programme_seconds
    current.total_additional_seconds += session.additional_seconds
    current.total_allotted_seconds += session.total_allotted_seconds
    current.total_used_seconds += session.used_seconds
    current.total_excess_seconds += session.excess_seconds
    current.total_unused_seconds += session.unused_seconds
    current.total_unfinished_seconds += session.unfinished_seconds
    rowMap.set(session.service, current)
  })

  const rows = Array.from(rowMap.values()).sort((a, b) => {
    if (b.total_excess_seconds !== a.total_excess_seconds) return b.total_excess_seconds - a.total_excess_seconds
    if (b.total_used_seconds !== a.total_used_seconds) return b.total_used_seconds - a.total_used_seconds
    return a.service.localeCompare(b.service)
  })

  const summary = sessions.reduce((acc, session) => {
    acc.sessions += 1
    acc.total_programme_seconds += session.programme_seconds
    acc.total_additional_seconds += session.additional_seconds
    acc.total_allotted_seconds += session.total_allotted_seconds
    acc.total_used_seconds += session.used_seconds
    acc.total_excess_seconds += session.excess_seconds
    acc.total_unused_seconds += session.unused_seconds
    acc.total_unfinished_seconds += session.unfinished_seconds
    if (session.excess_seconds > 0) acc.overtime_sessions += 1
    if (session.additional_seconds > 0) acc.additional_time_sessions += 1
    if (session.unused_seconds > 0) acc.early_finish_sessions += 1
    if (session.unfinished_seconds > 0) acc.interrupted_sessions += 1
    if (session.used_seconds > acc.longest_session_seconds) acc.longest_session_seconds = session.used_seconds
    if (session.excess_seconds > acc.longest_excess_seconds) acc.longest_excess_seconds = session.excess_seconds
    return acc
  }, {
    sessions: 0,
    total_programme_seconds: 0,
    total_additional_seconds: 0,
    total_allotted_seconds: 0,
    total_used_seconds: 0,
    total_excess_seconds: 0,
    total_unused_seconds: 0,
    total_unfinished_seconds: 0,
    overtime_sessions: 0,
    additional_time_sessions: 0,
    early_finish_sessions: 0,
    interrupted_sessions: 0,
    average_used_seconds: 0,
    average_excess_seconds: 0,
    longest_session_seconds: 0,
    longest_excess_seconds: 0,
  })

  summary.average_used_seconds = summary.sessions > 0 ? summary.total_used_seconds / summary.sessions : 0
  summary.average_excess_seconds = summary.overtime_sessions > 0 ? summary.total_excess_seconds / summary.overtime_sessions : 0

  return { rows, summary, sessions }
}

function formatDurationShort(seconds) {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0) return `${hours}h${String(minutes).padStart(2, '0')}m`
  if (minutes > 0) return `${minutes}m${String(secs).padStart(2, '0')}s`
  return `${secs}s`
}

function fitColumn(value, width) {
  const text = String(value ?? '')
  if (text.length <= width) return text.padEnd(width, ' ')
  if (width <= 3) return text.slice(0, width)
  return `${text.slice(0, width - 3)}...`
}

function escapePdfText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ')
}

function buildPdfBuffer(lines) {
  const pageWidth = 792
  const pageHeight = 612
  const top = 570
  const bottom = 36
  const left = 36
  const pages = [[]]
  let currentPage = pages[0]
  let y = top

  for (const line of lines) {
    const size = line.size || 10
    const gap = line.gap || (size + 4)
    if (y - gap < bottom) {
      currentPage = []
      pages.push(currentPage)
      y = top
    }
    currentPage.push({ ...line, y })
    y -= gap
  }

  let nextObjectId = 1
  const fontRegularId = nextObjectId++
  const fontBoldId = nextObjectId++
  const contentIds = pages.map(() => nextObjectId++)
  const pageIds = pages.map(() => nextObjectId++)
  const pagesId = nextObjectId++
  const catalogId = nextObjectId++
  const objects = new Map()

  objects.set(fontRegularId, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>')
  objects.set(fontBoldId, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>')

  pages.forEach((page, index) => {
    const commands = page.map(line => (
      `BT\n/${line.bold ? 'F2' : 'F1'} ${line.size || 10} Tf\n${left} ${line.y} Td\n(${escapePdfText(line.text)}) Tj\nET`
    )).join('\n')

    objects.set(
      contentIds[index],
      `<< /Length ${Buffer.byteLength(commands, 'utf8')} >>\nstream\n${commands}\nendstream`
    )

    objects.set(
      pageIds[index],
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`
    )
  })

  objects.set(
    pagesId,
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`
  )
  objects.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`)

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  for (let id = 1; id <= catalogId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, 'utf8')
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${catalogId + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let id = 1; id <= catalogId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${catalogId + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return Buffer.from(pdf, 'utf8')
}

function buildTimerReportPdf(reportPayload) {
  const lines = [
    { text: 'ELIM TIMER REPORT', size: 18, bold: true, gap: 26 },
    { text: `${reportPayload.label} (${reportPayload.period.toUpperCase()})`, size: 11, bold: true, gap: 20 },
    { text: `Generated: ${new Date(reportPayload.generatedAt).toLocaleString('en-US')}`, size: 10 },
    { text: `Window: ${new Date(reportPayload.from).toLocaleDateString('en-US')} - ${new Date(reportPayload.to).toLocaleDateString('en-US')}`, size: 10, gap: 18 },
    { text: `Sessions: ${reportPayload.summary.sessions}`, size: 10, bold: true },
    { text: `Main Time: ${formatDurationShort(reportPayload.summary.total_programme_seconds)}   Additional: ${formatDurationShort(reportPayload.summary.total_additional_seconds)}   Allotted: ${formatDurationShort(reportPayload.summary.total_allotted_seconds)}`, size: 10 },
    { text: `Used: ${formatDurationShort(reportPayload.summary.total_used_seconds)}   Overtime: ${formatDurationShort(reportPayload.summary.total_excess_seconds)}   Unused: ${formatDurationShort(reportPayload.summary.total_unused_seconds)}   Unfinished: ${formatDurationShort(reportPayload.summary.total_unfinished_seconds)}`, size: 10 },
    { text: `OT Sessions: ${reportPayload.summary.overtime_sessions}   Addl Sessions: ${reportPayload.summary.additional_time_sessions}   Early Finish: ${reportPayload.summary.early_finish_sessions}   Interrupted: ${reportPayload.summary.interrupted_sessions}`, size: 10 },
    { text: `Avg Used: ${formatDurationShort(reportPayload.summary.average_used_seconds)}   Avg OT: ${formatDurationShort(reportPayload.summary.average_excess_seconds)}   Longest Run: ${formatDurationShort(reportPayload.summary.longest_session_seconds)}   Longest OT: ${formatDurationShort(reportPayload.summary.longest_excess_seconds)}`, size: 10, gap: 18 },
    { text: 'PROGRAMME SUMMARY', size: 11, bold: true, gap: 18 },
    { text: `${fitColumn('PROGRAMME', 24)} ${fitColumn('SES', 4)} ${fitColumn('MAIN', 8)} ${fitColumn('ADD', 8)} ${fitColumn('TOTAL', 8)} ${fitColumn('USED', 8)} ${fitColumn('OT', 8)} ${fitColumn('UNUSED', 8)} ${fitColumn('UNFIN', 8)}`, size: 9, bold: true, gap: 16 },
  ]

  if (reportPayload.report.length === 0) {
    lines.push({ text: 'No programme activity was logged for this report window.', size: 10 })
  } else {
    reportPayload.report.forEach(row => {
      lines.push({
        text: `${fitColumn(row.service, 24)} ${fitColumn(row.sessions, 4)} ${fitColumn(formatDurationShort(row.total_programme_seconds), 8)} ${fitColumn(formatDurationShort(row.total_additional_seconds), 8)} ${fitColumn(formatDurationShort(row.total_allotted_seconds), 8)} ${fitColumn(formatDurationShort(row.total_used_seconds), 8)} ${fitColumn(formatDurationShort(row.total_excess_seconds), 8)} ${fitColumn(formatDurationShort(row.total_unused_seconds), 8)} ${fitColumn(formatDurationShort(row.total_unfinished_seconds), 8)}`,
        size: 9,
      })
    })
  }

  lines.push({ text: '', size: 6, gap: 10 })
  lines.push({ text: 'SESSION DETAILS', size: 11, bold: true, gap: 18 })

  if (!Array.isArray(reportPayload.sessions) || reportPayload.sessions.length === 0) {
    lines.push({ text: 'No detailed timer sessions were logged for this report window.', size: 10 })
  } else {
    reportPayload.sessions.forEach((session, index) => {
      lines.push({
        text: `${index + 1}. ${session.service}  |  ${new Date(session.started_at).toLocaleString('en-US')}  ->  ${new Date(session.ended_at).toLocaleString('en-US')}`,
        size: 9,
        bold: true,
      })
      lines.push({
        text: `Main ${formatDurationShort(session.programme_seconds)}   Add ${formatDurationShort(session.additional_seconds)}   Total ${formatDurationShort(session.total_allotted_seconds)}   Used ${formatDurationShort(session.used_seconds)}   OT ${formatDurationShort(session.excess_seconds)}`,
        size: 9,
      })
      lines.push({
        text: `Unused ${formatDurationShort(session.unused_seconds)}   Unfinished ${formatDurationShort(session.unfinished_seconds)}   Exit ${session.exit_reason || '—'}   User ${session.user || '—'}`,
        size: 9,
      })
      if (session.notes) {
        lines.push({
          text: `Notes: ${session.notes}`,
          size: 9,
        })
      }
      lines.push({ text: '', size: 6, gap: 8 })
    })
  }

  return buildPdfBuffer(lines)
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

    if (parsedUrl.pathname === '/api/scripture-assist/status' && req.method === 'GET') {
      if (!requireControlAuth(req, res)) return
      const settings = getOpenAIScriptureAssistSettings()
      return sendJson(res, 200, {
        configured: settings.configured,
        transcribeModel: settings.transcribeModel,
        extractionModel: settings.extractionModel,
      })
    }

    if (parsedUrl.pathname === '/api/scripture-assist/transcribe' && req.method === 'POST') {
      if (!requireControlAuth(req, res)) return

      const settings = getOpenAIScriptureAssistSettings()
      if (!settings.configured) {
        return sendJson(res, 503, {
          error: 'OpenAI transcription is not configured yet. Add OPENAI_API_KEY to your environment.',
        })
      }

      readRequestBody(req)
        .then(async raw => {
          let data
          try {
            data = JSON.parse(raw || '{}')
          } catch {
            return sendJson(res, 400, { error: 'Invalid JSON' })
          }

          const audioBase64 = typeof data.audioBase64 === 'string' ? data.audioBase64.trim() : ''
          const mimeType = typeof data.mimeType === 'string' ? data.mimeType.trim() : 'audio/webm'
          const recentTranscript = typeof data.recentTranscript === 'string' ? data.recentTranscript : ''
          const skipExtraction = data.skipExtraction === true

          if (!audioBase64) {
            return sendJson(res, 400, { error: 'Missing audio payload.' })
          }

          let audioBuffer
          try {
            audioBuffer = Buffer.from(audioBase64, 'base64')
          } catch {
            return sendJson(res, 400, { error: 'Invalid audio payload.' })
          }

          if (!audioBuffer.length) {
            return sendJson(res, 400, { error: 'Audio payload was empty.' })
          }

          if (audioBuffer.length > 10 * 1024 * 1024) {
            return sendJson(res, 413, { error: 'Audio chunk is too large. Please keep microphone chunks short.' })
          }

          try {
            const text = await transcribeAudioChunkWithOpenAI({ audioBuffer, mimeType, recentTranscript })
            const suggestions = text && !skipExtraction
              ? await extractScriptureSuggestionsWithOpenAI({
                  latestTranscript: text,
                  recentTranscript,
                })
              : []

            return sendJson(res, 200, {
              text,
              suggestions,
              transcribeModel: settings.transcribeModel,
              extractionModel: settings.extractionModel,
              extractionSkipped: skipExtraction,
            })
          } catch (error) {
            const detail = error instanceof Error ? error.message : 'OpenAI could not process the audio chunk.'
            const normalized = detail.toLowerCase()
            const friendlyError = normalized.includes('corrupted') || normalized.includes('unsupported')
              ? 'This browser recorded an audio chunk OpenAI could not decode. Please try Chrome or Edge, then restart the microphone.'
              : detail
            return sendJson(res, 502, {
              error: friendlyError,
            })
          }
        })
        .catch(() => sendJson(res, 500, { error: 'Unable to read request body' }))
      return
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

    // ── POST /api/timer/log — record programme timing metrics ─────────────────
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
          const service = data.service
          const programmeSeconds = toFiniteNumber(data.programmeSeconds, toFiniteNumber(data.plannedSeconds))
          const additionalSeconds = toFiniteNumber(data.additionalSeconds)
          const totalAllottedSeconds = toFiniteNumber(data.totalAllottedSeconds, programmeSeconds + additionalSeconds)
          const usedSeconds = toFiniteNumber(data.usedSeconds, toFiniteNumber(data.actualSeconds))
          const excessSeconds = toFiniteNumber(data.excessSeconds, toFiniteNumber(data.overtimeSeconds))
          const unusedSeconds = toFiniteNumber(data.unusedSeconds)
          const unfinishedSeconds = toFiniteNumber(data.unfinishedSeconds)
          const startedAt = toFiniteNumber(data.startedAt, NaN)
          const endedAt = toFiniteNumber(data.endedAt, NaN)
          const exitReason = typeof data.exitReason === 'string' ? data.exitReason : null
          const user = typeof data.user === 'string' ? data.user : null
          const notes = typeof data.notes === 'string' ? data.notes : null

          if (
            !service ||
            !Number.isFinite(startedAt) ||
            !Number.isFinite(endedAt)
          ) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'Missing or invalid fields' }))
          }

          const stmt = timerDb.prepare(`
            INSERT INTO timer_logs (
              service,
              planned_seconds,
              actual_seconds,
              overtime_seconds,
              programme_seconds,
              additional_seconds,
              total_allotted_seconds,
              used_seconds,
              excess_seconds,
              unused_seconds,
              unfinished_seconds,
              started_at,
              ended_at,
              created_at,
              exit_reason,
              user,
              notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          const result = stmt.run(
            service,
            programmeSeconds,
            usedSeconds,
            excessSeconds,
            programmeSeconds,
            additionalSeconds,
            totalAllottedSeconds,
            usedSeconds,
            excessSeconds,
            unusedSeconds,
            unfinishedSeconds,
            startedAt,
            endedAt,
            Date.now(),
            exitReason,
            user,
            notes
          )
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

    // ── GET /api/timer/report — weekly/monthly timing report JSON or PDF ────────────
    if (parsedUrl.pathname === '/api/timer/report' && req.method === 'GET') {
      if (!requireControlAuth(req, res)) return
      if (!timerDb) {
        res.statusCode = 503
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ error: 'Timer DB not available' }))
      }
      try {
        const window = getReportWindow(parsedUrl.query)
        const { rows, summary, sessions } = buildTimerReport(window.from, window.to)
        const payload = {
          period: window.period,
          label: window.label,
          from: window.from,
          to: window.to,
          year: window.year,
          month: window.month,
          weekStart: window.weekStart,
          generatedAt: Date.now(),
          summary,
          report: rows,
          sessions,
        }

        if (parsedUrl.query.format === 'pdf') {
          const pdf = buildTimerReportPdf(payload)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Disposition', `attachment; filename="elim-${window.period}-report-${window.period === 'weekly' ? window.weekStart : `${window.year}-${String(window.month).padStart(2, '0')}`}.pdf"`)
          return res.end(pdf)
        }

        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify(payload))
      } catch (error) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid report request' }))
      }
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
