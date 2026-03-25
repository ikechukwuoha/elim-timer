import type { Activity, TimerState, TimerColor } from '@/types'

export const TIMER_STORAGE_KEY  = 'elim_timer_state'
export const TIMER_CHANNEL_NAME = 'elim_timer_channel'
export const STORAGE_KEY  = TIMER_STORAGE_KEY
export const CHANNEL_NAME = TIMER_CHANNEL_NAME

export const DEFAULT_STATE: TimerState = {
  activities:       [],
  currentIndex:     0,
  running:          false,
  remaining:        0,
  overtime:         false,
  overtimeSeconds:  0,
  startedAt:        null,
  remainingAtStart: null,
}

// ── Server clock offset ───────────────────────────────────────
// Positive = local clock is behind server; negative = ahead
let _serverOffsetMs = 0

export function setServerTimeOffset(offsetMs: number): void {
  _serverOffsetMs = offsetMs
}

export function getServerTimeOffset(): number {
  return _serverOffsetMs
}

/** Date.now() corrected to server time — use this for all timer anchors */
export function getSyncedNow(): number {
  return Date.now() + _serverOffsetMs
}

// ── Latest state ref (for heartbeat closure) ──────────────────
let _latestState: TimerState = DEFAULT_STATE

export function loadState(): TimerState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as TimerState
    const merged: TimerState = {
      ...DEFAULT_STATE,
      ...parsed,
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
    }
    _latestState = merged
    return merged
  } catch {
    return DEFAULT_STATE
  }
}

/** Compute exact remaining using server-corrected clock */
export function computeRemaining(state: TimerState): number {
  if (!state.running || state.startedAt == null || state.remainingAtStart == null) {
    return state.remaining
  }
  const elapsedSecs = (getSyncedNow() - state.startedAt) / 1000
  return state.remainingAtStart - elapsedSecs
}

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
      startedAt:        state.startedAt,
      remainingAtStart: state.remainingAtStart,
      remaining:        null,
    }
  }

  return {
    ...base,
    remaining:        state.remaining,
    startedAt:        null,
    remainingAtStart: null,
  }
}

function hashActivities(a: Activity[]): string {
  return a.map(x => `${x.id}:${x.name}:${x.duration}`).join('|')
}

function shouldLogSyncError(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false
  return true
}

function postTimerState(payload: ReturnType<typeof buildPayload>, label: string): void {
  fetch('/api/timer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: payload }),
    keepalive: true,
  }).catch(e => {
    if (shouldLogSyncError()) console.warn(label, e.message)
  })
}

// ── Heartbeat ─────────────────────────────────────────────────
const HEARTBEAT_MS = 30_000
let _heartbeatTimer: ReturnType<typeof setTimeout> | null = null

function clearHeartbeat() {
  if (_heartbeatTimer) {
    clearTimeout(_heartbeatTimer)
    _heartbeatTimer = null
  }
}

function scheduleHeartbeat() {
  clearHeartbeat()
  const beat = () => {
    // Always read _latestState — never captures stale closure value
    if (!_latestState.running) return
    // Send heartbeat to server via HTTP
    if (typeof window !== 'undefined') {
      postTimerState(buildPayload(_latestState, false), '[API] Heartbeat error:')
    }
    _heartbeatTimer = setTimeout(beat, HEARTBEAT_MS)
  }
  _heartbeatTimer = setTimeout(beat, HEARTBEAT_MS)
}

let _lastActivitiesHash: string | null = null

export function saveAndBroadcast(state: TimerState): void {
  if (typeof window === 'undefined') return

  // Keep latest state ref fresh for heartbeat
  _latestState = state

  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state))

  // Same-device tab sync
  try {
    const bc = new BroadcastChannel(TIMER_CHANNEL_NAME)
    bc.postMessage({ type: 'TIMER_UPDATE', state })
    bc.close()
  } catch { /* unavailable */ }

  const activitiesHash    = hashActivities(state.activities)
  const activitiesChanged = activitiesHash !== _lastActivitiesHash

  _lastActivitiesHash = activitiesHash

  // Always send immediately on any change via HTTP
  postTimerState(buildPayload(state, activitiesChanged), '[API] Save timer error:')

  // Manage heartbeat
  if (state.running) {
    scheduleHeartbeat()
  } else {
    clearHeartbeat()
  }
}

export function getTimerColor(remaining: number, totalSeconds: number): TimerColor {
  if (remaining <= 0) return 'red'
  const pct = remaining / totalSeconds
  if (pct > 0.2)  return 'green'
  if (pct > 0.1) return 'yellow'
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