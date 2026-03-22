import type { Activity, TimerState, TimerColor } from '@/types'

export const TIMER_STORAGE_KEY  = 'elim_timer_state'
export const TIMER_CHANNEL_NAME = 'elim_timer_channel'

// Aliases for backward compatibility
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

// ── Throttle Pusher calls so we don't flood the API every second ──
let _timerThrottleTimer: ReturnType<typeof setTimeout> | null = null
let _pendingTimerState: TimerState | null = null

export function saveAndBroadcast(state: TimerState): void {
  if (typeof window === 'undefined') return

  // Always save locally
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state))

  // Same-browser tab sync (instant)
  try {
    const bc = new BroadcastChannel(TIMER_CHANNEL_NAME)
    bc.postMessage({ type: 'TIMER_UPDATE', state })
    bc.close()
  } catch { /* unavailable */ }

  // Cross-device sync via Pusher API — throttled to once per second
  // to avoid overwhelming Pusher with every countdown tick
  _pendingTimerState = state
  if (!_timerThrottleTimer) {
    _timerThrottleTimer = setTimeout(() => {
      if (_pendingTimerState) {
        pushToServer('TIMER_UPDATE', _pendingTimerState)
        _pendingTimerState = null
      }
      _timerThrottleTimer = null
    }, 1000)
  }
}

export async function pushToServer(type: string, state: unknown): Promise<void> {
  try {
    await fetch('/api/sync', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type, state }),
    })
  } catch (err) {
    console.warn('Pusher push failed (offline?):', err)
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