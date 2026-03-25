// ── Timer ────────────────────────────────────────────────────
export interface Activity {
  id: number
  name: string
  duration: number // minutes
}

export type TimerState = {
  activities:       Activity[]
  currentIndex:     number
  running:          boolean
  remaining:        number
  overtime:         boolean
  overtimeSeconds:  number
  startedAt:        number | null
  remainingAtStart: number | null
}

export type TimerColor = 'green' | 'yellow' | 'red'

// ── Bible ────────────────────────────────────────────────────
export interface BibleTranslation {
  id: string
  name: string
  language: string
}

export interface BibleVerse {
  book: string
  chapter: number
  verse: number
  text: string
  translation: string
  reference: string
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
  url: string
}

// ── Videos ───────────────────────────────────────────────────
export interface SlideVideo {
  id: number
  name: string
  url: string
  type: 'video/mp4' | 'video/webm' | 'video/ogg' | string
}

// ── Presentations ────────────────────────────────────────────
export interface SlidePresentation {
  id: number
  name: string
  url: string
  // PDF = rendered page-by-page via pdf.js
  // PPTX = auto-converted to PDF on upload (server) or displayed via Google Slides iframe
  type: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.presentationml.presentation' | 'google-slides' | string
  // For Google Slides embed links
  embedUrl?: string
  // Total pages (populated after upload/conversion)
  pageCount?: number
}

// ── Notices ──────────────────────────────────────────────────
export interface Notice {
  id: number
  title: string
  body: string
  style: 'default' | 'urgent' | 'celebration'
}

// ── Presentation State ────────────────────────────────────────
export type PresentMode =
  | 'timer'
  | 'bible'
  | 'song'
  | 'image'
  | 'video'
  | 'presentation'
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

  // Videos
  videos: SlideVideo[]
  activeVideoId: number | null

  // Presentations
  presentations: SlidePresentation[]
  activePresentationId: number | null
  activePresentationPage: number

  // Notices
  notices: Notice[]
  activeNoticeId: number | null

  // Alert scroller
  alertActive: boolean
  alertMinisters: string[]
  alertPosition: 'top' | 'bottom'
  alertRepeats: number
  alertIntervalMs: number
}

// ── Broadcast ────────────────────────────────────────────────
export interface BroadcastMessage {
  type: 'TIMER_UPDATE' | 'PRESENT_UPDATE'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any
}