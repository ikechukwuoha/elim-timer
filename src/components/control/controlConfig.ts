import type { TimerColor } from '@/types'

export const CHURCH_NAME = 'Elim Christian Garden International'
export const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120]
export const ADDITIONAL_TIME_OPTIONS = [1, 2, 5, 10, 15]
export const AUTO_NEXT_BUFFER_SECONDS = 3
export const KEYWORD_SEARCH_MAX_RESULTS = 30
export const SCRIPTURE_SUGGESTION_LIMIT = 8
export const SCRIPTURE_AUTO_DISPLAY_COOLDOWN_MS = 15_000
export const CAPTION_SUGGESTION_LIMIT = 10
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/*'
export const PRESENTATION_ACCEPT = 'application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,.pdf,.pptx,.ppt,.odp'
export const HEALTH_POLL_MS = 20_000
export const TOAST_DURATION_MS = 5000

export type Tab = 'timer' | 'bible' | 'captions' | 'songs' | 'images' | 'media' | 'notices'
export type ReportPeriod = 'weekly' | 'monthly'

export type ColorTheme = {
  bg: string
  text: string
  border: string
  glow: string
}

export type BibleSearchHit = {
  book: string
  bookId: string
  chapter: number
  verse: number
  text: string
  translation: string
  reference: string
  score?: number
  matchedTerms?: string[]
}

export type HealthServiceState = 'checking' | 'ok' | 'error'
export type ToastTone = 'success' | 'info' | 'warning' | 'danger'

export type SystemHealth = {
  overall: 'checking' | 'healthy' | 'degraded'
  checkedAt: number | null
  services: Record<'auth' | 'clock' | 'timer' | 'present', HealthServiceState>
}

export type ControlToastState = {
  id: number
  title: string
  detail?: string
  tone: ToastTone
  undoLabel?: string
}

export type TimerReportRow = {
  service: string
  sessions: number
  total_programme_seconds: number
  total_additional_seconds: number
  total_allotted_seconds: number
  total_used_seconds: number
  total_excess_seconds: number
  total_unused_seconds: number
  total_unfinished_seconds: number
}

export type TimerReportSession = {
  id: number
  service: string
  programme_seconds: number
  additional_seconds: number
  total_allotted_seconds: number
  used_seconds: number
  excess_seconds: number
  unused_seconds: number
  unfinished_seconds: number
  started_at: number
  ended_at: number
  created_at: number
  exit_reason: string
  user: string | null
  notes: string | null
}

export type TimerReportSummary = {
  sessions: number
  total_programme_seconds: number
  total_additional_seconds: number
  total_allotted_seconds: number
  total_used_seconds: number
  total_excess_seconds: number
  total_unused_seconds: number
  total_unfinished_seconds: number
  overtime_sessions: number
  additional_time_sessions: number
  early_finish_sessions: number
  interrupted_sessions: number
  average_used_seconds: number
  average_excess_seconds: number
  longest_session_seconds: number
  longest_excess_seconds: number
}

export const COLOR_MAP: Record<TimerColor, ColorTheme> = {
  green: { bg: 'linear-gradient(145deg,#052e16,#0a3d1e)', text: '#22c55e', border: '#15803d', glow: 'rgba(34,197,94,0.12)' },
  yellow: { bg: 'linear-gradient(145deg,#292524,#1f1a14)', text: '#fbbf24', border: '#a16207', glow: 'rgba(251,191,36,0.12)' },
  red: { bg: 'linear-gradient(145deg,#1c0a0a,#2a0e0e)', text: '#f87171', border: '#b91c1c', glow: 'rgba(248,113,113,0.12)' },
}

export const DEFAULT_SYSTEM_HEALTH: SystemHealth = {
  overall: 'checking',
  checkedAt: null,
  services: {
    auth: 'checking',
    clock: 'checking',
    timer: 'checking',
    present: 'checking',
  },
}

export const SHORTCUTS: Array<{ key: string; description: string }> = [
  { key: 'Alt + 1-7', description: 'Switch directly between Timer, Bible, Captions, Songs, Images, Media, and Notices.' },
  { key: 'Space', description: 'Start or pause the timer when the Timer tab is active.' },
  { key: 'Left / Right', description: 'Move timer items, Bible verses, or song lines depending on the active tab.' },
  { key: '/', description: 'Focus the Bible keyword search instantly.' },
  { key: '?', description: 'Open this shortcuts panel from anywhere on the control screen.' },
  { key: 'Esc', description: 'Close the shortcuts panel.' },
]

export const TAB_OPTIONS: Array<{ id: Tab; label: string }> = [
  { id: 'timer', label: 'Timer' },
  { id: 'bible', label: 'Bible' },
  { id: 'captions', label: 'Captions' },
  { id: 'songs', label: 'Songs' },
  { id: 'images', label: 'Images' },
  { id: 'media', label: 'Media' },
  { id: 'notices', label: 'Notices' },
]
