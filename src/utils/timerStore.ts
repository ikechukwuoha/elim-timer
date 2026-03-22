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

// ── Slim timer payload — only what the screen needs to tick ──
// Activities list is large — screen already has it from localStorage
// We only push the frequently-changing fields
interface SlimTimerPayload {
  currentIndex:    number
  running:         boolean
  remaining:       number
  overtime:        boolean
  overtimeSeconds: number
  // Include activities only when they change (not every second)
  activities?:     Activity[]
}

let _lastActivitiesHash = ''
let _lastPushedRunning:   boolean | null = null
let _lastPushedIndex:     number  | null = null
let _lastPushedRemaining: number  | null = null

function hashActivities(activities: Activity[]): string {
  return activities.map(a => `${a.id}:${a.name}:${a.duration}`).join('|')
}

export function saveAndBroadcast(state: TimerState): void {
  if (typeof window === 'undefined') return

  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state))

  // Same-browser tab sync
  try {
    const bc = new BroadcastChannel(TIMER_CHANNEL_NAME)
    bc.postMessage({ type: 'TIMER_UPDATE', state })
    bc.close()
  } catch { /* unavailable */ }

  // Cross-device — only push when something meaningful changes
  const runningChanged = state.running      !== _lastPushedRunning
  const indexChanged   = state.currentIndex !== _lastPushedIndex
  // Correct drift if screen is more than 3 seconds off
  const drift = _lastPushedRemaining !== null
    ? Math.abs(state.remaining - (_lastPushedRemaining - 1)) > 3
    : true

  const activitiesHash    = hashActivities(state.activities)
  const activitiesChanged = activitiesHash !== _lastActivitiesHash

  const shouldPush = runningChanged || indexChanged || drift || activitiesChanged

  if (shouldPush) {
    _lastPushedRunning   = state.running
    _lastPushedIndex     = state.currentIndex
    _lastPushedRemaining = state.remaining
    _lastActivitiesHash  = activitiesHash

    const payload: SlimTimerPayload = {
      currentIndex:    state.currentIndex,
      running:         state.running,
      remaining:       state.remaining,
      overtime:        state.overtime,
      overtimeSeconds: state.overtimeSeconds,
    }

    // Only include activities when they actually changed
    if (activitiesChanged) {
      payload.activities = state.activities
    }

    pushToServer('TIMER_UPDATE', payload)
  }
}

export async function pushToServer(type: string, payload: unknown): Promise<void> {
  try {
    const body = JSON.stringify({ type, state: payload })
    // Sanity check — warn if still somehow large
    if (body.length > 9000) {
      console.warn(`Pusher payload too large: ${body.length} bytes`)
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