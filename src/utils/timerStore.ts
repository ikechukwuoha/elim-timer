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
}

export function loadState(): TimerState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TimerState) : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

// ── What we track to detect meaningful changes ────────────────
let _prev: { running: boolean; index: number; remaining: number; activitiesHash: string } | null = null
let _driftTimer: ReturnType<typeof setTimeout> | null = null

function hashActivities(a: Activity[]): string {
  return a.map(x => `${x.id}:${x.name}:${x.duration}`).join('|')
}

function buildPayload(state: TimerState, includeActivities: boolean) {
  return {
    currentIndex:    state.currentIndex,
    running:         state.running,
    remaining:       state.remaining,
    overtime:        state.overtime,
    overtimeSeconds: state.overtimeSeconds,
    syncedAt:        Date.now(), // timestamp for smooth interpolation on big screen
    ...(includeActivities ? { activities: state.activities } : {}),
  }
}

export function saveAndBroadcast(state: TimerState): void {
  if (typeof window === 'undefined') return

  // Always save to localStorage
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state))

  // Same-device tab sync — always full state, instant
  try {
    const bc = new BroadcastChannel(TIMER_CHANNEL_NAME)
    bc.postMessage({ type: 'TIMER_UPDATE', state })
    bc.close()
  } catch { /* unavailable */ }

  const activitiesHash = hashActivities(state.activities)
  const activitiesChanged = _prev ? activitiesHash !== _prev.activitiesHash : true
  const runningChanged    = _prev ? state.running !== _prev.running : true
  const indexChanged      = _prev ? state.currentIndex !== _prev.index : true

  // ── IMMEDIATE push on important events ───────────────────
  // Start, pause, next activity, reset, activity list change
  // These must arrive at the screen instantly — no throttle
  if (runningChanged || indexChanged || activitiesChanged) {
    _prev = { running: state.running, index: state.currentIndex, remaining: state.remaining, activitiesHash }
    // Cancel any pending drift correction — this supersedes it
    if (_driftTimer) { clearTimeout(_driftTimer); _driftTimer = null }
    pushToServer('TIMER_UPDATE', buildPayload(state, activitiesChanged))
    return
  }

  // ── SYNC every 2 seconds when running ────────────────────
  // Send timer state every 2 seconds to keep all viewers in real-time sync.
  // This ensures no lag between control panel and big screen displays.
  if (!_driftTimer) {
    _driftTimer = setTimeout(() => {
      _driftTimer = null
      if (_prev && state.running) {
        _prev.remaining = state.remaining
        pushToServer('TIMER_UPDATE', buildPayload(state, false))
      }
    }, 2000)
  }

  _prev = { ..._prev!, remaining: state.remaining }
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
  const abs = Math.abs(seconds)
  const m   = Math.floor(abs / 60)
  const s   = abs % 60
  const str = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return seconds < 0 ? `+${str}` : str
}

export function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000)
}