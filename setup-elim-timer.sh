#!/bin/bash

# ============================================================
#  Elim Christian Garden International — Church Service Timer
#  Setup script for existing Next.js (src/app) project
# ============================================================

set -e

ROOT="$(pwd)"
APP="$ROOT/src/app"
SRC="$ROOT/src"

echo ""
echo "=============================================="
echo "  Elim Timer — File Setup Script"
echo "=============================================="
echo ""

# ── Verify we're in the right place ──────────────────────────
if [ ! -f "$ROOT/package.json" ]; then
  echo "❌  Error: package.json not found."
  echo "   Run this script from your Next.js project root."
  exit 1
fi

if [ ! -d "$APP" ]; then
  echo "❌  Error: src/app directory not found."
  echo "   This script expects a src/app structure."
  exit 1
fi

echo "✅  Found Next.js project at: $ROOT"
echo ""

# ── Create directories ────────────────────────────────────────
echo "📁  Creating directories..."
mkdir -p "$APP/screen"
mkdir -p "$SRC/types"
mkdir -p "$SRC/utils"
echo "    src/app/screen/"
echo "    src/types/"
echo "    src/utils/"
echo ""

# ══════════════════════════════════════════════════════════════
#  1.  src/types/index.ts
# ══════════════════════════════════════════════════════════════
echo "📄  Writing src/types/index.ts..."
cat > "$SRC/types/index.ts" << 'HEREDOC'
export interface Activity {
  id: number
  name: string
  duration: number // in minutes
}

export interface TimerState {
  activities: Activity[]
  currentIndex: number
  running: boolean
  remaining: number // in seconds
  overtime: boolean
  overtimeSeconds: number
}

export type TimerColor = 'green' | 'yellow' | 'red'

export interface BroadcastMessage {
  type: 'STATE_UPDATE'
  state: TimerState
}
HEREDOC

# ══════════════════════════════════════════════════════════════
#  2.  src/utils/timerStore.ts
# ══════════════════════════════════════════════════════════════
echo "📄  Writing src/utils/timerStore.ts..."
cat > "$SRC/utils/timerStore.ts" << 'HEREDOC'
import type { Activity, TimerState, TimerColor, BroadcastMessage } from '@/types'

export const STORAGE_KEY  = 'elim_timer_state'
export const CHANNEL_NAME = 'elim_timer_channel'

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
  activities:     DEFAULT_ACTIVITIES,
  currentIndex:   0,
  running:        false,
  remaining:      DEFAULT_ACTIVITIES[0].duration * 60,
  overtime:       false,
  overtimeSeconds: 0,
}

export function loadState(): TimerState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TimerState) : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

export function saveAndBroadcast(state: TimerState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  try {
    const bc  = new BroadcastChannel(CHANNEL_NAME)
    const msg: BroadcastMessage = { type: 'STATE_UPDATE', state }
    bc.postMessage(msg)
    bc.close()
  } catch {
    // BroadcastChannel unavailable in some environments
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
HEREDOC

# ══════════════════════════════════════════════════════════════
#  3.  src/app/globals.css  (replaces the default one)
# ══════════════════════════════════════════════════════════════
echo "📄  Writing src/app/globals.css..."
cat > "$APP/globals.css" << 'HEREDOC'
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --green:        #22c55e;
  --green-dim:    #16a34a;
  --green-deep:   #052e16;
  --green-border: #15803d;
  --green-glow:   rgba(34, 197, 94, 0.35);

  --yellow:        #fbbf24;
  --yellow-dim:    #d97706;
  --yellow-deep:   #292524;
  --yellow-border: #a16207;
  --yellow-glow:   rgba(251, 191, 36, 0.35);

  --red:        #f87171;
  --red-dim:    #dc2626;
  --red-deep:   #1c0a0a;
  --red-border: #b91c1c;
  --red-glow:   rgba(248, 113, 113, 0.45);

  --bg-page:    #111111;
  --bg-surface: #1a1a1a;
  --bg-card:    #222222;
  --border:     #2a2a2a;
  --border-mid: #333333;
  --text:       #ffffff;
  --text-muted: #888888;
  --text-dim:   #555555;
}

html, body {
  height: 100%;
  background: var(--bg-page);
  color: var(--text);
  font-family: var(--font-inter), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

button { font-family: inherit; cursor: pointer; }
input, select { font-family: inherit; }
a { color: inherit; text-decoration: none; }

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}
HEREDOC

# ══════════════════════════════════════════════════════════════
#  4.  src/app/layout.tsx  (replaces the default one)
# ══════════════════════════════════════════════════════════════
echo "📄  Writing src/app/layout.tsx..."
cat > "$APP/layout.tsx" << 'HEREDOC'
import type { Metadata } from 'next'
import { Bebas_Neue, Inter, Cinzel } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Elim Christian Garden International — Service Timer',
  description: 'Church service activity countdown timer',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${inter.variable} ${cinzel.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
HEREDOC

# ══════════════════════════════════════════════════════════════
#  5.  src/app/page.tsx  — Control Panel
# ══════════════════════════════════════════════════════════════
echo "📄  Writing src/app/page.tsx..."
cat > "$APP/page.tsx" << 'HEREDOC'
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { TimerState, Activity, TimerColor } from '@/types'
import {
  loadState,
  saveAndBroadcast,
  getTimerColor,
  formatTime,
  generateId,
} from '@/utils/timerStore'

const CHURCH_NAME      = 'Elim Christian Garden International'
const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120]

type ColorTheme = { bg: string; text: string; border: string }

const COLOR_MAP: Record<TimerColor, ColorTheme> = {
  green:  { bg: '#052e16', text: '#22c55e', border: '#15803d' },
  yellow: { bg: '#292524', text: '#fbbf24', border: '#a16207' },
  red:    { bg: '#1c0a0a', text: '#f87171', border: '#b91c1c' },
}

export default function ControlPanel() {
  const [state, setState]       = useState<TimerState | null>(null)
  const [newName, setNewName]   = useState('')
  const [newDuration, setNewDuration] = useState(15)
  const [editingId, setEditingId]     = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { setState(loadState()) }, [])

  const update = useCallback((updater: (prev: TimerState) => TimerState) => {
    setState(prev => {
      if (!prev) return prev
      const next = updater(prev)
      saveAndBroadcast(next)
      return next
    })
  }, [])

  // Countdown tick
  useEffect(() => {
    if (!state) return
    if (state.running) {
      intervalRef.current = setInterval(() => {
        update(prev => {
          if (!prev.running) return prev
          const newRemaining = prev.remaining - 1
          return {
            ...prev,
            remaining:      newRemaining,
            overtime:       newRemaining < 0,
            overtimeSeconds: newRemaining < 0 ? Math.abs(newRemaining) : 0,
          }
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [state?.running, update])

  // ── Actions ──────────────────────────────────────────────
  const startPause = () => update(prev => ({ ...prev, running: !prev.running }))

  const goNext = () => update(prev => {
    const next = prev.currentIndex + 1
    if (next >= prev.activities.length) return prev
    return { ...prev, currentIndex: next, remaining: prev.activities[next].duration * 60,
      overtime: false, overtimeSeconds: 0, running: prev.running }
  })

  const goPrev = () => update(prev => {
    const idx = Math.max(0, prev.currentIndex - 1)
    return { ...prev, currentIndex: idx, remaining: prev.activities[idx].duration * 60,
      overtime: false, overtimeSeconds: 0, running: false }
  })

  const resetCurrent = () => update(prev => ({
    ...prev, running: false,
    remaining: prev.activities[prev.currentIndex].duration * 60,
    overtime: false, overtimeSeconds: 0,
  }))

  const resetAll = () => update(prev => ({
    ...prev, currentIndex: 0, running: false,
    remaining: prev.activities[0].duration * 60,
    overtime: false, overtimeSeconds: 0,
  }))

  const selectActivity = (index: number) => update(prev => ({
    ...prev, currentIndex: index,
    remaining: prev.activities[index].duration * 60,
    overtime: false, overtimeSeconds: 0, running: false,
  }))

  const addActivity = () => {
    if (!newName.trim()) return
    update(prev => ({
      ...prev,
      activities: [...prev.activities,
        { id: generateId(), name: newName.trim(), duration: newDuration }],
    }))
    setNewName('')
    setNewDuration(15)
  }

  const removeActivity = (id: number) => update(prev => {
    const filtered = prev.activities.filter(a => a.id !== id)
    if (filtered.length === 0) return prev
    const newIndex = Math.min(prev.currentIndex, filtered.length - 1)
    return { ...prev, activities: filtered, currentIndex: newIndex,
      remaining: filtered[newIndex].duration * 60,
      overtime: false, overtimeSeconds: 0, running: false }
  })

  const updateDuration = (id: number, duration: number) => {
    update(prev => {
      const activities = prev.activities.map((a): Activity =>
        a.id === id ? { ...a, duration } : a)
      const isActive = prev.activities[prev.currentIndex].id === id
      return { ...prev, activities, remaining: isActive ? duration * 60 : prev.remaining }
    })
    setEditingId(null)
  }

  if (!state) return null

  const current    = state.activities[state.currentIndex]
  const color      = getTimerColor(state.remaining, current.duration * 60)
  const theme      = COLOR_MAP[color]
  const pct        = Math.max(0, Math.min(100, (state.remaining / (current.duration * 60)) * 100))
  const totalMins  = state.activities.reduce((s, a) => s + a.duration, 0)

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div>
          <p style={s.churchName}>{CHURCH_NAME}</p>
          <p style={s.subtitle}>Service Timer · Control Panel</p>
        </div>
        <a href="/screen" target="_blank" rel="noopener noreferrer" style={s.bigScreenBtn}>
          Open Big Screen ↗
        </a>
      </header>

      <div style={s.body}>
        {/* Left — Timer + controls */}
        <aside style={s.left}>
          {/* Timer card */}
          <div style={{ ...s.timerCard, background: theme.bg, borderColor: theme.border }}>
            <p style={s.activityLabel}>{current.name}</p>
            <p style={{ ...s.clockDisplay, color: theme.text }}>{formatTime(state.remaining)}</p>
            {state.overtime && (
              <p style={{ color: '#f87171', fontSize: 12, textAlign: 'center', marginTop: 4, letterSpacing: '0.15em' }}>
                OVERTIME
              </p>
            )}
            <p style={s.clockMeta}>
              Activity {state.currentIndex + 1} of {state.activities.length} · {current.duration} min allotted
            </p>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${pct}%`, background: theme.text }} />
            </div>
            <div style={s.legend}>
              <span style={{ color: '#22c55e' }}>● Plenty of time</span>
              <span style={{ color: '#fbbf24' }}>● Almost done</span>
              <span style={{ color: '#f87171' }}>● Time&apos;s up</span>
            </div>
          </div>

          {/* Control buttons */}
          <div style={s.controlRow}>
            <button onClick={goPrev} style={s.ctrlBtn}>◀ Prev</button>
            <button onClick={startPause} style={{
              ...s.ctrlBtn, ...s.primaryBtn,
              background:  state.running ? '#991b1b' : '#166534',
              borderColor: state.running ? '#7f1d1d' : '#14532d',
            }}>
              {state.running ? '⏸ Pause' : '▶ Start'}
            </button>
            <button onClick={goNext} style={s.ctrlBtn}>Next ▶</button>
          </div>
          <div style={s.controlRow}>
            <button onClick={resetCurrent} style={s.ctrlBtn}>↺ Reset</button>
            <button onClick={resetAll} style={{ ...s.ctrlBtn, color: '#f87171', borderColor: '#7f1d1d' }}>
              ⬛ Reset All
            </button>
          </div>

          {/* Summary */}
          <div style={s.summaryCard}>
            {([
              ['Total duration', `${totalMins} min`],
              ['Activities',     String(state.activities.length)],
              ['Status',         state.running ? '● LIVE' : '● Paused'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={s.summaryRow}>
                <span style={{ color: '#888' }}>{label}</span>
                <span style={{ color: label === 'Status' ? (state.running ? '#22c55e' : '#888') : '#fff' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* Right — Activity list */}
        <main style={s.right}>
          <p style={s.sectionTitle}>Programme Activities</p>

          <div style={s.activityList}>
            {state.activities.map((activity, index) => {
              const isActive = index === state.currentIndex
              const isPast   = index < state.currentIndex
              return (
                <div
                  key={activity.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectActivity(index)}
                  onKeyDown={e => e.key === 'Enter' && selectActivity(index)}
                  style={{
                    ...s.activityRow,
                    background:  isActive ? '#1e3a2a' : isPast ? '#161616' : '#1e1e1e',
                    borderColor: isActive ? '#166534' : '#2a2a2a',
                    opacity: isPast ? 0.45 : 1,
                  }}
                >
                  <span style={{
                    ...s.indexBadge,
                    background: isActive ? '#22c55e' : '#2a2a2a',
                    color:      isActive ? '#000'    : '#666',
                  }}>
                    {isPast ? '✓' : index + 1}
                  </span>

                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: isActive ? '#fff' : '#bbb' }}>
                    {activity.name}
                  </span>

                  {editingId === activity.id ? (
                    <select
                      defaultValue={activity.duration}
                      autoFocus
                      onBlur={e  => updateDuration(activity.id, Number(e.target.value))}
                      onChange={e => updateDuration(activity.id, Number(e.target.value))}
                      onClick={e => e.stopPropagation()}
                      style={s.durationSelect}
                    >
                      {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}m</option>)}
                    </select>
                  ) : (
                    <span
                      style={s.durationBadge}
                      title="Click to change duration"
                      onClick={e => { e.stopPropagation(); setEditingId(activity.id) }}
                    >
                      {activity.duration}m
                    </span>
                  )}

                  <button
                    onClick={e => { e.stopPropagation(); removeActivity(activity.id) }}
                    style={s.removeBtn}
                    aria-label="Remove activity"
                  >✕</button>
                </div>
              )
            })}
          </div>

          {/* Add activity */}
          <div style={s.addRow}>
            <input
              type="text"
              placeholder="New activity name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addActivity()}
              style={s.addInput}
              aria-label="New activity name"
            />
            <select
              value={newDuration}
              onChange={e => setNewDuration(Number(e.target.value))}
              style={s.addSelect}
              aria-label="Duration"
            >
              {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
            </select>
            <button onClick={addActivity} style={s.addBtn}>Add</button>
          </div>
        </main>
      </div>
    </div>
  )
}

// ── Inline styles ─────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page:        { minHeight: '100vh', background: '#111', color: '#fff', fontFamily: 'var(--font-inter), system-ui, sans-serif' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' },
  churchName:  { fontSize: 15, fontWeight: 600, letterSpacing: '0.02em' },
  subtitle:    { fontSize: 11, color: '#555', marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' },
  bigScreenBtn:{ background: '#1e3a5f', color: '#60a5fa', border: '1px solid #1e40af', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, display: 'inline-block' },
  body:        { display: 'grid', gridTemplateColumns: '360px 1fr', minHeight: 'calc(100vh - 57px)' },
  left:        { padding: 20, borderRight: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: 14 },
  right:       { padding: 20, display: 'flex', flexDirection: 'column', gap: 10 },
  timerCard:   { borderRadius: 12, border: '1px solid', padding: '18px 20px 14px', transition: 'background 0.6s ease, border-color 0.6s ease' },
  activityLabel:{ fontSize: 11, color: '#777', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 },
  clockDisplay:{ fontFamily: 'var(--font-bebas), cursive', fontSize: 84, lineHeight: 1, textAlign: 'center', letterSpacing: '0.04em', transition: 'color 0.6s ease' },
  clockMeta:   { fontSize: 11, color: '#555', textAlign: 'center', marginTop: 8 },
  progressTrack:{ height: 4, background: '#111', borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressFill:{ height: '100%', borderRadius: 2, transition: 'width 0.9s linear, background 0.6s ease' },
  legend:      { display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 10, gap: 4 },
  controlRow:  { display: 'flex', gap: 8 },
  ctrlBtn:     { flex: 1, padding: '10px 8px', background: '#1e1e1e', color: '#ccc', border: '1px solid #333', borderRadius: 8, fontSize: 13, fontWeight: 500 },
  primaryBtn:  { flex: 2, color: '#fff', fontSize: 15, fontWeight: 600 },
  summaryCard: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  summaryRow:  { display: 'flex', justifyContent: 'space-between', fontSize: 13 },
  sectionTitle:{ fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 },
  activityList:{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' },
  activityRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s, opacity 0.15s' },
  indexBadge:  { width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, transition: 'background 0.2s, color 0.2s' },
  durationBadge:{ fontSize: 12, color: '#666', background: '#1a1a1a', border: '1px solid #333', padding: '3px 8px', borderRadius: 5, cursor: 'pointer', minWidth: 36, textAlign: 'center', flexShrink: 0 },
  durationSelect:{ fontSize: 12, background: '#1a1a1a', color: '#fff', border: '1px solid #555', borderRadius: 5, padding: '3px 4px', width: 64, flexShrink: 0 },
  removeBtn:   { background: 'none', border: 'none', color: '#444', fontSize: 13, padding: '2px 4px', borderRadius: 4, lineHeight: 1, flexShrink: 0 },
  addRow:      { display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #2a2a2a', marginTop: 'auto' },
  addInput:    { flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, outline: 'none' },
  addSelect:   { background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '9px 8px', color: '#fff', fontSize: 13 },
  addBtn:      { background: '#166534', color: '#fff', border: '1px solid #14532d', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 600 },
}
HEREDOC

# ══════════════════════════════════════════════════════════════
#  6.  src/app/screen/layout.tsx
# ══════════════════════════════════════════════════════════════
echo "📄  Writing src/app/screen/layout.tsx..."
cat > "$APP/screen/layout.tsx" << 'HEREDOC'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Big Screen — Elim Christian Garden International',
}

export default function ScreenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
HEREDOC

# ══════════════════════════════════════════════════════════════
#  7.  src/app/screen/page.tsx  — Big Screen
# ══════════════════════════════════════════════════════════════
echo "📄  Writing src/app/screen/page.tsx..."
cat > "$APP/screen/page.tsx" << 'HEREDOC'
'use client'

import { useState, useEffect, useRef } from 'react'
import type { TimerState, TimerColor } from '@/types'
import { loadState, CHANNEL_NAME, getTimerColor, formatTime } from '@/utils/timerStore'

const CHURCH_NAME = 'Elim Christian Garden International'

type ColorTheme = {
  timerColor: string
  glowColor:  string
  ringColor:  string
  bgGradient: string
  labelColor: string
  statusText: string
  progressBg: string
}

const COLOR_THEMES: Record<TimerColor, ColorTheme> = {
  green: {
    timerColor: '#22c55e', glowColor: 'rgba(34,197,94,0.4)',   ringColor: '#16a34a',
    bgGradient: 'radial-gradient(ellipse at center, #052e16 0%, #000 70%)',
    labelColor: '#4ade80', statusText: 'Time Remaining',       progressBg: '#14532d',
  },
  yellow: {
    timerColor: '#fbbf24', glowColor: 'rgba(251,191,36,0.4)',  ringColor: '#d97706',
    bgGradient: 'radial-gradient(ellipse at center, #292524 0%, #000 70%)',
    labelColor: '#fcd34d', statusText: 'Time Almost Up',       progressBg: '#78350f',
  },
  red: {
    timerColor: '#f87171', glowColor: 'rgba(248,113,113,0.5)', ringColor: '#dc2626',
    bgGradient: 'radial-gradient(ellipse at center, #1c0a0a 0%, #000 70%)',
    labelColor: '#fca5a5', statusText: "Time\u2019s Up!",      progressBg: '#7f1d1d',
  },
}

const RING_R    = 160
const RING_CIRC = 2 * Math.PI * RING_R

export default function BigScreen() {
  const [state, setState]               = useState<TimerState | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [blinkVisible, setBlinkVisible] = useState(true)
  const blinkRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { setState(loadState()) }, [])

  // BroadcastChannel — real-time sync within same browser
  useEffect(() => {
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(CHANNEL_NAME)
      bc.onmessage = (e: MessageEvent) => {
        if (e.data?.type === 'STATE_UPDATE') setState(e.data.state as TimerState)
      }
    } catch { /* unavailable */ }
    return () => bc?.close()
  }, [])

  // Fallback poll for cross-device use (same network + shared storage not available)
  useEffect(() => {
    const id = setInterval(() => setState(loadState()), 500)
    return () => clearInterval(id)
  }, [])

  // Blink when overtime
  useEffect(() => {
    if (state?.overtime) {
      blinkRef.current = setInterval(() => setBlinkVisible(v => !v), 600)
    } else {
      if (blinkRef.current) clearInterval(blinkRef.current)
      setBlinkVisible(true)
    }
    return () => { if (blinkRef.current) clearInterval(blinkRef.current) }
  }, [state?.overtime])

  // Fullscreen tracking
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  }

  if (!state) return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 18 }}>
      Waiting for timer…
    </div>
  )

  const current    = state.activities[state.currentIndex]
  const color      = getTimerColor(state.remaining, current.duration * 60)
  const theme      = COLOR_THEMES[color]
  const pct        = Math.max(0, Math.min(100, (state.remaining / (current.duration * 60)) * 100))
  const ringOffset = RING_CIRC - (pct / 100) * RING_CIRC
  const hasNext    = state.currentIndex < state.activities.length - 1
  const statusText = state.overtime ? 'OVERTIME' : theme.statusText

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: theme.bgGradient,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      transition: 'background 1.2s ease',
      fontFamily: 'var(--font-inter), system-ui, sans-serif',
    }}>
      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: [
          'linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '80px 80px',
      }} />

      {/* Church name */}
      <p style={{
        position: 'absolute', top: 28, left: 0, right: 0, textAlign: 'center',
        fontFamily: 'var(--font-cinzel), serif',
        fontSize: 'clamp(13px, 1.6vw, 22px)', fontWeight: 400,
        color: 'rgba(255,255,255,0.38)', letterSpacing: '0.16em', textTransform: 'uppercase',
      }}>
        {CHURCH_NAME}
      </p>

      {/* Breadcrumb */}
      <p style={{
        position: 'absolute', top: 64, left: 0, right: 0, textAlign: 'center',
        fontSize: 'clamp(10px, 1.1vw, 14px)', color: 'rgba(255,255,255,0.2)',
        letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 300,
      }}>
        Activity {state.currentIndex + 1} of {state.activities.length}
      </p>

      {/* Ring + Clock */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="380" height="380" viewBox="0 0 380 380"
          style={{ position: 'absolute', transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle cx="190" cy="190" r={RING_R} fill="none" stroke={theme.progressBg} strokeWidth="6" />
          <circle cx="190" cy="190" r={RING_R} fill="none"
            stroke={theme.ringColor} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={RING_CIRC} strokeDashoffset={ringOffset}
            style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 1.2s ease',
              filter: `drop-shadow(0 0 8px ${theme.glowColor})` }}
          />
        </svg>

        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', width: 320 }}>
          <p style={{
            fontFamily: 'var(--font-bebas), cursive',
            fontSize: 'clamp(72px, 13vw, 150px)', lineHeight: 0.88,
            color: blinkVisible ? theme.timerColor : 'transparent',
            letterSpacing: '0.04em',
            textShadow: blinkVisible ? `0 0 50px ${theme.glowColor}, 0 0 100px ${theme.glowColor}` : 'none',
            transition: 'color 1.2s ease', userSelect: 'none',
          }}>
            {formatTime(state.remaining)}
          </p>
          <p style={{
            fontSize: 'clamp(10px, 1.3vw, 15px)', fontWeight: 300,
            color: theme.labelColor, letterSpacing: '0.26em',
            textTransform: 'uppercase', marginTop: 14, opacity: 0.85,
            transition: 'color 1.2s ease',
          }}>
            {statusText}
          </p>
        </div>
      </div>

      {/* Activity name */}
      <p style={{
        marginTop: 44, textAlign: 'center',
        fontFamily: 'var(--font-cinzel), serif',
        fontSize: 'clamp(20px, 3.8vw, 50px)', fontWeight: 600,
        color: '#ffffff', letterSpacing: '0.08em',
        textShadow: `0 0 40px ${theme.glowColor}`,
        maxWidth: '75vw', lineHeight: 1.25, transition: 'text-shadow 1.2s ease',
      }}>
        {current.name}
      </p>

      <p style={{
        marginTop: 10, fontSize: 'clamp(11px, 1.3vw, 16px)', fontWeight: 300,
        color: 'rgba(255,255,255,0.28)', letterSpacing: '0.16em', textTransform: 'uppercase',
      }}>
        {current.duration} minutes allocated
      </p>

      {/* Bottom progress bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, background: 'rgba(255,255,255,0.04)' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: theme.timerColor,
          boxShadow: `0 0 12px ${theme.glowColor}`,
          transition: 'width 0.9s linear, background 1.2s ease',
        }} />
      </div>

      {/* Live indicator */}
      <div style={{
        position: 'absolute', bottom: 18, left: 22,
        display: 'flex', alignItems: 'center', gap: 7,
        fontSize: 11, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.1em',
      }}>
        <span style={{
        width: '10px', height: '10px',   // ← strings, not numbers
        borderRadius: '50%',
        display: 'inline-block',
        background:  timerState.running && isTm ? '#22c55e' : '#aaa',
        boxShadow:   timerState.running && isTm ? '0 0 14px #22c55e' : 'none',
        transition:  'background 0.4s',
      }} suppressHydrationWarning />
        {state.running ? 'LIVE' : 'PAUSED'}
      </div>

      {/* Next up */}
      {hasNext && (
        <p style={{
          position: 'absolute', bottom: 18, left: 0, right: 0, textAlign: 'center',
          fontSize: 'clamp(10px, 1vw, 13px)', color: 'rgba(255,255,255,0.18)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          Next: {state.activities[state.currentIndex + 1].name}
        </p>
      )}

      {/* Fullscreen button */}
      <button onClick={toggleFullscreen} style={{
        position: 'absolute', bottom: 12, right: 18,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.25)', padding: '5px 14px',
        borderRadius: 6, fontSize: 11, letterSpacing: '0.05em', cursor: 'pointer',
      }}>
        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen ⛶'}
      </button>
    </div>
  )
}
HEREDOC

# ══════════════════════════════════════════════════════════════
#  Done!
# ══════════════════════════════════════════════════════════════
echo ""
echo "=============================================="
echo "  ✅  All files created successfully!"
echo "=============================================="
echo ""
echo "  Files written:"
echo "    src/types/index.ts"
echo "    src/utils/timerStore.ts"
echo "    src/app/globals.css       (replaced)"
echo "    src/app/layout.tsx        (replaced)"
echo "    src/app/page.tsx          (replaced)"
echo "    src/app/screen/layout.tsx (new)"
echo "    src/app/screen/page.tsx   (new)"
echo ""
echo "  Run your dev server:"
echo "    npm run dev"
echo ""
echo "  Then open:"
echo "    http://localhost:3000         ← Control Panel"
echo "    http://localhost:3000/screen  ← Big Screen"
echo ""
