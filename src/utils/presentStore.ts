// utils/presentStore.ts
import type { PresentState, PresentMode, BibleVerse, BibleDisplayMode, Song, SlideImage, SlideVideo, SlidePresentation, Notice, CaptionCue, BibleBackground } from '@/types'
import {
  DEFAULT_BIBLE_BACKGROUNDS,
  DEFAULT_BIBLE_BACKGROUND_ID,
  DEFAULT_BIBLE_FONT_FAMILY_ID,
  DEFAULT_BIBLE_FONT_SCALE,
  DEFAULT_BIBLE_TEXT_COLOR,
  clampBibleFontScale,
  mergeBibleBackgrounds,
  normalizeBibleFontFamilyId,
  toSlimBibleBackground,
} from './bibleDisplay'

export const PRESENT_STORAGE_KEY  = 'elim_present_state'
export const PRESENT_CHANNEL_NAME = 'elim_present_channel'

export const DEFAULT_PRESENT_STATE: PresentState = {
  mode: 'timer',
  activeVerse: null,
  activeSecondaryVerse: null,
  bibleDisplayMode: 'single',
  bibleBackgrounds: DEFAULT_BIBLE_BACKGROUNDS,
  activeBibleBackgroundId: DEFAULT_BIBLE_BACKGROUND_ID,
  bibleTextColor: DEFAULT_BIBLE_TEXT_COLOR,
  bibleFontFamilyId: DEFAULT_BIBLE_FONT_FAMILY_ID,
  bibleFontScale: DEFAULT_BIBLE_FONT_SCALE,
  songs: [],
  activeSongId: null,
  activeLineIndex: 0,
  activeCaption: null,
  images: [],
  activeImageId: null,
  videos: [],
  activeVideoId: null,
  presentations: [],
  activePresentationId: null,
  notices: [],
  activeNoticeId: null,
  alertActive: false,
  alertMinisters: [],
  alertPosition: 'bottom',
  alertRepeats: 1,
  alertIntervalMs: 2500,
  activePresentationPage: 0
}

export function loadPresentState(): PresentState {
  if (typeof window === 'undefined') return DEFAULT_PRESENT_STATE
  try {
    const raw = localStorage.getItem(PRESENT_STORAGE_KEY)
    if (!raw) return DEFAULT_PRESENT_STATE
    const parsed = JSON.parse(raw) as PresentState
    const mergedBibleBackgrounds = mergeBibleBackgrounds(Array.isArray(parsed.bibleBackgrounds) ? parsed.bibleBackgrounds : DEFAULT_PRESENT_STATE.bibleBackgrounds)
    return {
      ...DEFAULT_PRESENT_STATE,
      ...parsed,
      songs:               Array.isArray(parsed.songs) ? parsed.songs : [],
      activeSecondaryVerse: parsed.activeSecondaryVerse && typeof parsed.activeSecondaryVerse.text === 'string'
        ? parsed.activeSecondaryVerse
        : DEFAULT_PRESENT_STATE.activeSecondaryVerse,
      bibleDisplayMode: parsed.bibleDisplayMode === 'double' ? 'double' : DEFAULT_PRESENT_STATE.bibleDisplayMode,
      bibleBackgrounds:    mergedBibleBackgrounds,
      activeBibleBackgroundId:
        typeof parsed.activeBibleBackgroundId === 'string' &&
        mergedBibleBackgrounds.some(background => background.id === parsed.activeBibleBackgroundId)
          ? parsed.activeBibleBackgroundId
          : DEFAULT_PRESENT_STATE.activeBibleBackgroundId,
      bibleTextColor:      typeof parsed.bibleTextColor === 'string' && parsed.bibleTextColor.trim()
        ? parsed.bibleTextColor
        : DEFAULT_PRESENT_STATE.bibleTextColor,
      bibleFontFamilyId:   normalizeBibleFontFamilyId(parsed.bibleFontFamilyId),
      bibleFontScale:      clampBibleFontScale(parsed.bibleFontScale),
      activeCaption:       parsed.activeCaption && typeof parsed.activeCaption.text === 'string' ? parsed.activeCaption : DEFAULT_PRESENT_STATE.activeCaption,
      notices:             Array.isArray(parsed.notices) ? parsed.notices : [],
      images:              Array.isArray(parsed.images) ? parsed.images : [],
      videos:              Array.isArray(parsed.videos) ? parsed.videos : [],
      presentations:       Array.isArray(parsed.presentations) ? parsed.presentations : [],
      alertActive:         typeof parsed.alertActive === 'boolean' ? parsed.alertActive : DEFAULT_PRESENT_STATE.alertActive,
      alertMinisters:      Array.isArray(parsed.alertMinisters) ? parsed.alertMinisters : DEFAULT_PRESENT_STATE.alertMinisters,
      alertPosition:       parsed.alertPosition === 'top' || parsed.alertPosition === 'bottom' ? parsed.alertPosition : DEFAULT_PRESENT_STATE.alertPosition,
      alertRepeats:        typeof parsed.alertRepeats === 'number' ? parsed.alertRepeats : DEFAULT_PRESENT_STATE.alertRepeats,
      alertIntervalMs:     typeof parsed.alertIntervalMs === 'number' ? parsed.alertIntervalMs : DEFAULT_PRESENT_STATE.alertIntervalMs,
    }
  } catch {
    return DEFAULT_PRESENT_STATE
  }
}

// ── Slim payload — strips base64 URLs for HTTP transport ──────
function toSlimPayload(state: PresentState) {
  return {
    mode:                 state.mode,
    activeVerse:          state.activeVerse,
    activeSecondaryVerse: state.activeSecondaryVerse,
    bibleDisplayMode:     state.bibleDisplayMode,
    bibleBackgrounds:     state.bibleBackgrounds.map(toSlimBibleBackground),
    activeBibleBackgroundId: state.activeBibleBackgroundId,
    bibleTextColor:       state.bibleTextColor,
    bibleFontFamilyId:    state.bibleFontFamilyId,
    bibleFontScale:       state.bibleFontScale,
    activeSongId:         state.activeSongId,
    activeLineIndex:      state.activeLineIndex,
    activeCaption:        state.activeCaption,
    activeImageId:        state.activeImageId,
    activeVideoId:        state.activeVideoId,
    activePresentationId: state.activePresentationId,
    activeNoticeId:       state.activeNoticeId,
    songs:                state.songs,
    notices:              state.notices,
    images:               state.images.map(img => ({ id: img.id, name: img.name })),
    videos:               state.videos.map(v => ({ id: v.id, name: v.name, type: v.type })),
    presentations:        state.presentations.map(p => ({ id: p.id, name: p.name, type: p.type })),
    alertActive:          state.alertActive,
    alertMinisters:       state.alertMinisters,
    alertPosition:        state.alertPosition,
    alertRepeats:         state.alertRepeats,
    alertIntervalMs:      state.alertIntervalMs,
  }
}

function shouldLogPresentSyncError(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false
  return true
}

export function savePresentState(state: PresentState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PRESENT_STORAGE_KEY, JSON.stringify(state))
  try {
    const bc = new BroadcastChannel(PRESENT_CHANNEL_NAME)
    bc.postMessage({ type: 'PRESENT_UPDATE', state })
    bc.close()
  } catch { /* unavailable */ }
  fetch('/api/present', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: toSlimPayload(state) }),
    keepalive: true,
  }).catch(e => {
    if (shouldLogPresentSyncError()) console.warn('[API] Save present error:', e.message)
  })
}

// ── State helpers ─────────────────────────────────────────────

export function setMode(state: PresentState, mode: PresentMode): PresentState {
  return { ...state, mode }
}
export function displayVerse(state: PresentState, verse: BibleVerse): PresentState {
  return displayVerseSelection(state, verse)
}
export function displayVerseSelection(
  state: PresentState,
  verse: BibleVerse,
  options: {
    secondaryVerse?: BibleVerse | null
    displayMode?: BibleDisplayMode
  } = {}
): PresentState {
  const displayMode = options.displayMode ?? (options.secondaryVerse ? 'double' : 'single')
  return {
    ...state,
    mode: 'bible',
    activeVerse: verse,
    activeSecondaryVerse: displayMode === 'double' ? (options.secondaryVerse ?? null) : null,
    bibleDisplayMode: displayMode,
  }
}
export function setBibleBackground(state: PresentState, backgroundId: string): PresentState {
  return {
    ...state,
    activeBibleBackgroundId: state.bibleBackgrounds.some(background => background.id === backgroundId)
      ? backgroundId
      : DEFAULT_BIBLE_BACKGROUND_ID,
  }
}
export function setBibleTextColor(state: PresentState, color: string): PresentState {
  return { ...state, bibleTextColor: color || DEFAULT_BIBLE_TEXT_COLOR }
}
export function setBibleFontFamily(state: PresentState, fontFamilyId: string): PresentState {
  return { ...state, bibleFontFamilyId: normalizeBibleFontFamilyId(fontFamilyId) }
}
export function setBibleFontScale(state: PresentState, fontScale: number): PresentState {
  return { ...state, bibleFontScale: clampBibleFontScale(fontScale) }
}
export function addBibleBackground(state: PresentState, background: Omit<BibleBackground, 'id'>): PresentState {
  const nextBackground: BibleBackground = {
    ...background,
    id: `bible-bg-${Date.now()}`,
  }
  return {
    ...state,
    bibleBackgrounds: [...mergeBibleBackgrounds(state.bibleBackgrounds), nextBackground],
    activeBibleBackgroundId: nextBackground.id,
  }
}
export function deleteBibleBackground(state: PresentState, backgroundId: string): PresentState {
  const nextBackgrounds = mergeBibleBackgrounds(state.bibleBackgrounds).filter(background => background.id !== backgroundId || background.builtIn)
  return {
    ...state,
    bibleBackgrounds: nextBackgrounds,
    activeBibleBackgroundId: state.activeBibleBackgroundId === backgroundId ? DEFAULT_BIBLE_BACKGROUND_ID : state.activeBibleBackgroundId,
  }
}
export function selectSong(state: PresentState, songId: number): PresentState {
  return { ...state, activeSongId: songId, activeLineIndex: 0 }
}
export function goToLine(state: PresentState, index: number): PresentState {
  const song = state.songs.find(s => s.id === state.activeSongId)
  if (!song) return state
  const clamped = Math.max(0, Math.min(index, song.lines.length - 1))
  return { ...state, activeLineIndex: clamped, mode: 'song' }
}
export function displayCaption(state: PresentState, caption: CaptionCue): PresentState {
  return { ...state, mode: 'caption', activeCaption: caption }
}
export function displayImage(state: PresentState, imageId: number): PresentState {
  return { ...state, mode: 'image', activeImageId: imageId }
}
export function displayNotice(state: PresentState, noticeId: number): PresentState {
  return { ...state, mode: 'notice', activeNoticeId: noticeId }
}

// ── Video helpers ─────────────────────────────────────────────
export function displayVideo(state: PresentState, videoId: number): PresentState {
  return { ...state, mode: 'video', activeVideoId: videoId }
}
export function addVideo(state: PresentState, video: Omit<SlideVideo, 'id'>): PresentState {
  return { ...state, videos: [...state.videos, { ...video, id: Date.now() }] }
}
export function deleteVideo(state: PresentState, videoId: number): PresentState {
  return {
    ...state,
    videos:       state.videos.filter(v => v.id !== videoId),
    activeVideoId: state.activeVideoId === videoId ? null : state.activeVideoId,
  }
}

// ── Presentation helpers ──────────────────────────────────────
export function displayPresentation(state: PresentState, presentationId: number): PresentState {
  return { ...state, mode: 'presentation', activePresentationId: presentationId }
}
export function addPresentation(state: PresentState, presentation: Omit<SlidePresentation, 'id'>): PresentState {
  return { ...state, presentations: [...state.presentations, { ...presentation, id: Date.now() }] }
}
export function deletePresentation(state: PresentState, presentationId: number): PresentState {
  return {
    ...state,
    presentations:        state.presentations.filter(p => p.id !== presentationId),
    activePresentationId: state.activePresentationId === presentationId ? null : state.activePresentationId,
  }
}

// ── Song helpers ──────────────────────────────────────────────
export function addSong(state: PresentState, song: Omit<Song, 'id'>): PresentState {
  return { ...state, songs: [...state.songs, { ...song, id: Date.now() }] }
}
export function updateSong(state: PresentState, songId: number, song: Omit<Song, 'id'>): PresentState {
  const nextSongs = state.songs.map(existing => (
    existing.id === songId ? { ...song, id: songId } : existing
  ))
  const maxLineIndex = Math.max(0, song.lines.length - 1)
  return {
    ...state,
    songs: nextSongs,
    activeLineIndex: state.activeSongId === songId ? Math.min(state.activeLineIndex, maxLineIndex) : state.activeLineIndex,
  }
}
export function deleteSong(state: PresentState, songId: number): PresentState {
  return {
    ...state,
    songs:        state.songs.filter(s => s.id !== songId),
    activeSongId: state.activeSongId === songId ? null : state.activeSongId,
  }
}

// ── Image helpers ─────────────────────────────────────────────
export function addImage(state: PresentState, image: Omit<SlideImage, 'id'>): PresentState {
  return { ...state, images: [...state.images, { ...image, id: Date.now() }] }
}
export function deleteImage(state: PresentState, imageId: number): PresentState {
  return {
    ...state,
    images:        state.images.filter(i => i.id !== imageId),
    activeImageId: state.activeImageId === imageId ? null : state.activeImageId,
  }
}

// ── Notice helpers ────────────────────────────────────────────
export function addNotice(state: PresentState, notice: Omit<Notice, 'id'>): PresentState {
  return { ...state, notices: [...state.notices, { ...notice, id: Date.now() }] }
}
export function deleteNotice(state: PresentState, noticeId: number): PresentState {
  return {
    ...state,
    notices:        state.notices.filter(n => n.id !== noticeId),
    activeNoticeId: state.activeNoticeId === noticeId ? null : state.activeNoticeId,
  }
}
