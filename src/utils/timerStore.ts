import type { Activity, TimerState, TimerColor } from '@/types'

export const TIMER_STORAGE_KEY  = 'elim_timer_state'
export const TIMER_CHANNEL_NAME = 'elim_timer_channel'
export const STORAGE_KEY  = TIMER_STORAGE_KEY
export const CHANNEL_NAME = TIMER_CHANNEL_NAME

export const DEFAULT_ACTIVITIES: Activity[] = [
  { id: 1, name: 'Opening Prayer',     duration: 5  },
  { id: 2, name: 'Praise & Worship',   duration: 20 },
  { id: 3, name: 'Choir Ministration', duration: 15 },
  { id: 4, name: 'Tithes & Offering',  duration: 10 },
  { id: 5, name: 'Announcements',      duration: 5  },
  { id: 6, name: 'Message / Sermon',   duration: 45 },
  { id: 7, name: 'Altar Call',         duration: 10 },
  { id: 8, name: 'Closing Prayer',     duration: 5  },
]

export const DEFAULT_STATE: TimerState = {
  activities:      DEFAULT_ACTIVITIES,
  currentIndex:    0,
  running:         false,
  remaining:       DEFAULT_ACTIVITIES[0].duration * 60,
  overtime:        false,
  overtimeSeconds: 0,
  // Epoch fields — the source of truth for remote screens
  startedAt:       null,   // ms epoch when timer last started/resumed
  remainingAtStart: null,  // how many seconds were on the clock at that moment
}

export function loadState(): TimerState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as TimerState
    // Merge with DEFAULT_STATE so missing fields never cause guard failures
    return {
      ...DEFAULT_STATE,
      ...parsed,
      activities: parsed.activities?.length ? parsed.activities : DEFAULT_ACTIVITIES,
    }
  } catch {
    return DEFAULT_STATE
  }
}

/**
 * Given a timer state that carries epoch fields, compute what `remaining`
 * should be RIGHT NOW on any device — no network round-trip needed.
 *
 * Call this on the big screen whenever you receive a Pusher event,
 * and then let the local tick take over.
 */
export function computeRemaining(state: TimerState): number {
  if (!state.running || state.startedAt == null || state.remainingAtStart == null) {
    return state.remaining
  }
  const elapsedSecs = (Date.now() - state.startedAt) / 1000
  return state.remainingAtStart - elapsedSecs
}

let _lastPushedRunning: boolean | null = null
let _lastPushedIndex:   number  | null = null
let _lastActivitiesHash: string | null = null
let _heartbeatTimer: ReturnType<typeof setTimeout> | null = null

function hashActivities(a: Activity[]): string {
  return a.map(x => `${x.id}:${x.name}:${x.duration}`).join('|')
}

/**
 * Builds the payload to send over Pusher.
 *
 * KEY DESIGN:
 * - When running:  send `startedAt` + `remainingAtStart` (epoch anchor).
 *                  Do NOT send a live `remaining` — it goes stale instantly.
 * - When paused:   send `remaining` directly (it's frozen, so it's safe).
 *
 * The big screen calls `computeRemaining()` on receipt to get exact time.
 */
function buildPayload(state: TimerState, includeActivities: boolean) {
  const base = {
    currentIndex:    state.currentIndex,
    running:         state.running,
    overtime:        state.overtime,
    overtimeSeconds: state.overtimeSeconds,
    ...(includeActivities ? { activities: state.activities } : {}),
  }

  if (state.running && state.startedAt != null && state.remainingAtStart != null) {
    return {
      ...base,
      // Epoch anchor — receiver recomputes exact remaining from this
      startedAt:        state.startedAt,
      remainingAtStart: state.remainingAtStart,
      remaining:        null,  // explicitly null so receiver doesn't use it
    }
  }

  return {
    ...base,
    remaining:        state.remaining,
    startedAt:        null,
    remainingAtStart: null,
  }
}

export function saveAndBroadcast(state: TimerState): void {
  if (typeof window === 'undefined') return

  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state))

  // Same-device BroadcastChannel — instant, full state
  try {
    const bc = new BroadcastChannel(TIMER_CHANNEL_NAME)
    bc.postMessage({ type: 'TIMER_UPDATE', state })
    bc.close()
  } catch { /* unavailable */ }

  const activitiesHash    = hashActivities(state.activities)
  const runningChanged    = state.running    !== _lastPushedRunning
  const indexChanged      = state.currentIndex !== _lastPushedIndex
  const activitiesChanged = activitiesHash  !== _lastActivitiesHash

  // ── Immediate push on important control events ────────────────────────────
  // start, pause, next, reset, activity list change — must arrive instantly
  if (runningChanged || indexChanged || activitiesChanged) {
    _lastPushedRunning    = state.running
    _lastPushedIndex      = state.currentIndex
    _lastActivitiesHash   = activitiesHash
    if (_heartbeatTimer) { clearTimeout(_heartbeatTimer); _heartbeatTimer = null }
    pushToServer('TIMER_UPDATE', buildPayload(state, activitiesChanged))
    return
  }

  // ── Heartbeat every 30s while running ────────────────────────────────────
  // Only needed as a late-joiner catch-up (e.g. someone opens the big screen
  // mid-session). The epoch anchor means any single message is enough for
  // the receiver to compute the exact current time — so 30s is fine.
  // This also dramatically reduces the flood of /sync requests you saw.
  if (state.running && !_heartbeatTimer) {
    _heartbeatTimer = setTimeout(() => {
      _heartbeatTimer = null
      pushToServer('TIMER_UPDATE', buildPayload(state, false))
    }, 30_000)
  }
}

export async function pushToServer(type: string, payload: unknown): Promise<void> {
  try {
    const body = JSON.stringify({ type, state: payload })
    if (body.length > 9000) {
      console.warn(`Pusher payload too large: ${body.length} bytes — skipping`)
      return
    }
    await fetch('/api/sync', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  } catch (err) {
    console.warn('Pusher push failed:', err)
  }
}

export function getTimerColor(remaining: number, totalSeconds: number): TimerColor {
  if (remaining <= 0) return 'red'
  const pct = remaining / totalSeconds
  if (pct > 0.4)  return 'green'
  if (pct > 0.15) return 'yellow'
  return 'red'
}

export function formatTime(seconds: number): string {
  const abs = Math.abs(Math.floor(seconds))
  const m   = Math.floor(abs / 60)
  const s   = abs % 60
  const str = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return seconds < 0 ? `+${str}` : str
}

export function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000)
}