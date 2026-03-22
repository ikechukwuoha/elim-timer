import type { PresentState, PresentMode, BibleVerse, Song, SlideImage, Notice } from '@/types'

export const PRESENT_STORAGE_KEY  = 'elim_present_state'
export const PRESENT_CHANNEL_NAME = 'elim_present_channel'

const DEFAULT_SONGS: Song[] = [
  {
    id: 1,
    title: 'Amazing Grace',
    artist: 'John Newton',
    lines: [
      { id: 1, text: 'Amazing grace! How sweet the sound' },
      { id: 2, text: 'That saved a wretch like me' },
      { id: 3, text: 'I once was lost, but now am found' },
      { id: 4, text: "Was blind, but now I see" },
      { id: 5, text: "'Twas grace that taught my heart to fear" },
      { id: 6, text: 'And grace my fears relieved' },
      { id: 7, text: 'How precious did that grace appear' },
      { id: 8, text: 'The hour I first believed' },
    ],
  },
  {
    id: 2,
    title: 'What a Friend We Have in Jesus',
    artist: 'Joseph M. Scriven',
    lines: [
      { id: 1, text: 'What a friend we have in Jesus' },
      { id: 2, text: 'All our sins and griefs to bear' },
      { id: 3, text: 'What a privilege to carry' },
      { id: 4, text: 'Everything to God in prayer' },
      { id: 5, text: 'Oh, what peace we often forfeit' },
      { id: 6, text: 'Oh, what needless pain we bear' },
      { id: 7, text: 'All because we do not carry' },
      { id: 8, text: 'Everything to God in prayer' },
    ],
  },
]

const DEFAULT_NOTICES: Notice[] = [
  {
    id: 1,
    title: 'Welcome',
    body: 'Welcome to Elim Christian Garden International.\nWe are glad you are here today.',
    style: 'default',
  },
]

export const DEFAULT_PRESENT_STATE: PresentState = {
  mode:            'timer',
  activeVerse:     null,
  songs:           DEFAULT_SONGS,
  activeSongId:    null,
  activeLineIndex: 0,
  images:          [],
  activeImageId:   null,
  notices:         DEFAULT_NOTICES,
  activeNoticeId:  null,
}

export function loadPresentState(): PresentState {
  if (typeof window === 'undefined') return DEFAULT_PRESENT_STATE
  try {
    const raw = localStorage.getItem(PRESENT_STORAGE_KEY)
    if (!raw) return DEFAULT_PRESENT_STATE
    const parsed = JSON.parse(raw) as PresentState
    // Always keep default songs/notices if store is empty
    if (!parsed.songs?.length)   parsed.songs   = DEFAULT_SONGS
    if (!parsed.notices?.length) parsed.notices = DEFAULT_NOTICES
    return parsed
  } catch {
    return DEFAULT_PRESENT_STATE
  }
}

export function savePresentState(state: PresentState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PRESENT_STORAGE_KEY, JSON.stringify(state))
  try {
    const bc = new BroadcastChannel(PRESENT_CHANNEL_NAME)
    bc.postMessage({ type: 'PRESENT_UPDATE', state })
    bc.close()
  } catch { /* unavailable */ }
}

// ── Helpers ──────────────────────────────────────────────────

export function setMode(state: PresentState, mode: PresentMode): PresentState {
  return { ...state, mode }
}

export function displayVerse(state: PresentState, verse: BibleVerse): PresentState {
  return { ...state, mode: 'bible', activeVerse: verse }
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

export function displayImage(state: PresentState, imageId: number): PresentState {
  return { ...state, mode: 'image', activeImageId: imageId }
}

export function displayNotice(state: PresentState, noticeId: number): PresentState {
  return { ...state, mode: 'notice', activeNoticeId: noticeId }
}

export function addSong(state: PresentState, song: Omit<Song, 'id'>): PresentState {
  const id = Date.now()
  return { ...state, songs: [...state.songs, { ...song, id }] }
}

export function deleteSong(state: PresentState, songId: number): PresentState {
  return {
    ...state,
    songs:        state.songs.filter(s => s.id !== songId),
    activeSongId: state.activeSongId === songId ? null : state.activeSongId,
  }
}

export function addImage(state: PresentState, image: Omit<SlideImage, 'id'>): PresentState {
  const id = Date.now()
  return { ...state, images: [...state.images, { ...image, id }] }
}

export function deleteImage(state: PresentState, imageId: number): PresentState {
  return {
    ...state,
    images:        state.images.filter(i => i.id !== imageId),
    activeImageId: state.activeImageId === imageId ? null : state.activeImageId,
  }
}

export function addNotice(state: PresentState, notice: Omit<Notice, 'id'>): PresentState {
  const id = Date.now()
  return { ...state, notices: [...state.notices, { ...notice, id }] }
}

export function deleteNotice(state: PresentState, noticeId: number): PresentState {
  return {
    ...state,
    notices:        state.notices.filter(n => n.id !== noticeId),
    activeNoticeId: state.activeNoticeId === noticeId ? null : state.activeNoticeId,
  }
}