'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { TimerState, Activity, TimerColor, PresentState, Song, SongLine, Notice } from '@/types'
import {
  loadState,
  saveAndBroadcast,
  getTimerColor,
  formatTime,
  generateId,
  DEFAULT_STATE,
  computeRemaining,
  getSyncedNow,
  setServerTimeOffset,
} from '@/utils/timerStore'
import {
  loadPresentState, savePresentState, DEFAULT_PRESENT_STATE,
  displayVerse, selectSong, goToLine, displayImage, displayNotice,
  addSong, deleteSong, addImage, deleteImage, addNotice, deleteNotice, setMode,
  addVideo, deleteVideo, displayVideo,
  addPresentation, deletePresentation, displayPresentation,
} from '@/utils/presentStore'
import {
  fetchTranslations, fetchBooks, fetchChapter,
  PRESET_TRANSLATIONS, BOOK_ID_MAP, STANDARD_BOOKS,
} from '@/utils/bibleApi'
import type { BibleTranslation, BibleBook } from '@/utils/bibleApi'

const CHURCH_NAME = 'Elim Christian Garden International'
const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120]
const AUTO_NEXT_BUFFER_SECONDS = 3
const KEYWORD_SEARCH_MAX_RESULTS = 30

// Accepted file types for upload
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo,video/*'
const PRESENTATION_ACCEPT = 'application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,.pdf,.pptx,.ppt,.odp'

type Tab = 'timer' | 'bible' | 'songs' | 'images' | 'media' | 'notices'
type ColorTheme = { bg: string; text: string; border: string; glow: string }

type BibleSearchHit = {
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

const COLOR_MAP: Record<TimerColor, ColorTheme> = {
  green:  { bg: 'linear-gradient(145deg,#052e16,#0a3d1e)', text: '#22c55e', border: '#15803d', glow: 'rgba(34,197,94,0.12)' },
  yellow: { bg: 'linear-gradient(145deg,#292524,#1f1a14)', text: '#fbbf24', border: '#a16207', glow: 'rgba(251,191,36,0.12)' },
  red:    { bg: 'linear-gradient(145deg,#1c0a0a,#2a0e0e)', text: '#f87171', border: '#b91c1c', glow: 'rgba(248,113,113,0.12)' },
}

function levenshtein(a: string, b: string, maxDist = 3): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1
  const m = a.length, n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i; let rowMin = dp[0]
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp; rowMin = Math.min(rowMin, dp[j])
    }
    if (rowMin > maxDist) return maxDist + 1
  }
  return dp[n]
}

function wordMatches(queryWord: string, verseWord: string): boolean {
  if (verseWord.includes(queryWord)) return true
  if (queryWord.length >= 4) {
    const maxDist = queryWord.length <= 6 ? 1 : 2
    if (levenshtein(queryWord, verseWord, maxDist) <= maxDist) return true
  }
  return false
}

function scoreVerse(verseText: string, queryTerms: string[]): { matched: boolean; score: number; matchedTerms: string[] } {
  const lowerText = verseText.toLowerCase()
  const verseWords = lowerText.split(/\W+/).filter(Boolean)
  const matchedTerms: string[] = []
  let score = 0
  for (const term of queryTerms) {
    if (lowerText.includes(term)) { matchedTerms.push(term); score += 10; continue }
    let termMatched = false
    for (const vw of verseWords) {
      if (wordMatches(term, vw)) {
        termMatched = true
        score += vw === term ? 8 : vw.includes(term) ? 6 : 3
        break
      }
    }
    if (termMatched && !matchedTerms.includes(term)) matchedTerms.push(term)
  }
  return { matched: matchedTerms.length > 0, score, matchedTerms }
}

function highlightTerms(text: string, terms: string[]): { text: string; highlight: boolean }[] {
  if (!terms.length) return [{ text, highlight: false }]
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(pattern)
  return parts.map(part => ({
    text: part,
    highlight: terms.some(t => part.toLowerCase().includes(t.toLowerCase()) && t.length >= 2),
  }))
}

function withStartAnchor(p: TimerState, remaining?: number): TimerState {
  const r = remaining ?? p.remaining
  return { ...p, running: true, remaining: r, startedAt: getSyncedNow(), remainingAtStart: r }
}
function withPauseAnchor(p: TimerState, remaining?: number): TimerState {
  return { ...p, running: false, remaining: remaining ?? p.remaining, startedAt: null, remainingAtStart: null }
}

export default function ControlPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('timer')
  const [timerState, setTimerState] = useState<TimerState>(DEFAULT_STATE)
  const [presentState, setPresentState] = useState<PresentState>(DEFAULT_PRESENT_STATE)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [newActName, setNewActName] = useState('')
  const [newActDur, setNewActDur] = useState(15)

  const wsConnected = true

  const [displayRemaining, setDisplayRemaining] = useState<number>(0)
  const timerStateRef = useRef<TimerState>(timerState)
  const rafRef = useRef<number | null>(null)
  const autoNextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoNextScheduledForRef = useRef<number | null>(null)

  // Bible state
  const [translations, setTranslations] = useState<BibleTranslation[]>(PRESET_TRANSLATIONS)
  const [selectedTranslation, setSelectedTranslation] = useState('KJV')
  const [translationSearch, setTranslationSearch] = useState('')
  const [showTranslationList, setShowTranslationList] = useState(false)
  const [books, setBooks] = useState<BibleBook[]>([])
  const [selectedBook, setSelectedBook] = useState('John')
  const [selectedBookId, setSelectedBookId] = useState('43')
  const [bookSearch, setBookSearch] = useState('')
  const [showBookList, setShowBookList] = useState(false)
  const [selectedChapter, setSelectedChapter] = useState(3)
  const [chapterInput, setChapterInput] = useState('3')
  const [chapterVerses, setChapterVerses] = useState<{ verse: number; text: string }[]>([])
  const [bibleLoading, setBibleLoading] = useState(false)
  const [keywordSearch, setKeywordSearch] = useState('')
  const [keywordSearching, setKeywordSearching] = useState(false)
  const [keywordResults, setKeywordResults] = useState<BibleSearchHit[]>([])
  const [keywordSearchError, setKeywordSearchError] = useState('')
  const [keywordSearchProgress, setKeywordSearchProgress] = useState('')
  const [quickRef, setQuickRef] = useState('')
  const [quickRefError, setQuickRefError] = useState('')
  const bibleSearchTokenRef = useRef(0)
  const chapterCacheRef = useRef<Map<string, { verse: number; text: string }[]>>(new Map())

  // Operator notes
  const [operatorNotes, setOperatorNotes] = useState<string>('')
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Monthly report
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear())
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1)
  const [reportRows, setReportRows] = useState<any[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  // Alert scroller
  const [alertMinistersInput, setAlertMinistersInput] = useState('')

  // Song editor
  const [showSongEditor, setShowSongEditor] = useState(false)
  const [newSongTitle, setNewSongTitle] = useState('')
  const [newSongArtist, setNewSongArtist] = useState('')
  const [newSongLyrics, setNewSongLyrics] = useState('')

  // Notice editor
  const [showNoticeEditor, setShowNoticeEditor] = useState(false)
  const [newNoticeTitle, setNewNoticeTitle] = useState('')
  const [newNoticeBody, setNewNoticeBody] = useState('')
  const [newNoticeStyle, setNewNoticeStyle] = useState<Notice['style']>('default')

  // Media tab
  const [googleSlidesUrl, setGoogleSlidesUrl] = useState('')
  const [googleSlidesError, setGoogleSlidesError] = useState('')
  const [mediaUploadProgress, setMediaUploadProgress] = useState('')

  // ── Hydrate ───────────────────────────────────────────────
  useEffect(() => {
    const ts = loadState()
    setTimerState(ts)
    timerStateRef.current = ts
    setDisplayRemaining(Math.floor(computeRemaining(ts)))
    setPresentState(loadPresentState())
    try { setOperatorNotes(localStorage.getItem('elim_op_notes') ?? '') } catch {}
    return () => {}
  }, [])

  useEffect(() => { timerStateRef.current = timerState }, [timerState])

  useEffect(() => {
    setAlertMinistersInput(presentState.alertMinisters.join(', '))
  }, [presentState.alertMinisters])

  const sendTimerLog = async (payload: {
    service: string; plannedSeconds: number; actualSeconds: number;
    overtimeSeconds: number; startedAt: number; endedAt: number; user?: string; notes?: string
  }) => {
    try {
      await fetch('/api/timer/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } catch (e) { console.warn('[API] Timer log failed:', (e as Error).message) }
  }

  const logCurrentService = async (action: string) => {
    if (!timerState.activities || timerState.activities.length === 0) return
    const index = Math.min(timerState.currentIndex, timerState.activities.length - 1)
    const activity = timerState.activities[index]
    if (!activity) return
    const plannedSeconds = activity.duration * 60
    const remaining = timerState.running ? computeRemaining(timerState) : timerState.remaining
    const actualSeconds = Math.max(0, plannedSeconds - Math.max(0, remaining))
    const overtimeSeconds = Math.max(0, actualSeconds - plannedSeconds)
    await sendTimerLog({ service: activity.name, plannedSeconds, actualSeconds, overtimeSeconds, startedAt: timerState.startedAt ?? getSyncedNow(), endedAt: getSyncedNow(), user: 'operator', notes: `${action}${operatorNotes ? ' | ' + operatorNotes : ''}` })
  }

  const saveOperatorNoteToServer = async (note: string) => {
    try { await fetch('/api/operator-note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note, source: 'control' }) }) } catch (e) { console.warn('[API] Operator note failed:', (e as Error).message) }
  }

  const fetchMonthlyReport = async () => {
    setReportLoading(true); setReportError('')
    try {
      const res = await fetch(`/api/timer/report?year=${reportYear}&month=${reportMonth}`, { method: 'GET' })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const data = await res.json()
      setReportRows(Array.isArray(data.report) ? data.report : [])
    } catch (e) { setReportError(`Failed to load report: ${(e as Error).message}`); setReportRows([]) }
    finally { setReportLoading(false) }
  }

  const applyAlertConfig = () => {
    const names = alertMinistersInput.split(/[;,\n]+/).map(x => x.trim()).filter(Boolean)
    updatePresent(p => ({ ...p, alertMinisters: names, alertActive: names.length > 0 ? p.alertActive : false }))
  }

  useEffect(() => {
    let lastShown: number | null = null
    const tick = () => {
      const ts = timerStateRef.current
      if (ts) {
        const floored = Math.floor(computeRemaining(ts))
        if (floored !== lastShown) { lastShown = floored; setDisplayRemaining(floored) }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  useEffect(() => {
    setDisplayRemaining(Math.floor(computeRemaining(timerState)))
  }, [timerState.running, timerState.startedAt, timerState.remainingAtStart, timerState.remaining])

  useEffect(() => {
    if (autoNextTimeoutRef.current) { clearTimeout(autoNextTimeoutRef.current); autoNextTimeoutRef.current = null }
    const currentIdx = timerState.currentIndex
    const lastIdx = timerState.activities.length - 1
    const isLast = currentIdx >= lastIdx
    if (!timerState.running || displayRemaining > 0 || isLast) { autoNextScheduledForRef.current = null; return }
    if (autoNextScheduledForRef.current === currentIdx) return
    autoNextScheduledForRef.current = currentIdx
    autoNextTimeoutRef.current = setTimeout(() => {
      setTimerState(prev => {
        if (!prev.running) return prev
        if (prev.currentIndex !== currentIdx) return prev
        if (Math.floor(computeRemaining(prev)) > 0) return prev
        const nextIdx = prev.currentIndex + 1
        if (nextIdx >= prev.activities.length) {
          const paused = withPauseAnchor(prev, Math.floor(computeRemaining(prev)))
          saveAndBroadcast(paused); timerStateRef.current = paused; return paused
        }
        const nextRemaining = prev.activities[nextIdx].duration * 60
        const nextState = withStartAnchor({ ...prev, currentIndex: nextIdx, remaining: nextRemaining, overtime: false, overtimeSeconds: 0 }, nextRemaining)
        saveAndBroadcast(nextState); timerStateRef.current = nextState; return nextState
      })
    }, AUTO_NEXT_BUFFER_SECONDS * 1000)
    return () => { if (autoNextTimeoutRef.current) { clearTimeout(autoNextTimeoutRef.current); autoNextTimeoutRef.current = null } }
  }, [timerState.running, timerState.currentIndex, timerState.activities, displayRemaining])

  useEffect(() => {
    if (!selectedTranslation) return
    chapterCacheRef.current.clear()
    fetchBooks(selectedTranslation).then(b => {
      setBooks(b)
      if (b.length > 0) {
        const john = b.find(bk => bk.name === 'John') ?? b[0]
        setSelectedBook(john.name); setSelectedBookId(String(john.bookid))
      }
    })
  }, [selectedTranslation])

  useEffect(() => {
    if (!selectedBookId || !selectedTranslation) return
    setBibleLoading(true)
    fetchChapter(selectedTranslation, selectedBookId, selectedChapter, selectedBook)
      .then(ch => {
        const verses = ch ? ch.verses : []
        setChapterVerses(verses)
        chapterCacheRef.current.set(`${selectedTranslation}:${selectedBookId}:${selectedChapter}`, verses)
        setBibleLoading(false)
      })
      .catch(() => setBibleLoading(false))
  }, [selectedTranslation, selectedBookId, selectedChapter, selectedBook])

  async function loadTranslationsData() {
    const data = await fetchTranslations()
    setTranslations(data)
  }

  const updateTimer = useCallback((updater: (prev: TimerState) => TimerState) => {
    setTimerState(prev => { const next = updater(prev); saveAndBroadcast(next); return next })
  }, [])

  const updatePresent = useCallback((updater: (prev: PresentState) => PresentState) => {
    setPresentState(prev => { const next = updater(prev); savePresentState(next); return next })
  }, [])

  // ── Timer actions ─────────────────────────────────────────
  const startPause = () => {
    if (timerState.running) void logCurrentService('pause')
    updateTimer(p => p.running ? withPauseAnchor(p, Math.floor(computeRemaining(p))) : withStartAnchor(p, Math.floor(computeRemaining(p))))
  }
  const goNext = () => {
    if (timerState.running) void logCurrentService('next')
    updateTimer(p => {
      const nextIdx = p.currentIndex + 1
      if (nextIdx >= p.activities.length) return p
      const nextRemaining = p.activities[nextIdx].duration * 60
      return withStartAnchor({ ...p, currentIndex: nextIdx, remaining: nextRemaining, overtime: false, overtimeSeconds: 0 }, nextRemaining)
    })
  }
  const goPrev = () => updateTimer(p => {
    const idx = Math.max(0, p.currentIndex - 1)
    const remaining = p.activities[idx].duration * 60
    return withPauseAnchor({ ...p, currentIndex: idx, overtime: false, overtimeSeconds: 0 }, remaining)
  })
  const resetCurrent = () => updateTimer(p => {
    const remaining = p.activities[p.currentIndex].duration * 60
    return withPauseAnchor({ ...p, overtime: false, overtimeSeconds: 0 }, remaining)
  })
  const resetAll = () => updateTimer(p => {
    const remaining = p.activities[0].duration * 60
    return withPauseAnchor({ ...p, currentIndex: 0, overtime: false, overtimeSeconds: 0 }, remaining)
  })
  const selectActivity = (i: number) => updateTimer(p => {
    const remaining = p.activities[i].duration * 60
    return withPauseAnchor({ ...p, currentIndex: i, overtime: false, overtimeSeconds: 0 }, remaining)
  })
  const addActivity = () => {
    if (!newActName.trim()) return
    updateTimer(p => ({ ...p, activities: [...p.activities, { id: generateId(), name: newActName.trim(), duration: newActDur }] }))
    setNewActName(''); setNewActDur(15)
  }
  const removeActivity = (id: number) => updateTimer(p => {
    const filtered = p.activities.filter(a => a.id !== id)
    if (!filtered.length) return p
    const newIdx = Math.min(p.currentIndex, filtered.length - 1)
    const remaining = filtered[newIdx].duration * 60
    return withPauseAnchor({ ...p, activities: filtered, currentIndex: newIdx, overtime: false, overtimeSeconds: 0 }, remaining)
  })
  const updateDuration = (id: number, duration: number) => {
    updateTimer(p => {
      const activities = p.activities.map((a): Activity => (a.id === id ? { ...a, duration } : a))
      const curIndex = p.currentIndex
      const currentActivity = p.activities[curIndex]
      const isActive = currentActivity?.id === id
      if (!isActive) return { ...p, activities }
      const oldDurationSeconds = (currentActivity.duration || 0) * 60
      const elapsedSeconds = p.running ? Math.max(0, oldDurationSeconds - computeRemaining(p)) : (oldDurationSeconds - p.remaining)
      const newDurationSeconds = Math.max(1, duration * 60)
      const newRemaining = newDurationSeconds - elapsedSeconds
      const nextState = { ...p, activities, currentIndex: curIndex, remaining: newRemaining, overtime: newRemaining < 0, overtimeSeconds: Math.max(0, -newRemaining) }
      return p.running ? withStartAnchor(nextState, newRemaining) : withPauseAnchor(nextState, newRemaining)
    })
    setEditingId(null)
  }

  // ── Bible helpers ─────────────────────────────────────────
  const displayVerseOnScreen = (hit: { book: string; chapter: number; verse: number; text: string; translation?: string; reference?: string }) => {
    updatePresent(p => displayVerse(p, {
      book: hit.book, chapter: hit.chapter, verse: hit.verse, text: hit.text,
      translation: hit.translation ?? selectedTranslation,
      reference: hit.reference ?? `${hit.book} ${hit.chapter}:${hit.verse} (${hit.translation ?? selectedTranslation})`,
    }))
  }

  const filteredTranslations = translationSearch.trim()
    ? translations.filter(t => (t.id || '').toLowerCase().includes(translationSearch.toLowerCase()) || (t.name || '').toLowerCase().includes(translationSearch.toLowerCase()) || (t.language || '').toLowerCase().includes(translationSearch.toLowerCase()))
    : translations

  const filteredBooks = bookSearch.trim()
    ? books.filter(b => b.name.toLowerCase().includes(bookSearch.toLowerCase()))
    : books

  const chapterViewVerses = useMemo(() => chapterVerses, [chapterVerses])

  const handleQuickRef = async () => {
    const raw = quickRef.trim()
    if (!raw) return
    setQuickRefError('')
    const match = raw.match(/^(.+?)\s+(\d+)(?::(\d+))?$/)
    if (!match) { setQuickRefError('Format: Book Chapter:Verse  e.g. John 3:16'); return }
    const bookQuery = match[1].toLowerCase()
    const chapNum = parseInt(match[2], 10)
    const verseNum = match[3] ? parseInt(match[3], 10) : null
    const bookList = books.length > 0 ? books : STANDARD_BOOKS
    const found = bookList.find(b => b.name.toLowerCase().startsWith(bookQuery) || b.name.toLowerCase().includes(bookQuery))
    if (!found) { setQuickRefError(`Book not found: "${match[1]}"`); return }
    setSelectedBook(found.name); setSelectedBookId(String(found.bookid))
    setSelectedChapter(chapNum); setChapterInput(String(chapNum))
    setShowBookList(false); setShowTranslationList(false)
    if (verseNum) {
      setBibleLoading(true)
      const ch = await fetchChapter(selectedTranslation, String(found.bookid), chapNum, found.name)
      if (ch) {
        setChapterVerses(ch.verses)
        chapterCacheRef.current.set(`${selectedTranslation}:${found.bookid}:${chapNum}`, ch.verses)
        setBibleLoading(false)
        const v = ch.verses.find(vs => vs.verse === verseNum)
        if (v) displayVerseOnScreen({ book: found.name, chapter: chapNum, verse: verseNum, text: v.text, translation: selectedTranslation, reference: `${found.name} ${chapNum}:${verseNum} (${selectedTranslation})` })
        else setQuickRefError(`Verse ${verseNum} not found in ${found.name} ${chapNum}`)
      } else { setBibleLoading(false); setQuickRefError('Could not load chapter') }
    }
    setQuickRef('')
  }

  const runKeywordSearch = async () => {
    const raw = keywordSearch.trim()
    if (!raw) { setKeywordResults([]); setKeywordSearchError(''); return }
    const queryTerms = raw.toLowerCase().split(/\s+/).filter(t => t.length >= 2)
    if (!queryTerms.length) { setKeywordSearchError('Please enter at least one word to search'); return }
    const token = Date.now()
    bibleSearchTokenRef.current = token
    setKeywordSearching(true); setKeywordSearchError(''); setKeywordResults([]); setKeywordSearchProgress('Starting search…')
    try {
      const bookList = books.length > 0 ? books : STANDARD_BOOKS
      const hits: BibleSearchHit[] = []
      for (const book of bookList) {
        if (bibleSearchTokenRef.current !== token) return
        setKeywordSearchProgress(`Searching ${book.name}…`)
        const chapters = Math.max(1, book.chapters || 1)
        for (let chapter = 1; chapter <= chapters; chapter++) {
          if (bibleSearchTokenRef.current !== token) return
          const cacheKey = `${selectedTranslation}:${book.bookid}:${chapter}`
          let verses = chapterCacheRef.current.get(cacheKey)
          if (!verses) {
            const ch = await fetchChapter(selectedTranslation, String(book.bookid), chapter, book.name)
            verses = ch?.verses ?? []
            chapterCacheRef.current.set(cacheKey, verses)
          }
          for (const v of verses) {
            const { matched, score, matchedTerms } = scoreVerse(v.text, queryTerms)
            if (matched) hits.push({ book: book.name, bookId: String(book.bookid), chapter, verse: v.verse, text: v.text, translation: selectedTranslation, reference: `${book.name} ${chapter}:${v.verse} (${selectedTranslation})`, score, matchedTerms })
            if (hits.length >= KEYWORD_SEARCH_MAX_RESULTS * 3) break
          }
          if (hits.length >= KEYWORD_SEARCH_MAX_RESULTS * 3) break
        }
        if (hits.length >= KEYWORD_SEARCH_MAX_RESULTS * 3) break
      }
      if (bibleSearchTokenRef.current !== token) return
      hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      const top = hits.slice(0, KEYWORD_SEARCH_MAX_RESULTS)
      setKeywordResults(top); setKeywordSearchProgress('')
      if (top.length === 0) setKeywordSearchError(`No results found for "${raw}". Try a different or shorter word.`)
    } catch {
      if (bibleSearchTokenRef.current === token) setKeywordSearchError('Keyword search failed')
    } finally {
      if (bibleSearchTokenRef.current === token) { setKeywordSearching(false); setKeywordSearchProgress('') }
    }
  }

  const openKeywordHit = async (hit: BibleSearchHit) => {
    setSelectedBook(hit.book); setSelectedBookId(hit.bookId)
    setSelectedChapter(hit.chapter); setChapterInput(String(hit.chapter))
    setKeywordSearchError('')
    const cacheKey = `${selectedTranslation}:${hit.bookId}:${hit.chapter}`
    let verses = chapterCacheRef.current.get(cacheKey)
    if (!verses) {
      const ch = await fetchChapter(selectedTranslation, hit.bookId, hit.chapter, hit.book)
      verses = ch?.verses ?? []
      chapterCacheRef.current.set(cacheKey, verses)
    }
    setChapterVerses(verses)
    displayVerseOnScreen(hit)
  }

  // ── Song actions ──────────────────────────────────────────
  const saveSong = () => {
    if (!newSongTitle.trim() || !newSongLyrics.trim()) return
    const lines: SongLine[] = newSongLyrics.split('\n').filter(l => l.trim()).map((text, i) => ({ id: i + 1, text: text.trim() }))
    updatePresent(p => addSong(p, { title: newSongTitle.trim(), artist: newSongArtist.trim() || undefined, lines }))
    setNewSongTitle(''); setNewSongArtist(''); setNewSongLyrics(''); setShowSongEditor(false)
  }
  const presentSong = (songId: number) => { updatePresent(p => goToLine(selectSong(p, songId), 0)) }
  const songLine = (delta: number) => { updatePresent(p => goToLine(p, p.activeLineIndex + delta)) }

  // ── Image actions ─────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => { const url = ev.target?.result as string; updatePresent(p => addImage(p, { name: file.name, url })) }
      reader.readAsDataURL(file)
    })
  }

  // ── Video actions ─────────────────────────────────────────
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return
    setMediaUploadProgress('Processing video…')
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file)
      updatePresent(p => addVideo(p, { name: file.name, url, type: file.type || 'video/mp4' }))
    })
    setMediaUploadProgress('')
    e.target.value = ''
  }

  // ── Presentation actions ──────────────────────────────────
  const handlePresentationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return
    setMediaUploadProgress('Uploading…')
    for (const file of Array.from(files)) {
      const isPptx = file.name.toLowerCase().endsWith('.pptx') || file.name.toLowerCase().endsWith('.ppt') || file.name.toLowerCase().endsWith('.odp')
      if (isPptx) {
        // Upload to server for conversion to PDF
        const formData = new FormData()
        formData.append('file', file)
        try {
          setMediaUploadProgress(`Converting ${file.name}…`)
          const res = await fetch('/api/convert-presentation', { method: 'POST', body: formData })
          if (res.ok) {
            const data = await res.json()
            updatePresent(p => addPresentation(p, { name: file.name.replace(/\.(pptx?|odp)$/i, '.pdf'), url: data.url, type: 'application/pdf', pageCount: data.pageCount }))
          } else {
            // Fallback: store as blob URL (won't persist across sessions)
            const url = URL.createObjectURL(file)
            updatePresent(p => addPresentation(p, { name: file.name, url, type: file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }))
          }
        } catch {
          const url = URL.createObjectURL(file)
          updatePresent(p => addPresentation(p, { name: file.name, url, type: file.type }))
        }
      } else {
        // PDF: read as data URL so it persists
        const reader = new FileReader()
        reader.onload = ev => {
          const url = ev.target?.result as string
          updatePresent(p => addPresentation(p, { name: file.name, url, type: 'application/pdf' }))
        }
        reader.readAsDataURL(file)
      }
    }
    setMediaUploadProgress('')
    e.target.value = ''
  }

  const addGoogleSlides = () => {
    setGoogleSlidesError('')
    const raw = googleSlidesUrl.trim()
    if (!raw) return
    // Accept share URL or publish/embed URL and convert to embed
    let embedUrl = raw
    if (raw.includes('docs.google.com/presentation')) {
      // Convert /edit, /view, /pub to embed
      embedUrl = raw
        .replace('/edit', '/embed')
        .replace('/view', '/embed')
        .replace('/pub', '/embed')
        .split('?')[0] + '?start=false&loop=false&delayms=3000'
    }
    if (!embedUrl.includes('docs.google.com') && !embedUrl.startsWith('http')) {
      setGoogleSlidesError('Please paste a valid Google Slides URL')
      return
    }
    updatePresent(p => addPresentation(p, {
      name: 'Google Slides',
      url: embedUrl,
      type: 'google-slides',
      embedUrl,
    }))
    setGoogleSlidesUrl('')
  }

  // ── Notice actions ────────────────────────────────────────
  const saveNotice = () => {
    if (!newNoticeTitle.trim()) return
    updatePresent(p => addNotice(p, { title: newNoticeTitle.trim(), body: newNoticeBody.trim(), style: newNoticeStyle }))
    setNewNoticeTitle(''); setNewNoticeBody(''); setNewNoticeStyle('default'); setShowNoticeEditor(false)
  }

  const goBlank = () => updatePresent(p => setMode(p, 'blank'))
  const goTimerMode = () => updatePresent(p => setMode(p, 'timer'))

  // ── Computed ──────────────────────────────────────────────
  const current = timerState.activities[timerState.currentIndex] ?? { name: 'No Activity', duration: 0 }
  const currentSeconds = Math.max(1, current.duration * 60)
  const color = getTimerColor(displayRemaining, currentSeconds)
  const theme = COLOR_MAP[color]
  const pct = Math.max(0, Math.min(100, (displayRemaining / currentSeconds) * 100))
  const totalMins = timerState.activities.reduce((s, a) => s + (a.duration || 0), 0)
  const activeSong = presentState.songs.find(s => s.id === presentState.activeSongId)
  const elapsedMins = timerState.activities.length === 0 ? 0 : Math.round(
    (timerState.activities.slice(0, timerState.currentIndex).reduce((a, b) => a + b.duration, 0) * 60
    + (current.duration * 60 - Math.max(0, displayRemaining))) / 60
  )
  const sessionRemainingMins = Math.max(0, totalMins - elapsedMins)

  const TAB_DEF: { id: Tab; label: string }[] = [
    { id: 'timer', label: '⏱ Timer' },
    { id: 'bible', label: '✝ Bible' },
    { id: 'songs', label: '♪ Songs' },
    { id: 'images', label: '🖼 Images' },
    { id: 'media', label: '🎬 Media' },
    { id: 'notices', label: '📢 Notices' },
  ]

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={s.logoMark}>
            <img src="/church-logo.jpg" alt="Elim Christian Garden International logo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <div>
            <p style={s.churchName}>{CHURCH_NAME}</p>
            <p style={s.subtitle}>Presentation Control Panel</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: wsConnected ? '#4ade80' : '#fbbf24', letterSpacing: '0.08em', background: wsConnected ? 'rgba(34,197,94,0.08)' : 'rgba(251,191,36,0.08)', border: `1px solid ${wsConnected ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)'}`, borderRadius: 20, padding: '5px 12px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', background: wsConnected ? '#4ade80' : '#fbbf24', boxShadow: wsConnected ? '0 0 6px #4ade80' : '0 0 6px #fbbf24' }} />
            {wsConnected ? 'Live' : 'Connecting…'}
          </div>
          <button onClick={goBlank} style={s.headerBtnNeutral}>⬛ Blank</button>
          <button onClick={goTimerMode} style={s.headerBtnGreen}>↩ Show Timer</button>
          <button onClick={() => window.open('/screen', '_blank', `width=${screen.width},height=${screen.height},left=0,top=0`)} style={s.bigScreenBtn}>
            📺 Open Big Screen
          </button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div style={s.tabBar}>
        {TAB_DEF.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ ...s.tab, borderBottom: activeTab === t.id ? '2px solid #22c55e' : '2px solid transparent', color: activeTab === t.id ? '#e2e8f0' : '#64748b', background: activeTab === t.id ? 'rgba(34,197,94,0.05)' : 'transparent' }}>
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, paddingRight: 16 }}>
          <span style={{ fontSize: 11, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>On screen:</span>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 16px', borderRadius: 20, letterSpacing: '0.1em', background: presentState.mode === 'timer' ? 'rgba(34,197,94,0.12)' : presentState.mode === 'blank' ? 'rgba(100,116,139,0.12)' : 'rgba(59,130,246,0.12)', color: presentState.mode === 'timer' ? '#4ade80' : presentState.mode === 'blank' ? '#64748b' : '#93c5fd', border: `1px solid ${presentState.mode === 'timer' ? 'rgba(34,197,94,0.25)' : presentState.mode === 'blank' ? 'rgba(100,116,139,0.25)' : 'rgba(59,130,246,0.25)'}`, textTransform: 'uppercase' }}>
            {presentState.mode === 'timer' ? '● ' : presentState.mode === 'blank' ? '' : '▶ '}{presentState.mode.toUpperCase()}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={s.content}>

        {/* ══ TIMER TAB ══ */}
        {activeTab === 'timer' && (
          <div style={s.twoCol}>
            <aside style={s.left}>
              <div style={{ ...s.timerCard, background: theme.bg, borderColor: theme.border, boxShadow: `0 0 24px ${theme.glow}` }}>
                <p style={s.activityLabel}>{current.name}</p>
                <p style={{ ...s.clockDisplay, color: theme.text }}>{formatTime(displayRemaining)}</p>
                {displayRemaining < 0 && (<p style={{ color: '#f87171', fontSize: 11, textAlign: 'center', marginTop: 4, letterSpacing: '0.2em', fontWeight: 700 }}>OVERTIME</p>)}
                <p style={s.clockMeta}>Activity {timerState.currentIndex + 1} of {timerState.activities.length} · {current.duration} min</p>
                <div style={s.progressTrack}>
                  <div style={{ ...s.progressFill, width: `${pct}%`, background: `linear-gradient(90deg, ${theme.text}99, ${theme.text})` }} />
                </div>
                <div style={s.legend}>
                  <span style={{ color: '#22c55e' }}>● Plenty</span>
                  <span style={{ color: '#fbbf24' }}>● Almost</span>
                  <span style={{ color: '#f87171' }}>● Up</span>
                </div>
              </div>

              <div style={s.controlRow}>
                <button onClick={goPrev} style={s.ctrlBtn}>◀ Prev</button>
                <button onClick={startPause} style={{ ...s.ctrlBtn, ...s.primaryBtn, background: timerState.running ? 'linear-gradient(135deg,#991b1b,#7f1d1d)' : 'linear-gradient(135deg,#166534,#14532d)', borderColor: timerState.running ? '#7f1d1d' : '#14532d', boxShadow: timerState.running ? '0 2px 12px rgba(153,27,27,0.3)' : '0 2px 12px rgba(22,101,52,0.3)' }}>
                  {timerState.running ? '⏸ Pause' : '▶ Start'}
                </button>
                <button onClick={goNext} style={s.ctrlBtn}>Next ▶</button>
              </div>
              <div style={s.controlRow}>
                <button onClick={resetCurrent} style={s.ctrlBtn}>↺ Reset</button>
                <button onClick={resetAll} style={{ ...s.ctrlBtn, color: '#f87171', borderColor: '#7f1d1d', background: 'rgba(153,27,27,0.1)' }}>⬛ Reset All</button>
              </div>

              <div style={s.summaryCard}>
                {([['Total', `${totalMins} min`], ['Activities', String(timerState.activities.length)], ['Status', timerState.running ? `● LIVE · Auto-next ${AUTO_NEXT_BUFFER_SECONDS}s` : '● Paused']] as [string, string][]).map(([l, v]) => (
                  <div key={l} style={s.summaryRow}>
                    <span style={{ color: '#64748b' }}>{l}</span>
                    <span style={{ color: l === 'Status' ? (timerState.running ? '#4ade80' : '#64748b') : '#e2e8f0' }}>{v}</span>
                  </div>
                ))}
              </div>
            </aside>

            <main style={{ ...s.right, gap: 14 }}>
              {/* Hero ring card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, background: '#141418', border: '1px solid #1e1e24', borderRadius: 14, padding: 20, flexShrink: 0 }}>
                <div style={{ position: 'relative', width: 118, height: 118, flexShrink: 0 }}>
                  <svg width="118" height="118" viewBox="0 0 118 118" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="59" cy="59" r="50" fill="none" strokeWidth="7" stroke="rgba(255,255,255,0.05)" />
                    <circle cx="59" cy="59" r="50" fill="none" strokeWidth="7" strokeLinecap="round" stroke={theme.text} strokeDasharray="314" strokeDashoffset={String((314 * (1 - pct / 100)).toFixed(1))} style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.6s' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-bebas), cursive', fontSize: 28, color: theme.text, lineHeight: 1, letterSpacing: '0.04em', transition: 'color 0.6s' }}>{formatTime(displayRemaining)}</span>
                    <span style={{ fontSize: 9, color: '#475569', letterSpacing: '0.18em', marginTop: 3, textTransform: 'uppercase' }}>remaining</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 5 }}>Now Playing</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 10 }}>{current.name}</p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 600, letterSpacing: '0.06em', background: timerState.running ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', color: timerState.running ? '#4ade80' : '#64748b', border: `1px solid ${timerState.running ? 'rgba(34,197,94,0.25)' : 'rgba(100,116,139,0.2)'}` }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: timerState.running ? '#4ade80' : '#475569', display: 'inline-block' }} />
                    {timerState.running ? 'Live' : 'Paused'}
                  </span>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', marginTop: 12, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: `linear-gradient(90deg,${theme.text}70,${theme.text})`, transition: 'width 0.9s linear, background 0.6s' }} />
                  </div>
                  <p style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>{current.duration} min allocated · item {timerState.currentIndex + 1} of {timerState.activities.length}</p>
                </div>
              </div>

              {/* Session stats */}
              <div style={{ background: '#141418', border: '1px solid #1e1e24', borderRadius: 12, padding: '16px 18px', flexShrink: 0 }}>
                <p style={{ ...s.sectionTitle, marginBottom: 12 }}>Session Overview</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                  {([['Elapsed', `${elapsedMins}m`, '#64748b'], ['Remaining', `${sessionRemainingMins}m`, '#e2e8f0'], ['Items Done', `${timerState.currentIndex} / ${timerState.activities.length}`, '#94a3b8'], ['Total', `${totalMins}m`, '#475569']] as [string, string, string][]).map(([label, value, col]) => (
                    <div key={label} style={{ background: '#0f0f11', border: '1px solid #1e1e24', borderRadius: 9, padding: '10px 12px' }}>
                      <p style={{ fontSize: 18, fontWeight: 700, color: col, lineHeight: 1 }}>{value}</p>
                      <p style={{ fontSize: 10, color: '#334155', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 2, height: 5, borderRadius: 3, overflow: 'hidden' }}>
                  {timerState.activities.map((a, i) => (
                    <div key={a.id} style={{ flex: a.duration, borderRadius: 2, background: i < timerState.currentIndex ? 'rgba(34,197,94,0.35)' : i === timerState.currentIndex ? theme.text : 'rgba(255,255,255,0.05)', transition: 'background 0.5s' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: '#334155' }}>Start</span>
                  <span style={{ fontSize: 10, color: '#334155' }}>{totalMins} min</span>
                </div>
              </div>

              {/* Programme + Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1, minHeight: 0 }}>
                {/* Programme */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={s.sectionTitle}>Programme</p>
                  </div>

                  {/* ── NEW ACTIVITY ROW — full width inputs ── */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="New activity name…"
                      value={newActName}
                      onChange={e => setNewActName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addActivity()}
                      style={{ ...s.addInput, flex: 1, minWidth: 0 }}
                    />
                    <select
                      value={newActDur}
                      onChange={e => setNewActDur(Number(e.target.value))}
                      style={{ ...s.addSelect, flexShrink: 0, width: 68 }}
                    >
                      {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}m</option>)}
                    </select>
                    <button onClick={addActivity} style={{ ...s.addBtn, flexShrink: 0, padding: '8px 14px' }}>+</button>
                  </div>

                  <div style={{ ...s.activityList, flex: 1, overflowY: 'auto' }}>
                    {timerState.activities.map((activity, index) => {
                      const isActive = index === timerState.currentIndex
                      const isPast = index < timerState.currentIndex
                      return (
                        <div key={activity.id} role="button" tabIndex={0}
                          onClick={() => selectActivity(index)}
                          onKeyDown={e => e.key === 'Enter' && selectActivity(index)}
                          style={{ ...s.activityRow, background: isActive ? 'linear-gradient(135deg,#1e3a2a,#172d20)' : isPast ? '#141414' : '#1c1c1e', borderColor: isActive ? '#166534' : '#252528', opacity: isPast ? 0.45 : 1, boxShadow: isActive ? `0 2px 12px ${theme.glow}` : 'none' }}>
                          <span style={{ ...s.indexBadge, background: isActive ? theme.text : isPast ? 'transparent' : '#252528', color: isActive ? '#000' : isPast ? '#334155' : '#4a4a55' }}>
                            {isPast ? '✓' : isActive ? '▶' : index + 1}
                          </span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: isActive ? '#fff' : '#a1a1aa' }}>{activity.name}</span>
                          {editingId === activity.id ? (
                            <select defaultValue={activity.duration} autoFocus
                              onBlur={e => updateDuration(activity.id, Number(e.target.value))}
                              onChange={e => updateDuration(activity.id, Number(e.target.value))}
                              onClick={e => e.stopPropagation()} style={s.durationSelect}>
                              {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}m</option>)}
                            </select>
                          ) : (
                            <span style={s.durationBadge} title="Click to edit" onClick={e => { e.stopPropagation(); setEditingId(activity.id) }}>{activity.duration}m</span>
                          )}
                          <button onClick={e => { e.stopPropagation(); removeActivity(activity.id) }} style={s.removeBtn}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Operator Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={s.sectionTitle}>Operator Notes</p>
                    <span style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: '2px 8px' }}>Local only</span>
                  </div>
                  <textarea
                    value={operatorNotes}
                    onChange={e => {
                      const val = e.target.value
                      setOperatorNotes(val)
                      if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current)
                      notesSaveTimerRef.current = setTimeout(() => { try { localStorage.setItem('elim_op_notes', val) } catch {} }, 400)
                    }}
                    onBlur={() => { if (operatorNotes.trim()) saveOperatorNoteToServer(operatorNotes.trim()) }}
                    placeholder={'Jot cues, timing notes, or last-minute changes here…\n\nThis is only visible to you — not broadcast to the screen.'}
                    style={{ flex: 1, background: '#161618', border: '1px solid #252528', borderRadius: 10, padding: '11px 13px', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.7, outline: 'none', resize: 'none', minHeight: 160 }}
                  />
                  <p style={{ ...s.sectionTitle, marginTop: 4 }}>Quick Cues</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[['🎵 Music Cue', 'Music cue →'], ['🎤 Mic Check', 'Mic check needed'], ['⏩ Speed Up', 'Speed up — running long'], ['🔇 Mute', 'Mute now'], ['💡 Lights', 'Adjust lighting'], ['📢 Announcement', 'Announcement coming up']].map(([label, note]) => (
                      <button key={label} onClick={() => {
                        const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        const val = operatorNotes ? `${operatorNotes}\n[${ts}] ${note}` : `[${ts}] ${note}`
                        setOperatorNotes(val); try { localStorage.setItem('elim_op_notes', val) } catch {}
                      }} style={{ background: '#1c1c1e', border: '1px solid #252528', borderRadius: 8, padding: '7px 8px', fontSize: 11, color: '#64748b', cursor: 'pointer', textAlign: 'left' }}>{label}</button>
                    ))}
                  </div>
                  <button onClick={() => { setOperatorNotes(''); try { localStorage.removeItem('elim_op_notes') } catch {} }} style={{ background: 'rgba(153,27,27,0.08)', border: '1px solid #7f1d1d', borderRadius: 8, padding: '6px 0', fontSize: 11, color: '#f87171', cursor: 'pointer' }}>Clear notes</button>

                  {/* Alert scroller */}
                  <div style={{ borderTop: '1px solid #1e1e24', paddingTop: 10, marginTop: 10 }}>
                    <p style={s.sectionTitle}>Alert Scroller</p>
                    <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, marginTop: 6 }}>Minister names (comma/line-separated)</label>
                    <textarea value={alertMinistersInput} onChange={e => setAlertMinistersInput(e.target.value)} placeholder="Pastor A, Deacon B, Sister C" style={{ width: '100%', minHeight: 60, background: '#161618', border: '1px solid #252528', borderRadius: 8, padding: '8px', color: '#e2e8f0', fontSize: 12, boxSizing: 'border-box' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                      <select value={presentState.alertPosition} onChange={e => updatePresent(p => ({ ...p, alertPosition: e.target.value as 'top' | 'bottom' }))} style={s.fullSelect}>
                        <option value="top">Position: Top</option>
                        <option value="bottom">Position: Bottom</option>
                      </select>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type="number" min={1} value={presentState.alertRepeats} onChange={e => updatePresent(p => ({ ...p, alertRepeats: Math.max(1, Number(e.target.value) || 1) }))} style={{ ...s.addInput, width: 76 }} />
                        <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>repeats</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button onClick={applyAlertConfig} style={{ ...s.addBtn, flex: 1, fontSize: 12, padding: '6px 0' }}>Apply Alert</button>
                      <button onClick={() => updatePresent(p => ({ ...p, alertActive: !p.alertActive }))} style={{ ...s.ctrlBtn, fontSize: 12, padding: '6px 0' }}>{presentState.alertActive ? 'Disable Alert' : 'Enable Alert'}</button>
                    </div>
                  </div>

                  {/* Monthly report */}
                  <div style={{ borderTop: '1px solid #1e1e24', paddingTop: 10, marginTop: 10 }}>
                    <p style={s.sectionTitle}>Monthly Overtime Report</p>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                      <input type="number" min={2020} max={2099} value={reportYear} onChange={e => setReportYear(Number(e.target.value) || new Date().getFullYear())} style={{ ...s.addInput, width: 86 }} />
                      <input type="number" min={1} max={12} value={reportMonth} onChange={e => setReportMonth(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} style={{ ...s.addInput, width: 56 }} />
                      <button onClick={fetchMonthlyReport} style={{ ...s.addBtn, padding: '6px 10px', fontSize: 12 }}>{reportLoading ? 'Loading…' : 'Generate'}</button>
                    </div>
                    {reportError && <p style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>{reportError}</p>}
                    {reportRows.length > 0 && (
                      <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto', border: '1px solid #1e1e24', borderRadius: 8, padding: 8, background: '#0f1116' }}>
                        {reportRows.map((row, idx) => (
                          <div key={`${row.service}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, padding: '5px 0', borderBottom: idx + 1 < reportRows.length ? '1px solid #16161d' : 'none', fontSize: 11 }}>
                            <span>{row.service}</span><span>{row.sessions} sessions</span>
                            <span>Overtime {Math.round(row.total_overtime_seconds / 60)}m</span>
                            <span>Avg {Math.round(row.average_overtime_seconds)}s</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </main>
          </div>
        )}

        {/* ══ BIBLE TAB ══ */}
        {activeTab === 'bible' && (
          <div style={s.twoCol}>
            <aside style={{ ...s.left, gap: 10 }}>
              <div style={s.livePanel}>
                <div style={s.livePanelHeader}>
                  <span style={s.livePanelTag}>On Screen</span>
                  <button onClick={goTimerMode} style={s.miniActionBtn}>Show Timer</button>
                </div>
                {presentState.activeVerse ? (
                  <><p style={s.livePanelRef}>{presentState.activeVerse.reference}</p><p style={s.livePanelText}>{presentState.activeVerse.text}</p></>
                ) : (<p style={s.livePanelEmpty}>No scripture is currently live on the screen.</p>)}
              </div>
              <p style={s.sectionTitle}>Quick Reference</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" placeholder="e.g. John 3:16 or Romans 8" value={quickRef} onChange={e => { setQuickRef(e.target.value); setQuickRefError('') }} onKeyDown={e => e.key === 'Enter' && handleQuickRef()} style={{ ...s.addInput, flex: 1 }} />
                <button onClick={handleQuickRef} style={{ ...s.addBtn, padding: '8px 14px', flexShrink: 0 }}>Go</button>
              </div>
              {quickRefError && <p style={{ fontSize: 11, color: '#f87171', marginTop: -4 }}>{quickRefError}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={s.sectionTitle}>Keyword Search</p>
                <span style={{ fontSize: 10, color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '2px 8px', letterSpacing: '0.06em' }}>FUZZY</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" placeholder="Type any word or phrase…" value={keywordSearch} onChange={e => { setKeywordSearch(e.target.value); setKeywordSearchError(''); if (!e.target.value.trim()) { setKeywordResults([]); setKeywordSearchProgress('') } }} onKeyDown={e => e.key === 'Enter' && void runKeywordSearch()} style={{ ...s.addInput, flex: 1 }} />
                <button onClick={() => void runKeywordSearch()} style={{ ...s.addBtn, padding: '8px 14px', flexShrink: 0 }} disabled={keywordSearching}>{keywordSearching ? '…' : 'Search'}</button>
              </div>
              {keywordSearchProgress && !keywordSearchError && (<p style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />{keywordSearchProgress}</p>)}
              {keywordSearchError && <p style={{ fontSize: 11, color: '#f87171' }}>{keywordSearchError}</p>}
              <p style={{ fontSize: 10, color: '#475569', marginTop: -4 }}>Partial words, typos, and multi-word queries all work</p>
              <div style={s.compactControlGrid}>
                <div>
                  <div style={s.compactLabelRow}>
                    <p style={s.sectionTitle}>Translation</p>
                    {translations.length <= 16 && <button onClick={loadTranslationsData} style={s.linkBtn}>Load all ↓</button>}
                  </div>
                  <input type="text" placeholder="KJV, NIV…" value={translationSearch} onChange={e => { setTranslationSearch(e.target.value); setShowTranslationList(true) }} onFocus={() => setShowTranslationList(true)} onBlur={() => setTimeout(() => setShowTranslationList(false), 200)} style={s.compactInput} />
                  {!showTranslationList && (<div style={s.compactSelected}><span style={{ fontWeight: 700 }}>{selectedTranslation}</span><span style={{ color: '#93c5fd', fontSize: 11 }}>{translations.find(t => t.id === selectedTranslation)?.name ?? ''}</span></div>)}
                  {showTranslationList && (<div style={s.compactList}>{filteredTranslations.slice(0, 100).map((t, i) => (<div key={`${t.id}-${i}`} onMouseDown={() => { setSelectedTranslation(t.id); setTranslationSearch(''); setShowTranslationList(false) }} style={{ ...s.compactListItem, background: t.id === selectedTranslation ? '#1e3a2a' : 'transparent', color: t.id === selectedTranslation ? '#22c55e' : '#cbd5e1' }}><span style={{ fontWeight: 700, minWidth: 42, color: t.id === selectedTranslation ? '#22c55e' : '#e2e8f0' }}>{t.id}</span><span style={{ flex: 1, color: '#64748b', fontSize: 11 }}>{t.name}</span></div>))}</div>)}
                </div>
                <div>
                  <p style={s.sectionTitle}>Book</p>
                  <input type="text" placeholder="Search book…" value={bookSearch} onChange={e => { setBookSearch(e.target.value); setShowBookList(true) }} onFocus={() => setShowBookList(true)} onBlur={() => setTimeout(() => setShowBookList(false), 200)} style={s.compactInput} />
                  {!showBookList && (<div style={{ ...s.compactSelected, color: '#22c55e', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>{selectedBook}</div>)}
                  {showBookList && (<div style={s.compactList}>{(filteredBooks.length > 0 ? filteredBooks : Object.entries(BOOK_ID_MAP).filter(([n]) => !bookSearch || n.toLowerCase().includes(bookSearch.toLowerCase())).map(([name, numId]) => ({ bookid: parseInt(numId, 10), name, chapters: 0 }))).map(b => (<div key={b.bookid} onMouseDown={() => { setSelectedBook(b.name); setSelectedBookId(String(b.bookid)); setSelectedChapter(1); setChapterInput('1'); setBookSearch(''); setShowBookList(false) }} style={{ ...s.compactListItem, background: String(b.bookid) === selectedBookId ? '#1e3a2a' : 'transparent', color: String(b.bookid) === selectedBookId ? '#22c55e' : '#cbd5e1' }}>{b.name}</div>))}</div>)}
                </div>
              </div>
              <p style={s.sectionTitle}>Chapter</p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => { const n = Math.max(1, selectedChapter - 1); setSelectedChapter(n); setChapterInput(String(n)) }} style={{ ...s.ctrlBtn, flex: 'none', width: 40, padding: '8px 0' }}>◀</button>
                <input type="number" min="1" value={chapterInput} onChange={e => setChapterInput(e.target.value)} onBlur={() => { const n = Math.max(1, parseInt(chapterInput, 10) || 1); setSelectedChapter(n); setChapterInput(String(n)) }} onKeyDown={e => { if (e.key === 'Enter') { const n = Math.max(1, parseInt(chapterInput, 10) || 1); setSelectedChapter(n); setChapterInput(String(n)) } }} style={{ ...s.addInput, flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 600 }} />
                <button onClick={() => { const n = selectedChapter + 1; setSelectedChapter(n); setChapterInput(String(n)) }} style={{ ...s.ctrlBtn, flex: 'none', width: 40, padding: '8px 0' }}>▶</button>
              </div>
              {keywordResults.length > 0 && (
                <>
                  <div style={s.resultHeaderRow}><p style={s.sectionTitle}>Search Results</p><span style={s.resultCount}>{keywordResults.length} found · sorted by relevance</span></div>
                  <div style={s.keywordResultsBox}>
                    {keywordResults.map((hit, idx) => {
                      const isActive = presentState.activeVerse?.book === hit.book && presentState.activeVerse?.chapter === hit.chapter && presentState.activeVerse?.verse === hit.verse
                      const segments = highlightTerms(hit.text, hit.matchedTerms ?? [])
                      return (
                        <div key={`${hit.bookId}-${hit.chapter}-${hit.verse}-${idx}`} role="button" tabIndex={0} onClick={() => void openKeywordHit(hit)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void openKeywordHit(hit) } }} style={{ ...s.keywordResultRow, borderColor: isActive ? '#1e40af' : '#252528', background: isActive ? 'linear-gradient(135deg,#16233f,#0f1a30)' : '#1c1c1e', cursor: 'pointer' }} title="Click to display this verse">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={s.keywordResultRef}>{hit.reference}</p>
                            <p style={s.keywordResultText}>{segments.map((seg, si) => seg.highlight ? <mark key={si} style={{ background: 'rgba(251,191,36,0.25)', color: '#fde68a', borderRadius: 3, padding: '0 2px' }}>{seg.text}</mark> : <span key={si}>{seg.text}</span>)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </aside>
            <main style={s.right}>
              <p style={s.sectionTitle}>{selectedBook} {selectedChapter} — {chapterViewVerses.length} verse{chapterViewVerses.length !== 1 ? 's' : ''}{bibleLoading && <span style={{ color: '#475569', marginLeft: 8 }}>Loading…</span>}</p>
              <div style={{ ...s.activityList, gap: 4 }}>
                {chapterViewVerses.map(v => {
                  const isActive = presentState.activeVerse?.verse === v.verse && presentState.activeVerse?.book === selectedBook && presentState.activeVerse?.chapter === selectedChapter
                  return (
                    <div key={v.verse} role="button" tabIndex={0} onClick={() => displayVerseOnScreen({ book: selectedBook, chapter: selectedChapter, verse: v.verse, text: v.text, translation: selectedTranslation, reference: `${selectedBook} ${selectedChapter}:${v.verse} (${selectedTranslation})` })} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); displayVerseOnScreen({ book: selectedBook, chapter: selectedChapter, verse: v.verse, text: v.text, translation: selectedTranslation, reference: `${selectedBook} ${selectedChapter}:${v.verse} (${selectedTranslation})` }) } }} style={{ ...s.activityRow, background: isActive ? 'linear-gradient(135deg,#1e3a5f,#162d4a)' : '#1c1c1e', borderColor: isActive ? '#1e40af' : '#252528', cursor: 'pointer', alignItems: 'flex-start', boxShadow: isActive ? '0 2px 12px rgba(30,64,175,0.2)' : 'none' }} title="Click to display this verse on screen">
                      <span style={{ ...s.indexBadge, background: isActive ? '#3b82f6' : '#252528', color: isActive ? '#fff' : '#4a4a55', flexShrink: 0, marginTop: 2 }}>{v.verse}</span>
                      <span style={{ flex: 1, fontSize: 13, color: isActive ? '#fff' : '#94a3b8', lineHeight: 1.65 }}>{v.text}</span>
                    </div>
                  )
                })}
                {!bibleLoading && chapterViewVerses.length === 0 && (<p style={{ color: '#334155', textAlign: 'center', padding: 40 }}>No verses found</p>)}
              </div>
            </main>
          </div>
        )}

        {/* ══ SONGS TAB ══ */}
        {activeTab === 'songs' && (
          <div style={s.twoCol}>
            <aside style={{ ...s.left, gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={s.sectionTitle}>Song Library</p>
                <button onClick={() => setShowSongEditor(v => !v)} style={{ ...s.addBtn, padding: '6px 14px', fontSize: 12 }}>{showSongEditor ? 'Cancel' : '+ New Song'}</button>
              </div>
              {showSongEditor && (
                <div style={s.editorCard}>
                  <input type="text" placeholder="Song title *" value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)} style={s.addInput} />
                  <input type="text" placeholder="Artist (optional)" value={newSongArtist} onChange={e => setNewSongArtist(e.target.value)} style={s.addInput} />
                  <textarea placeholder="Paste lyrics here — one line per row…" value={newSongLyrics} onChange={e => setNewSongLyrics(e.target.value)} style={{ ...s.addInput, height: 140, resize: 'vertical' }} />
                  <button onClick={saveSong} style={s.addBtn}>Save Song</button>
                </div>
              )}
              <div style={s.activityList}>
                {presentState.songs.map(song => {
                  const isActive = song.id === presentState.activeSongId && presentState.mode === 'song'
                  return (
                    <div key={song.id} style={{ ...s.activityRow, background: isActive ? 'linear-gradient(135deg,#1e3a2a,#172d20)' : '#1c1c1e', borderColor: isActive ? '#166534' : '#252528', flexDirection: 'column', alignItems: 'flex-start', gap: 4, cursor: 'default', boxShadow: isActive ? '0 2px 12px rgba(22,101,52,0.2)' : 'none' }}>
                      <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isActive ? '#4ade80' : '#e2e8f0' }}>{song.title}</span>
                        <button onClick={() => presentSong(song.id)} style={{ ...s.addBtn, padding: '5px 12px', fontSize: 12 }}>Present</button>
                        <button onClick={() => updatePresent(p => deleteSong(p, song.id))} style={s.removeBtn}>✕</button>
                      </div>
                      {song.artist && <p style={{ fontSize: 12, color: '#475569' }}>{song.artist}</p>}
                      <p style={{ fontSize: 11, color: '#334155' }}>{song.lines.length} lines</p>
                    </div>
                  )
                })}
              </div>
            </aside>
            <main style={s.right}>
              {activeSong && presentState.mode === 'song' ? (
                <>
                  <p style={s.sectionTitle}>{activeSong.title} — Line {presentState.activeLineIndex + 1} of {activeSong.lines.length}</p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button onClick={() => songLine(-1)} style={{ ...s.ctrlBtn, flex: 1 }} disabled={presentState.activeLineIndex === 0}>◀ Prev Line</button>
                    <button onClick={() => songLine(1)} style={{ ...s.ctrlBtn, flex: 1 }} disabled={presentState.activeLineIndex >= activeSong.lines.length - 1}>Next Line ▶</button>
                  </div>
                  <div style={s.activityList}>
                    {activeSong.lines.map((line, idx) => {
                      const isActive = idx === presentState.activeLineIndex
                      return (
                        <div key={line.id} role="button" tabIndex={0} onClick={() => updatePresent(p => goToLine(p, idx))} onKeyDown={e => e.key === 'Enter' && updatePresent(p => goToLine(p, idx))} style={{ ...s.activityRow, background: isActive ? 'linear-gradient(135deg,#1e3a2a,#172d20)' : '#1c1c1e', borderColor: isActive ? '#166534' : '#252528' }}>
                          <span style={{ ...s.indexBadge, background: isActive ? '#22c55e' : '#252528', color: isActive ? '#000' : '#4a4a55' }}>{idx + 1}</span>
                          <span style={{ flex: 1, fontSize: 13, color: isActive ? '#fff' : '#94a3b8' }}>{line.text}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (<div style={s.emptyState}><p style={{ fontSize: 32 }}>♪</p><p style={{ fontSize: 14 }}>Select a song and press Present</p></div>)}
            </main>
          </div>
        )}

        {/* ══ IMAGES TAB ══ */}
        {activeTab === 'images' && (
          <div style={s.twoCol}>
            <aside style={{ ...s.left, gap: 12 }}>
              <p style={s.sectionTitle}>Upload Images</p>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '28px 16px', border: '2px dashed #252528', borderRadius: 10, cursor: 'pointer', color: '#475569', fontSize: 13, background: '#161618' }}>
                <span style={{ fontSize: 28 }}>🖼</span>
                <span style={{ color: '#94a3b8' }}>Click to upload images</span>
                <span style={{ fontSize: 11, color: '#475569' }}>PNG, JPG, GIF, WEBP supported</span>
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
              </label>
              <p style={{ fontSize: 11, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 8 }}>{presentState.images.length} image{presentState.images.length !== 1 ? 's' : ''} uploaded</p>
            </aside>
            <main style={s.right}>
              <p style={s.sectionTitle}>Image Library</p>
              {presentState.images.length === 0 ? (
                <div style={s.emptyState}><p style={{ fontSize: 32 }}>🖼</p><p style={{ fontSize: 14 }}>No images uploaded yet</p></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {presentState.images.map(img => {
                    const isActive = img.id === presentState.activeImageId && presentState.mode === 'image'
                    return (
                      <div key={img.id} style={{ border: `2px solid ${isActive ? '#3b82f6' : '#252528'}`, borderRadius: 10, overflow: 'hidden', background: '#1c1c1e', position: 'relative', cursor: 'pointer', boxShadow: isActive ? '0 2px 16px rgba(59,130,246,0.25)' : 'none' }}>
                        <img src={img.url} alt={img.name} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} onClick={() => updatePresent(p => displayImage(p, img.id))} />
                        <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ flex: 1, fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</span>
                          <button onClick={() => updatePresent(p => deleteImage(p, img.id))} style={s.removeBtn}>✕</button>
                        </div>
                        {isActive && <div style={{ position: 'absolute', top: 6, right: 6, background: '#3b82f6', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>LIVE</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </main>
          </div>
        )}

        {/* ══ MEDIA TAB (Videos + Presentations) ══ */}
        {activeTab === 'media' && (
          <div style={s.twoCol}>
            <aside style={{ ...s.left, gap: 14 }}>

              {/* ── Video upload ── */}
              <p style={s.sectionTitle}>Upload Video</p>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 16px', border: '2px dashed #252528', borderRadius: 10, cursor: 'pointer', background: '#161618' }}>
                <span style={{ fontSize: 28 }}>🎬</span>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Click to upload video</span>
                <span style={{ fontSize: 11, color: '#475569' }}>MP4, WebM, MOV, AVI supported</span>
                <input type="file" accept={VIDEO_ACCEPT} multiple onChange={handleVideoUpload} style={{ display: 'none' }} />
              </label>

              {/* ── Presentation upload ── */}
              <p style={{ ...s.sectionTitle, marginTop: 4 }}>Upload Presentation</p>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 16px', border: '2px dashed #252528', borderRadius: 10, cursor: 'pointer', background: '#161618' }}>
                <span style={{ fontSize: 28 }}>📊</span>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Click to upload presentation</span>
                <span style={{ fontSize: 11, color: '#475569' }}>PDF (native) · PPTX/PPT/ODP (converted server-side)</span>
                <input type="file" accept={PRESENTATION_ACCEPT} multiple onChange={handlePresentationUpload} style={{ display: 'none' }} />
              </label>
              {mediaUploadProgress && (
                <p style={{ fontSize: 12, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />{mediaUploadProgress}
                </p>
              )}

              {/* ── Google Slides ── */}
              <div style={{ borderTop: '1px solid #1e1e24', paddingTop: 14 }}>
                <p style={s.sectionTitle}>Google Slides</p>
                <p style={{ fontSize: 11, color: '#475569', marginTop: 4, marginBottom: 8, lineHeight: 1.5 }}>
                  Paste a Google Slides share or publish link. Make sure sharing is set to <em style={{ color: '#94a3b8' }}>Anyone with the link</em>.
                </p>
                <input
                  type="text"
                  placeholder="https://docs.google.com/presentation/d/…"
                  value={googleSlidesUrl}
                  onChange={e => { setGoogleSlidesUrl(e.target.value); setGoogleSlidesError('') }}
                  onKeyDown={e => e.key === 'Enter' && addGoogleSlides()}
                  style={{ ...s.addInput, width: '100%', boxSizing: 'border-box', marginBottom: 6 }}
                />
                {googleSlidesError && <p style={{ fontSize: 11, color: '#f87171', marginBottom: 6 }}>{googleSlidesError}</p>}
                <button onClick={addGoogleSlides} style={{ ...s.addBtn, width: '100%', boxSizing: 'border-box' }}>Add Google Slides</button>
              </div>

              <div style={{ fontSize: 11, color: '#334155', background: '#141418', border: '1px solid #1e1e24', borderRadius: 10, padding: '10px 12px', lineHeight: 1.7 }}>
                <p style={{ color: '#475569', fontWeight: 600, marginBottom: 4 }}>Format support</p>
                <p>✅ PDF — renders page by page, no conversion needed</p>
                <p>✅ MP4 / WebM / MOV — native video playback</p>
                <p>✅ Google Slides — live embed via iframe</p>
                <p>⚠️ PPTX — requires LibreOffice on server to convert to PDF</p>
              </div>
            </aside>

            <main style={s.right}>
              {/* Videos */}
              <p style={s.sectionTitle}>Videos ({presentState.videos?.length ?? 0})</p>
              {(!presentState.videos || presentState.videos.length === 0) ? (
                <div style={{ ...s.emptyState, flex: 'none', padding: '28px 0', minHeight: 100 }}>
                  <p style={{ fontSize: 24 }}>🎬</p>
                  <p style={{ fontSize: 13 }}>No videos uploaded yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {presentState.videos.map(video => {
                    const isActive = video.id === presentState.activeVideoId && presentState.mode === 'video'
                    return (
                      <div key={video.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: isActive ? 'linear-gradient(135deg,#1e3a5f,#162d4a)' : '#1c1c1e', border: `1px solid ${isActive ? '#1e40af' : '#252528'}`, borderRadius: 10, boxShadow: isActive ? '0 2px 12px rgba(30,64,175,0.2)' : 'none' }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>🎬</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#93c5fd' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.name}</p>
                          <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{video.type}</p>
                        </div>
                        {isActive && <span style={{ fontSize: 10, background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>LIVE</span>}
                        <button onClick={() => updatePresent(p => displayVideo(p, video.id))} style={{ ...s.addBtn, padding: '6px 14px', fontSize: 12, flexShrink: 0 }}>Play</button>
                        <button onClick={() => updatePresent(p => deleteVideo(p, video.id))} style={s.removeBtn}>✕</button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Presentations */}
              <p style={s.sectionTitle}>Presentations ({presentState.presentations?.length ?? 0})</p>
              {(!presentState.presentations || presentState.presentations.length === 0) ? (
                <div style={{ ...s.emptyState, flex: 'none', padding: '28px 0', minHeight: 100 }}>
                  <p style={{ fontSize: 24 }}>📊</p>
                  <p style={{ fontSize: 13 }}>No presentations added yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {presentState.presentations.map(pres => {
                    const isActive = pres.id === presentState.activePresentationId && presentState.mode === 'presentation'
                    const icon = pres.type === 'google-slides' ? '🖥' : pres.type === 'application/pdf' ? '📄' : '📊'
                    const label = pres.type === 'google-slides' ? 'Google Slides' : pres.type === 'application/pdf' ? 'PDF' : 'PPTX'
                    return (
                      <div key={pres.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: isActive ? 'linear-gradient(135deg,#1e3a5f,#162d4a)' : '#1c1c1e', border: `1px solid ${isActive ? '#1e40af' : '#252528'}`, borderRadius: 10, boxShadow: isActive ? '0 2px 12px rgba(30,64,175,0.2)' : 'none' }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#93c5fd' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pres.name}</p>
                          <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{label}{pres.pageCount ? ` · ${pres.pageCount} pages` : ''}</p>
                        </div>
                        {isActive && <span style={{ fontSize: 10, background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>LIVE</span>}
                        <button onClick={() => updatePresent(p => displayPresentation(p, pres.id))} style={{ ...s.addBtn, padding: '6px 14px', fontSize: 12, flexShrink: 0 }}>Present</button>
                        <button onClick={() => updatePresent(p => deletePresentation(p, pres.id))} style={s.removeBtn}>✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </main>
          </div>
        )}

        {/* ══ NOTICES TAB ══ */}
        {activeTab === 'notices' && (
          <div style={s.twoCol}>
            <aside style={{ ...s.left, gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={s.sectionTitle}>Announcements</p>
                <button onClick={() => setShowNoticeEditor(v => !v)} style={{ ...s.addBtn, padding: '6px 14px', fontSize: 12 }}>{showNoticeEditor ? 'Cancel' : '+ New Notice'}</button>
              </div>
              {showNoticeEditor && (
                <div style={s.editorCard}>
                  <input type="text" placeholder="Title *" value={newNoticeTitle} onChange={e => setNewNoticeTitle(e.target.value)} style={s.addInput} />
                  <textarea placeholder="Body text…" value={newNoticeBody} onChange={e => setNewNoticeBody(e.target.value)} style={{ ...s.addInput, height: 100, resize: 'vertical' }} />
                  <select value={newNoticeStyle} onChange={e => setNewNoticeStyle(e.target.value as Notice['style'])} style={s.fullSelect}>
                    <option value="default">Default</option>
                    <option value="urgent">Urgent</option>
                    <option value="celebration">Celebration</option>
                  </select>
                  <button onClick={saveNotice} style={s.addBtn}>Save Notice</button>
                </div>
              )}
              <div style={s.activityList}>
                {presentState.notices.map(notice => {
                  const isActive = notice.id === presentState.activeNoticeId && presentState.mode === 'notice'
                  const styleColors: Record<Notice['style'], string> = { default: '#60a5fa', urgent: '#f87171', celebration: '#fbbf24' }
                  return (
                    <div key={notice.id} style={{ ...s.activityRow, background: isActive ? 'linear-gradient(135deg,#1e3a5f,#162d4a)' : '#1c1c1e', borderColor: isActive ? '#1e40af' : '#252528', flexDirection: 'column', alignItems: 'flex-start', cursor: 'default', gap: 4 }}>
                      <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isActive ? '#fff' : '#e2e8f0' }}>{notice.title}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, color: styleColors[notice.style], border: `1px solid ${styleColors[notice.style]}40` }}>{notice.style}</span>
                        <button onClick={() => updatePresent(p => displayNotice(p, notice.id))} style={{ ...s.addBtn, padding: '5px 12px', fontSize: 12 }}>Display</button>
                        <button onClick={() => updatePresent(p => deleteNotice(p, notice.id))} style={s.removeBtn}>✕</button>
                      </div>
                      {notice.body && <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>{notice.body.slice(0, 80)}{notice.body.length > 80 ? '…' : ''}</p>}
                    </div>
                  )
                })}
              </div>
            </aside>
            <main style={s.right}>
              <p style={s.sectionTitle}>Preview</p>
              {presentState.activeNoticeId && presentState.mode === 'notice' ? (() => {
                const notice = presentState.notices.find(n => n.id === presentState.activeNoticeId)
                if (!notice) return null
                return (
                  <div style={{ background: 'linear-gradient(145deg,#0a0a14,#0d0d1f)', border: '1px solid #1e40af', borderRadius: 12, padding: 32, textAlign: 'center', flex: 1, boxShadow: '0 4px 24px rgba(30,64,175,0.15)' }}>
                    <p style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 12 }}>{notice.title}</p>
                    <p style={{ fontSize: 16, color: '#cbd5e1', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{notice.body}</p>
                  </div>
                )
              })() : (<div style={s.emptyState}><p style={{ fontSize: 32 }}>📢</p><p style={{ fontSize: 14 }}>Select a notice and press Display</p></div>)}
            </main>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0f0f11', color: '#fff', fontFamily: 'var(--font-inter), system-ui, sans-serif', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: 'linear-gradient(180deg,#1a1a1f,#141418)', borderBottom: '1px solid #1e1e24', flexShrink: 0, boxShadow: '0 1px 0 rgba(255,255,255,0.04)' },
  logoMark: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #252528', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' },
  churchName: { fontSize: 14, fontWeight: 600, letterSpacing: '0.01em', color: '#e2e8f0' },
  subtitle: { fontSize: 10, color: '#475569', marginTop: 2, letterSpacing: '0.1em', textTransform: 'uppercase' },
  headerBtnNeutral: { background: 'rgba(100,116,139,0.08)', border: '1px solid #252528', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#64748b' },
  headerBtnGreen: { background: 'rgba(22,101,52,0.15)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#4ade80' },
  bigScreenBtn: { background: 'linear-gradient(135deg,#1e3a5f,#172d4a)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.15)' },
  tabBar: { display: 'flex', background: '#141418', borderBottom: '1px solid #1e1e24', flexShrink: 0 },
  tab: { padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em', transition: 'color 0.15s, background 0.15s' },
  content: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 },
  twoCol: { display: 'grid', gridTemplateColumns: '360px 1fr', flex: 1, minHeight: 0 },
  left: { padding: 18, borderRight: '1px solid #1e1e24', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', background: '#0f0f11' },
  right: { padding: 18, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' },
  timerCard: { borderRadius: 14, border: '1px solid', padding: '18px 18px 14px', transition: 'background 0.6s, border-color 0.6s, box-shadow 0.6s' },
  activityLabel: { fontSize: 10, color: '#475569', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4, fontWeight: 600 },
  clockDisplay: { fontFamily: 'var(--font-bebas), cursive', fontSize: 72, lineHeight: 1, textAlign: 'center', letterSpacing: '0.04em', transition: 'color 0.6s' },
  clockMeta: { fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 6 },
  progressTrack: { height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, transition: 'width 0.9s linear, background 0.6s' },
  legend: { display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 10, color: '#334155' },
  controlRow: { display: 'flex', gap: 8 },
  ctrlBtn: { flex: 1, padding: '9px 8px', background: '#1c1c1e', color: '#94a3b8', border: '1px solid #252528', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s' },
  primaryBtn: { flex: 2, color: '#fff', fontSize: 14, fontWeight: 600 },
  summaryCard: { background: '#141418', border: '1px solid #1e1e24', borderRadius: 11, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12 },
  sectionTitle: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, margin: 0 },
  activityList: { display: 'flex', flexDirection: 'column', gap: 5, flex: 1, overflowY: 'auto' },
  activityRow: { display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: 9, border: '1px solid', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s, opacity 0.15s, box-shadow 0.15s' },
  indexBadge: { width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, transition: 'background 0.15s, color 0.15s' },
  durationBadge: { fontSize: 12, color: '#475569', background: '#161618', border: '1px solid #252528', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', minWidth: 36, textAlign: 'center', flexShrink: 0 },
  durationSelect: { fontSize: 12, background: '#1c1c1e', color: '#fff', border: '1px solid #3f3f46', borderRadius: 6, padding: '3px 4px', width: 64, flexShrink: 0 },
  removeBtn: { background: 'none', border: 'none', color: '#334155', fontSize: 13, padding: '2px 4px', borderRadius: 4, cursor: 'pointer', flexShrink: 0, transition: 'color 0.15s' },
  addInput: { flex: 1, background: '#161618', border: '1px solid #252528', borderRadius: 9, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none' },
  addSelect: { background: '#161618', border: '1px solid #252528', borderRadius: 9, padding: '8px 7px', color: '#e2e8f0', fontSize: 12 },
  fullSelect: { width: '100%', background: '#161618', border: '1px solid #252528', borderRadius: 9, padding: '8px 12px', color: '#e2e8f0', fontSize: 13 },
  addBtn: { background: 'linear-gradient(135deg,#166534,#14532d)', color: '#fff', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 9, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(22,101,52,0.25)' },
  editorCard: { background: '#141418', border: '1px solid #1e1e24', borderRadius: 11, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, color: '#252528' },
  livePanel: { background: 'linear-gradient(180deg,#0f1e3d,#0b1830)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, padding: 14, boxShadow: '0 2px 16px rgba(59,130,246,0.06) inset' },
  livePanelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 },
  livePanelTag: { fontSize: 10, color: '#93c5fd', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 },
  miniActionBtn: { background: 'rgba(22,35,63,0.8)', color: '#93c5fd', border: '1px solid rgba(38,69,116,0.6)', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer' },
  livePanelRef: { fontSize: 11, color: '#60a5fa', fontWeight: 700, marginBottom: 6, letterSpacing: '0.02em' },
  livePanelText: { fontSize: 14, color: '#e2e8f0', lineHeight: 1.65 },
  livePanelEmpty: { fontSize: 13, color: '#334155', lineHeight: 1.5 },
  compactControlGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  compactLabelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  linkBtn: { fontSize: 10, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  compactInput: { width: '100%', background: '#161618', border: '1px solid #252528', borderRadius: 8, padding: '7px 10px', color: '#e2e8f0', fontSize: 12, outline: 'none' },
  compactSelected: { marginTop: 6, fontSize: 12, color: '#60a5fa', background: 'rgba(30,58,95,0.5)', border: '1px solid rgba(30,64,175,0.3)', borderRadius: 7, padding: '5px 9px', display: 'flex', flexDirection: 'column', gap: 2 },
  compactList: { marginTop: 6, background: '#141418', border: '1px solid #1e1e24', borderRadius: 9, maxHeight: 170, overflowY: 'auto' },
  compactListItem: { padding: '7px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #161618', display: 'flex', gap: 8, alignItems: 'center' },
  resultHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  resultCount: { fontSize: 10, color: '#475569', letterSpacing: '0.06em' },
  keywordResultsBox: { display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 260, overflowY: 'auto' },
  keywordResultRow: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 9, border: '1px solid', transition: 'background 0.15s, border-color 0.15s' },
  keywordResultRef: { fontSize: 11, color: '#60a5fa', fontWeight: 700, marginBottom: 4, letterSpacing: '0.02em' },
  keywordResultText: { fontSize: 12, color: '#94a3b8', lineHeight: 1.6 },
}