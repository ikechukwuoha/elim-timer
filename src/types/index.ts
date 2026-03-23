// ── Timer ────────────────────────────────────────────────────
export interface Activity {
  id: number
  name: string
  duration: number // minutes
}

// Add these two fields to your existing TimerState type.
// Everything else in your types file stays the same.

export type TimerState = {
  activities:       Activity[]
  currentIndex:     number
  running:          boolean
  remaining:        number
  overtime:         boolean
  overtimeSeconds:  number
  startedAt:        number | null   // ms epoch when timer last started/resumed
  remainingAtStart: number | null   // seconds on clock at that exact moment
}

export type TimerColor = 'green' | 'yellow' | 'red'

// ── Bible ────────────────────────────────────────────────────
export interface BibleTranslation {
  id: string       // e.g. "KJV"
  name: string     // e.g. "King James Version"
  language: string // e.g. "English"
}

export interface BibleVerse {
  book: string      // e.g. "John"
  chapter: number
  verse: number
  text: string
  translation: string
  reference: string // e.g. "John 3:16 (KJV)"
}

export interface BibleChapter {
  book: string
  chapter: number
  verses: { verse: number; text: string }[]
}

// ── Songs ────────────────────────────────────────────────────
export interface SongLine {
  id: number
  text: string
}

export interface Song {
  id: number
  title: string
  artist?: string
  lines: SongLine[]
}

// ── Images ───────────────────────────────────────────────────
export interface SlideImage {
  id: number
  name: string
  url: string // /uploads/filename or data URL
}

// ── Notices ──────────────────────────────────────────────────
export interface Notice {
  id: number
  title: string
  body: string
  style: 'default' | 'urgent' | 'celebration'
}

// ── Presentation State (shared between control + screen) ────
export type PresentMode =
  | 'timer'
  | 'bible'
  | 'song'
  | 'image'
  | 'notice'
  | 'blank'

export interface PresentState {
  mode: PresentMode

  // Bible
  activeVerse: BibleVerse | null

  // Song
  songs: Song[]
  activeSongId: number | null
  activeLineIndex: number

  // Images
  images: SlideImage[]
  activeImageId: number | null

  // Notices
  notices: Notice[]
  activeNoticeId: number | null
}

// ── Broadcast ────────────────────────────────────────────────
export interface BroadcastMessage {
  type: 'TIMER_UPDATE' | 'PRESENT_UPDATE'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any
}