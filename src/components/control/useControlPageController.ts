import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent } from 'react'

import type { Activity, BibleVerse, CaptionCue, Notice, PresentState, Song, TimerState } from '@/types'
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
  loadPresentState,
  savePresentState,
  DEFAULT_PRESENT_STATE,
  displayVerseSelection,
  addBibleBackground,
  deleteBibleBackground,
  selectSong,
  goToLine,
  displayCaption,
  displayImage,
  displayNotice,
  addSong,
  updateSong,
  deleteSong,
  addImage,
  deleteImage,
  addNotice,
  deleteNotice,
  setMode,
  addVideo,
  deleteVideo,
  displayVideo,
  addPresentation,
  deletePresentation,
  displayPresentation,
  setBibleBackground,
  setBibleFontFamily,
  setBibleFontScale,
  setBibleTextColor,
} from '@/utils/presentStore'
import {
  BIBLE_FONT_OPTIONS,
  BIBLE_TEXT_COLOR_OPTIONS,
  clampBibleFontScale,
} from '@/utils/bibleDisplay'
import {
  fetchTranslations,
  fetchBooks,
  fetchChapter,
  fetchVerse,
  PRESET_TRANSLATIONS,
  BOOK_ID_MAP,
  STANDARD_BOOKS,
} from '@/utils/bibleApi'
import type { BibleTranslation, BibleBook } from '@/utils/bibleApi'
import { detectScriptureSuggestions } from '@/utils/scriptureDetection'
import type { ScriptureSuggestion } from '@/utils/scriptureDetection'
import { extractCaptionCues } from '@/utils/captionDetection'

import {
  ADDITIONAL_TIME_OPTIONS,
  CHURCH_NAME,
  DURATION_OPTIONS,
  AUTO_NEXT_BUFFER_SECONDS,
  KEYWORD_SEARCH_MAX_RESULTS,
  SCRIPTURE_SUGGESTION_LIMIT,
  SCRIPTURE_AUTO_DISPLAY_COOLDOWN_MS,
  CAPTION_SUGGESTION_LIMIT,
  VIDEO_ACCEPT,
  PRESENTATION_ACCEPT,
  HEALTH_POLL_MS,
  TOAST_DURATION_MS,
  COLOR_MAP,
  DEFAULT_SYSTEM_HEALTH,
  SHORTCUTS,
  TAB_OPTIONS,
  type BibleSearchHit,
  type ControlToastState,
  type HealthServiceState,
  type ReportPeriod,
  type SystemHealth,
  type TimerReportRow,
  type TimerReportSession,
  type TimerReportSummary,
  type Tab,
  type ToastTone,
} from './controlConfig'
import {
  appendTranscript,
  buildSongLines,
  describeSpeechError,
  highlightTerms,
  normalizeSearchText,
  scoreVerse,
  shouldAppendTranscriptChunk,
  stringifySongLines,
  withPauseAnchor,
  withStartAnchor,
} from './controlHelpers'
import type { SpeechRecognitionLike } from './controlSpeech'

type QueuedScriptureSuggestion = ScriptureSuggestion & {
  queuedAt: number
}

type TranscriptProviderMode = 'browser' | 'openai' | 'hybrid'

const OPENAI_TRANSCRIPT_CHUNK_MS = 5000
const OPENAI_TRANSCRIPT_MIN_CHUNK_BYTES = 4096
const OPENAI_EMPTY_CHUNK_LIMIT = 3

function buildActivityStateFromIndex(prev: TimerState, index: number, running: boolean): TimerState {
  const remaining = prev.activities[index]?.duration ? prev.activities[index].duration * 60 : 0
  const nextState = {
    ...prev,
    currentIndex: index,
    remaining,
    additionalSeconds: 0,
    overtime: false,
    overtimeSeconds: 0,
    activityStartedAt: running ? getSyncedNow() : null,
  }
  return running ? withStartAnchor(nextState, remaining) : withPauseAnchor(nextState, remaining)
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result
      if (!base64) {
        reject(new Error('Could not encode the recorded audio chunk.'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the recorded audio chunk.'))
    reader.readAsDataURL(blob)
  })
}

function getSpeechFriendlyAudioConstraints(): MediaTrackConstraints {
  return {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }
}

function mergeFloat32Chunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  return merged
}

function encodePcmAsWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2
  const wavBuffer = new ArrayBuffer(44 + (samples.length * bytesPerSample))
  const view = new DataView(wavBuffer)

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + (samples.length * bytesPerSample), true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * bytesPerSample, true)

  let offset = 44
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += bytesPerSample
  }

  return new Blob([wavBuffer], { type: 'audio/wav' })
}

export function useControlPageController() {
  const [activeTab, setActiveTab] = useState<Tab>('timer')
  const [timerState, setTimerState] = useState<TimerState>(DEFAULT_STATE)
  const [presentState, setPresentState] = useState<PresentState>(DEFAULT_PRESENT_STATE)
  const [editingDurationId, setEditingDurationId] = useState<number | null>(null)
  const [editingNameId, setEditingNameId] = useState<number | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [draggedActivityId, setDraggedActivityId] = useState<number | null>(null)
  const [dragOverActivityId, setDragOverActivityId] = useState<number | null>(null)
  const [newActName, setNewActName] = useState('')
  const [newActDur, setNewActDur] = useState(15)
  const [additionalTimeMinutes, setAdditionalTimeMinutes] = useState(5)
  const [systemHealth, setSystemHealth] = useState<SystemHealth>(DEFAULT_SYSTEM_HEALTH)
  const [toast, setToast] = useState<ControlToastState | null>(null)
  const [lastAction, setLastAction] = useState<{ label: string; at: number } | null>(null)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)

  const [displayRemaining, setDisplayRemaining] = useState<number>(0)
  const timerStateRef = useRef<TimerState>(timerState)
  const presentStateRef = useRef<PresentState>(presentState)
  const rafRef = useRef<number | null>(null)
  const autoNextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoNextScheduledForRef = useRef<number | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastUndoRef = useRef<(() => void) | null>(null)
  const keywordSearchInputRef = useRef<HTMLInputElement | null>(null)
  const shortcutActionsRef = useRef<{
    startPause: () => void
    goNext: () => void
    goPrev: () => void
    jumpToVerse: (delta: number) => void
    songLine: (delta: number) => void
  }>({
    startPause: () => {},
    goNext: () => {},
    goPrev: () => {},
    jumpToVerse: () => {},
    songLine: () => {},
  })

  const [translations, setTranslations] = useState<BibleTranslation[]>(PRESET_TRANSLATIONS)
  const [selectedTranslation, setSelectedTranslation] = useState('KJV')
  const [translationSearch, setTranslationSearch] = useState('')
  const [showTranslationList, setShowTranslationList] = useState(false)
  const [selectedSecondaryTranslation, setSelectedSecondaryTranslation] = useState('NIV')
  const [secondaryTranslationSearch, setSecondaryTranslationSearch] = useState('')
  const [showSecondaryTranslationList, setShowSecondaryTranslationList] = useState(false)
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
  const [browserTranscriptSupported, setBrowserTranscriptSupported] = useState(false)
  const [browserTranscriptListening, setBrowserTranscriptListening] = useState(false)
  const [openAITranscriptListening, setOpenAITranscriptListening] = useState(false)
  const [transcriptProviderMode, setTranscriptProviderMode] = useState<TranscriptProviderMode>('openai')
  const [openAITranscriptConfigured, setOpenAITranscriptConfigured] = useState(false)
  const [openAIRecorderSupported, setOpenAIRecorderSupported] = useState(false)
  const [openAITranscribeModel, setOpenAITranscribeModel] = useState('')
  const [openAIExtractionModel, setOpenAIExtractionModel] = useState('')
  const [openAITranscriptError, setOpenAITranscriptError] = useState('')
  const [transcriptError, setTranscriptError] = useState('')
  const [transcriptText, setTranscriptText] = useState('')
  const [refinedTranscriptText, setRefinedTranscriptText] = useState('')
  const [transcriptInterimText, setTranscriptInterimText] = useState('')
  const [openAIBrowserAssistActive, setOpenAIBrowserAssistActive] = useState(false)
  const [scriptureSuggestions, setScriptureSuggestions] = useState<QueuedScriptureSuggestion[]>([])
  const [captionSuggestions, setCaptionSuggestions] = useState<CaptionCue[]>([])
  const [autoDisplayScriptures, setAutoDisplayScriptures] = useState(false)
  const [captionsEnabled, setCaptionsEnabled] = useState(false)
  const [captionDraft, setCaptionDraft] = useState<CaptionCue | null>(null)
  const [captionDraftText, setCaptionDraftText] = useState('')
  const bibleSearchTokenRef = useRef(0)
  const translationSyncTokenRef = useRef(0)
  const chapterCacheRef = useRef<Map<string, { verse: number; text: string }[]>>(new Map())
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const openAIAudioContextRef = useRef<AudioContext | null>(null)
  const openAIAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const openAIProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const openAIChunkFlushTimerRef = useRef<number | null>(null)
  const openAIPcmChunksRef = useRef<Float32Array[]>([])
  const openAISampleRateRef = useRef(16000)
  const openAIRecorderRunningRef = useRef(false)
  const transcriptRefinementQueueRef = useRef<Array<{ audioBase64: string; mimeType: string }>>([])
  const transcriptRefinementInFlightRef = useRef(false)
  const emptyOpenAIChunkCountRef = useRef(0)
  const transcriptTextRef = useRef('')
  const refinedTranscriptTextRef = useRef('')
  const shouldKeepListeningRef = useRef(false)
  const autoDisplayedSuggestionTimesRef = useRef<Map<string, number>>(new Map())
  const autoDisplayScripturesRef = useRef(autoDisplayScriptures)
  const captionsEnabledRef = useRef(captionsEnabled)
  const transcriptProviderModeRef = useRef<TranscriptProviderMode>(transcriptProviderMode)
  const revealSuggestedScriptureRef = useRef<(suggestion: ScriptureSuggestion, options?: { display?: boolean; switchTab?: boolean }) => Promise<void>>(async () => {})

  const [operatorNotes, setOperatorNotes] = useState<string>('')
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('monthly')
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear())
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1)
  const [reportWeekStart, setReportWeekStart] = useState(() => {
    const now = new Date()
    const offset = (now.getDay() + 6) % 7
    now.setDate(now.getDate() - offset)
    return formatDateInputValue(now)
  })
  const [reportRows, setReportRows] = useState<TimerReportRow[]>([])
  const [reportSessions, setReportSessions] = useState<TimerReportSession[]>([])
  const [reportSummary, setReportSummary] = useState<TimerReportSummary>({
    sessions: 0,
    total_programme_seconds: 0,
    total_additional_seconds: 0,
    total_allotted_seconds: 0,
    total_used_seconds: 0,
    total_excess_seconds: 0,
    total_unused_seconds: 0,
    total_unfinished_seconds: 0,
    overtime_sessions: 0,
    additional_time_sessions: 0,
    early_finish_sessions: 0,
    interrupted_sessions: 0,
    average_used_seconds: 0,
    average_excess_seconds: 0,
    longest_session_seconds: 0,
    longest_excess_seconds: 0,
  })
  const [reportLabel, setReportLabel] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  const [alertMinistersInput, setAlertMinistersInput] = useState('')

  const [showSongEditor, setShowSongEditor] = useState(false)
  const [editingSongId, setEditingSongId] = useState<number | null>(null)
  const [newSongTitle, setNewSongTitle] = useState('')
  const [newSongArtist, setNewSongArtist] = useState('')
  const [newSongLyrics, setNewSongLyrics] = useState('')
  const [newSongInterpretation, setNewSongInterpretation] = useState('')

  const [showNoticeEditor, setShowNoticeEditor] = useState(false)
  const [newNoticeTitle, setNewNoticeTitle] = useState('')
  const [newNoticeBody, setNewNoticeBody] = useState('')
  const [newNoticeStyle, setNewNoticeStyle] = useState<Notice['style']>('default')

  const [googleSlidesUrl, setGoogleSlidesUrl] = useState('')
  const [googleSlidesError, setGoogleSlidesError] = useState('')
  const [mediaUploadProgress, setMediaUploadProgress] = useState('')

  useEffect(() => {
    const ts = loadState()
    const ps = loadPresentState()
    setTimerState(ts)
    timerStateRef.current = ts
    setDisplayRemaining(Math.floor(computeRemaining(ts)))
    setPresentState(ps)
    presentStateRef.current = ps
    if (ps.activeVerse?.translation) setSelectedTranslation(ps.activeVerse.translation)
    if (ps.activeSecondaryVerse?.translation) setSelectedSecondaryTranslation(ps.activeSecondaryVerse.translation)
    try {
      setOperatorNotes(localStorage.getItem('elim_op_notes') ?? '')
      const savedTranscriptProviderMode = localStorage.getItem('elim_transcript_provider_mode')
      if (
        savedTranscriptProviderMode === 'browser' ||
        savedTranscriptProviderMode === 'openai'
      ) {
        setTranscriptProviderMode(savedTranscriptProviderMode)
      }
    } catch {}
    return () => {}
  }, [])

  useEffect(() => {
    try {
      const savedTranscriptProviderMode = localStorage.getItem('elim_transcript_provider_mode')
      if (savedTranscriptProviderMode) return
    } catch {}

    if (openAITranscriptConfigured && openAIRecorderSupported) {
      setTranscriptProviderMode('openai')
      return
    }

    if (browserTranscriptSupported) {
      setTranscriptProviderMode('browser')
    }
  }, [browserTranscriptSupported, openAIRecorderSupported, openAITranscriptConfigured])

  useEffect(() => {
    timerStateRef.current = timerState
  }, [timerState])

  useEffect(() => {
    presentStateRef.current = presentState
  }, [presentState])

  useEffect(() => {
    captionsEnabledRef.current = captionsEnabled
  }, [captionsEnabled])

  useEffect(() => {
    transcriptProviderModeRef.current = transcriptProviderMode
    try {
      localStorage.setItem('elim_transcript_provider_mode', transcriptProviderMode)
    } catch {}
  }, [transcriptProviderMode])

  useEffect(() => {
    if (presentState.activeSecondaryVerse?.translation) {
      setSelectedSecondaryTranslation(presentState.activeSecondaryVerse.translation)
    }
  }, [presentState.activeSecondaryVerse?.translation])

  useEffect(() => {
    setAlertMinistersInput(presentState.alertMinisters.join(', '))
  }, [presentState.alertMinisters])

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
      toastTimerRef.current = null
    }
    toastUndoRef.current = null
    setToast(null)
  }, [])

  const showToastMessage = useCallback((payload: Omit<ControlToastState, 'id'>, undo?: () => void) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const id = Date.now()
    toastUndoRef.current = undo ?? null
    setToast({
      id,
      ...payload,
      undoLabel: undo ? (payload.undoLabel ?? 'Undo') : undefined,
    })
    toastTimerRef.current = setTimeout(() => {
      toastUndoRef.current = null
      setToast(current => (current?.id === id ? null : current))
      toastTimerRef.current = null
    }, TOAST_DURATION_MS)
  }, [])

  const handleToastUndo = useCallback(() => {
    const undo = toastUndoRef.current
    dismissToast()
    if (undo) undo()
  }, [dismissToast])

  const setTimerStateAndPersist = useCallback((next: TimerState) => {
    timerStateRef.current = next
    setTimerState(next)
    saveAndBroadcast(next)
  }, [])

  const setPresentStateAndPersist = useCallback((next: PresentState) => {
    presentStateRef.current = next
    setPresentState(next)
    savePresentState(next)
  }, [])

  const restoreTimerState = useCallback((snapshot: TimerState, detail: string) => {
    setTimerStateAndPersist(snapshot)
    setLastAction({ label: 'Timer restored', at: Date.now() })
    showToastMessage({ title: 'Timer restored', detail, tone: 'info' })
  }, [setTimerStateAndPersist, showToastMessage])

  const restorePresentState = useCallback((snapshot: PresentState, detail: string) => {
    setPresentStateAndPersist(snapshot)
    setLastAction({ label: 'Screen restored', at: Date.now() })
    showToastMessage({ title: 'Screen restored', detail, tone: 'info' })
  }, [setPresentStateAndPersist, showToastMessage])

  const runTimerAction = useCallback((config: {
    title: string
    detail: string
    updater: (prev: TimerState) => TimerState
    tone?: ToastTone
    undoable?: boolean
    undoDetail?: string
  }) => {
    const previous = timerStateRef.current
    const next = config.updater(previous)
    if (next === previous) return previous
    setTimerStateAndPersist(next)
    setLastAction({ label: config.title, at: Date.now() })
    showToastMessage(
      {
        title: config.title,
        detail: config.detail,
        tone: config.tone ?? 'success',
      },
      config.undoable === false
        ? undefined
        : () => restoreTimerState(previous, config.undoDetail ?? 'Returned to the previous timer state.')
    )
    return next
  }, [restoreTimerState, setTimerStateAndPersist, showToastMessage])

  const runPresentAction = useCallback((config: {
    title: string
    detail: string
    updater: (prev: PresentState) => PresentState
    tone?: ToastTone
    undoable?: boolean
    undoDetail?: string
  }) => {
    const previous = presentStateRef.current
    const next = config.updater(previous)
    if (next === previous) return previous
    setPresentStateAndPersist(next)
    setLastAction({ label: config.title, at: Date.now() })
    showToastMessage(
      {
        title: config.title,
        detail: config.detail,
        tone: config.tone ?? 'success',
      },
      config.undoable === false
        ? undefined
        : () => restorePresentState(previous, config.undoDetail ?? 'Returned to the previous live output.')
    )
    return next
  }, [restorePresentState, setPresentStateAndPersist, showToastMessage])

  useEffect(() => {
    let cancelled = false

    const runHealthCheck = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (!cancelled) {
          setSystemHealth({
            overall: 'degraded',
            checkedAt: Date.now(),
            services: { auth: 'error', clock: 'error', timer: 'error', present: 'error' },
          })
        }
        return
      }

      const [authRes, clockRes, timerRes, presentRes] = await Promise.all([
        fetch('/api/auth/session', { method: 'GET', cache: 'no-store' })
          .then(async res => {
            if (!res.ok) return { ok: false as const }
            const data = await res.json().catch(() => null)
            return {
              ok: Boolean(data?.configured && data?.authenticated),
            }
          })
          .catch(() => ({ ok: false as const })),
        fetch('/api/time', { method: 'GET', cache: 'no-store' })
          .then(async res => {
            if (!res.ok) return { ok: false as const }
            const data = await res.json().catch(() => null)
            if (typeof data?.serverTime === 'number') {
              setServerTimeOffset(data.serverTime - Date.now())
            }
            return { ok: typeof data?.serverTime === 'number' }
          })
          .catch(() => ({ ok: false as const })),
        fetch('/api/timer', { method: 'GET', cache: 'no-store' })
          .then(res => ({ ok: res.ok }))
          .catch(() => ({ ok: false as const })),
        fetch('/api/present', { method: 'GET', cache: 'no-store' })
          .then(res => ({ ok: res.ok }))
          .catch(() => ({ ok: false as const })),
      ])

      if (cancelled) return

      const services: SystemHealth['services'] = {
        auth: authRes.ok ? 'ok' : 'error',
        clock: clockRes.ok ? 'ok' : 'error',
        timer: timerRes.ok ? 'ok' : 'error',
        present: presentRes.ok ? 'ok' : 'error',
      }

      const allHealthy = Object.values(services).every(status => status === 'ok')
      setSystemHealth({
        overall: allHealthy ? 'healthy' : 'degraded',
        checkedAt: Date.now(),
        services,
      })
    }

    void runHealthCheck()
    const intervalId = window.setInterval(() => {
      void runHealthCheck()
    }, HEALTH_POLL_MS)
    const handleConnectionChange = () => {
      void runHealthCheck()
    }
    window.addEventListener('online', handleConnectionChange)
    window.addEventListener('offline', handleConnectionChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('online', handleConnectionChange)
      window.removeEventListener('offline', handleConnectionChange)
    }
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const windowWithWebkitAudio = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }
    setOpenAIRecorderSupported(
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      Boolean(window.AudioContext || windowWithWebkitAudio.webkitAudioContext)
    )

    let cancelled = false

    fetch('/api/scripture-assist/status', { method: 'GET', cache: 'no-store' })
      .then(async res => {
        if (!res.ok) return null
        return res.json().catch(() => null)
      })
      .then(data => {
        if (cancelled || !data) return
        setOpenAITranscriptConfigured(Boolean(data.configured))
        setOpenAITranscribeModel(typeof data.transcribeModel === 'string' ? data.transcribeModel : '')
        setOpenAIExtractionModel(typeof data.extractionModel === 'string' ? data.extractionModel : '')
      })
      .catch(() => {
        if (cancelled) return
        setOpenAITranscriptConfigured(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const createEmptyReportSummary = (): TimerReportSummary => ({
    sessions: 0,
    total_programme_seconds: 0,
    total_additional_seconds: 0,
    total_allotted_seconds: 0,
    total_used_seconds: 0,
    total_excess_seconds: 0,
    total_unused_seconds: 0,
    total_unfinished_seconds: 0,
    overtime_sessions: 0,
    additional_time_sessions: 0,
    early_finish_sessions: 0,
    interrupted_sessions: 0,
    average_used_seconds: 0,
    average_excess_seconds: 0,
    longest_session_seconds: 0,
    longest_excess_seconds: 0,
  })

  const sendTimerLog = async (payload: {
    service: string
    programmeSeconds: number
    additionalSeconds: number
    totalAllottedSeconds: number
    usedSeconds: number
    excessSeconds: number
    unusedSeconds: number
    unfinishedSeconds: number
    startedAt: number
    endedAt: number
    exitReason: string
    user?: string
    notes?: string
  }) => {
    try {
      await fetch('/api/timer/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } catch (error) {
      console.warn('[API] Timer log failed:', (error as Error).message)
    }
  }

  const buildTimerLogPayload = useCallback((snapshot: TimerState, action: string) => {
    if (!snapshot.activities.length) return null

    const index = Math.min(snapshot.currentIndex, snapshot.activities.length - 1)
    const activity = snapshot.activities[index]
    if (!activity) return null

    const programmeSeconds = Math.max(0, activity.duration * 60)
    const additionalSeconds = Math.max(0, snapshot.additionalSeconds ?? 0)
    const totalAllottedSeconds = programmeSeconds + additionalSeconds
    const remaining = snapshot.running ? computeRemaining(snapshot) : snapshot.remaining
    const usedSeconds = Math.max(0, totalAllottedSeconds - remaining)
    const positiveRemaining = Math.max(0, remaining)
    const excessSeconds = Math.max(0, -remaining)

    if (
      usedSeconds <= 0 &&
      additionalSeconds <= 0 &&
      !snapshot.activityStartedAt &&
      positiveRemaining >= totalAllottedSeconds
    ) {
      return null
    }

    let unusedSeconds = 0
    let unfinishedSeconds = 0
    if (positiveRemaining > 0) {
      if (action === 'next' || action === 'select') unusedSeconds = positiveRemaining
      else unfinishedSeconds = positiveRemaining
    }

    return {
      service: activity.name,
      programmeSeconds,
      additionalSeconds,
      totalAllottedSeconds,
      usedSeconds,
      excessSeconds,
      unusedSeconds,
      unfinishedSeconds,
      startedAt: snapshot.activityStartedAt ?? snapshot.startedAt ?? getSyncedNow(),
      endedAt: getSyncedNow(),
      exitReason: action,
      user: 'operator',
      notes: operatorNotes ? `${action} | ${operatorNotes}` : action,
    }
  }, [operatorNotes])

  const logTimerSnapshot = useCallback(async (snapshot: TimerState, action: string) => {
    const payload = buildTimerLogPayload(snapshot, action)
    if (!payload) return
    await sendTimerLog(payload)
  }, [buildTimerLogPayload])

  const saveOperatorNoteToServer = async (note: string) => {
    try {
      await fetch('/api/operator-note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note, source: 'control' }) })
    } catch (error) {
      console.warn('[API] Operator note failed:', (error as Error).message)
    }
  }

  const buildReportUrl = (format: 'json' | 'pdf' = 'json') => {
    const params = new URLSearchParams()
    params.set('period', reportPeriod)
    if (reportPeriod === 'weekly') params.set('weekStart', reportWeekStart)
    else {
      params.set('year', String(reportYear))
      params.set('month', String(reportMonth))
    }
    if (format === 'pdf') params.set('format', 'pdf')
    return `/api/timer/report?${params.toString()}`
  }

  const fetchTimerReport = async () => {
    setReportLoading(true)
    setReportError('')
    try {
      const res = await fetch(buildReportUrl('json'), { method: 'GET' })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const data = await res.json()
      setReportRows(Array.isArray(data.report) ? data.report : [])
      setReportSessions(Array.isArray(data.sessions) ? data.sessions : [])
      setReportSummary(data.summary ?? createEmptyReportSummary())
      setReportLabel(typeof data.label === 'string' ? data.label : '')
    } catch (error) {
      setReportError(`Failed to load report: ${(error as Error).message}`)
      setReportRows([])
      setReportSessions([])
      setReportSummary(createEmptyReportSummary())
      setReportLabel('')
    } finally {
      setReportLoading(false)
    }
  }

  const applyAlertConfig = () => {
    const names = alertMinistersInput.split(/[;,\n]+/).map(x => x.trim()).filter(Boolean)
    runPresentAction({
      title: 'Alert scroller updated',
      detail: names.length > 0 ? `${names.length} minister name${names.length === 1 ? '' : 's'} prepared for alert display.` : 'Alert scroller list cleared.',
      undoDetail: 'Restored the previous alert scroller configuration.',
      updater: prev => ({ ...prev, alertMinisters: names, alertActive: names.length > 0 ? prev.alertActive : false }),
    })
  }

  useEffect(() => {
    let lastShown: number | null = null
    const tick = () => {
      const snapshot = timerStateRef.current
      if (snapshot) {
        const floored = Math.floor(computeRemaining(snapshot))
        if (floored !== lastShown) {
          lastShown = floored
          setDisplayRemaining(floored)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    setDisplayRemaining(Math.floor(computeRemaining(timerState)))
  }, [timerState])

  useEffect(() => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current)
      autoNextTimeoutRef.current = null
    }
    const currentIdx = timerState.currentIndex
    const lastIdx = timerState.activities.length - 1
    const isLast = currentIdx >= lastIdx
    if (!timerState.running || displayRemaining > 0 || isLast) {
      autoNextScheduledForRef.current = null
      return
    }
    if (autoNextScheduledForRef.current === currentIdx) return
    autoNextScheduledForRef.current = currentIdx
    autoNextTimeoutRef.current = setTimeout(() => {
      setTimerState(prev => {
        if (!prev.running) return prev
        if (prev.currentIndex !== currentIdx) return prev
        if (Math.floor(computeRemaining(prev)) > 0) return prev
        const nextIdx = prev.currentIndex + 1
        if (nextIdx >= prev.activities.length) {
          void logTimerSnapshot(prev, 'auto-end')
          const paused = withPauseAnchor(prev, Math.floor(computeRemaining(prev)))
          saveAndBroadcast(paused)
          timerStateRef.current = paused
          return paused
        }
        void logTimerSnapshot(prev, 'auto-next')
        const nextState = buildActivityStateFromIndex(prev, nextIdx, true)
        saveAndBroadcast(nextState)
        timerStateRef.current = nextState
        return nextState
      })
    }, AUTO_NEXT_BUFFER_SECONDS * 1000)
    return () => {
      if (autoNextTimeoutRef.current) {
        clearTimeout(autoNextTimeoutRef.current)
        autoNextTimeoutRef.current = null
      }
    }
  }, [displayRemaining, logTimerSnapshot, timerState.activities, timerState.currentIndex, timerState.running])

  useEffect(() => {
    if (!selectedTranslation) return
    chapterCacheRef.current.clear()
    fetchBooks(selectedTranslation).then(nextBooks => {
      setBooks(nextBooks)
      if (nextBooks.length > 0) {
        const preferredBookName =
          (presentState.mode === 'bible' ? presentState.activeVerse?.book : null) ?? selectedBook
        const preferredBook =
          nextBooks.find(book => String(book.bookid) === selectedBookId) ??
          nextBooks.find(book => book.name === preferredBookName) ??
          nextBooks.find(book => book.name === 'John') ??
          nextBooks[0]
        setSelectedBook(preferredBook.name)
        setSelectedBookId(String(preferredBook.bookid))
      }
    })
  }, [presentState.activeVerse?.book, presentState.mode, selectedBook, selectedBookId, selectedTranslation])

  useEffect(() => {
    if (!selectedBookId || !selectedTranslation) return
    setBibleLoading(true)
    fetchChapter(selectedTranslation, selectedBookId, selectedChapter, selectedBook)
      .then(chapter => {
        const verses = chapter ? chapter.verses : []
        setChapterVerses(verses)
        chapterCacheRef.current.set(`${selectedTranslation}:${selectedBookId}:${selectedChapter}`, verses)
        setBibleLoading(false)
      })
      .catch(() => setBibleLoading(false))
  }, [selectedBook, selectedBookId, selectedChapter, selectedTranslation])

  async function loadTranslationsData() {
    const data = await fetchTranslations()
    setTranslations(data)
  }

  const updatePresent = useCallback((updater: (prev: PresentState) => PresentState) => {
    setPresentState(prev => {
      const next = updater(prev)
      presentStateRef.current = next
      savePresentState(next)
      return next
    })
  }, [])

  const resolveBookId = useCallback((bookName: string) => (
    BOOK_ID_MAP[bookName] ??
    String(books.find(book => book.name === bookName)?.bookid ?? '')
  ), [books])

  const fetchVerseForReference = useCallback(async (
    translationId: string,
    bookName: string,
    chapter: number,
    verse: number
  ) => {
    const bookId = resolveBookId(bookName)
    if (!bookId) return null
    return fetchVerse(translationId, bookId, bookName, chapter, verse)
  }, [resolveBookId])

  const resolveBibleDisplaySelection = useCallback(async (
    hit: { book: string; chapter: number; verse: number; text: string; translation?: string; reference?: string },
    options: { displayMode?: 'single' | 'double'; secondaryTranslation?: string } = {}
  ) => {
    const primaryTranslation = hit.translation ?? selectedTranslation
    const primaryVerse = {
      book: hit.book,
      chapter: hit.chapter,
      verse: hit.verse,
      text: hit.text,
      translation: primaryTranslation,
      reference: hit.reference ?? `${hit.book} ${hit.chapter}:${hit.verse} (${primaryTranslation})`,
    }

    const displayMode = options.displayMode ?? presentStateRef.current.bibleDisplayMode ?? 'single'
    if (displayMode !== 'double') {
      return { primaryVerse, secondaryVerse: null, displayMode: 'single' as const }
    }

    const secondaryTranslation = options.secondaryTranslation ?? selectedSecondaryTranslation
    if (!secondaryTranslation) {
      return { primaryVerse, secondaryVerse: null, displayMode: 'single' as const }
    }

    if (secondaryTranslation === primaryTranslation) {
      return {
        primaryVerse,
        secondaryVerse: {
          ...primaryVerse,
          translation: secondaryTranslation,
          reference: `${hit.book} ${hit.chapter}:${hit.verse} (${secondaryTranslation})`,
        },
        displayMode: 'double' as const,
      }
    }

    const secondaryVerse = await fetchVerseForReference(
      secondaryTranslation,
      hit.book,
      hit.chapter,
      hit.verse
    )

    return {
      primaryVerse,
      secondaryVerse,
      displayMode: secondaryVerse ? 'double' as const : 'single' as const,
    }
  }, [fetchVerseForReference, selectedSecondaryTranslation, selectedTranslation])

  const handleTranslationSelect = async (nextTranslation: string) => {
    setSelectedTranslation(nextTranslation)
    setTranslationSearch('')
    setShowTranslationList(false)

    const activeVerse = presentState.mode === 'bible' ? presentState.activeVerse : null
    if (!activeVerse || activeVerse.translation === nextTranslation) return

    const bookId = resolveBookId(activeVerse.book)
    if (!bookId) return

    setSelectedBook(activeVerse.book)
    setSelectedBookId(String(bookId))
    setSelectedChapter(activeVerse.chapter)
    setChapterInput(String(activeVerse.chapter))

    const syncToken = Date.now()
    translationSyncTokenRef.current = syncToken

    const nextVerse = await fetchVerse(
      nextTranslation,
      String(bookId),
      activeVerse.book,
      activeVerse.chapter,
      activeVerse.verse
    )

    if (!nextVerse || translationSyncTokenRef.current !== syncToken) return

    runPresentAction({
      title: `Live translation switched to ${nextTranslation}`,
      detail: `${activeVerse.book} ${activeVerse.chapter}:${activeVerse.verse} is now showing in ${nextTranslation}.`,
      undoDetail: 'Returned the live scripture to the previous translation.',
      updater: prev => {
        const currentVerse = prev.activeVerse
        if (prev.mode !== 'bible' || !currentVerse) return prev
        if (
          currentVerse.book !== activeVerse.book ||
          currentVerse.chapter !== activeVerse.chapter ||
          currentVerse.verse !== activeVerse.verse
        ) {
          return prev
        }
        return displayVerseSelection(prev, nextVerse, {
          displayMode: prev.bibleDisplayMode,
          secondaryVerse: prev.activeSecondaryVerse,
        })
      },
    })
  }

  const handleSecondaryTranslationSelect = async (nextTranslation: string) => {
    setSelectedSecondaryTranslation(nextTranslation)
    setSecondaryTranslationSearch('')
    setShowSecondaryTranslationList(false)

    const activeVerse = presentStateRef.current.mode === 'bible' ? presentStateRef.current.activeVerse : null
    if (!activeVerse || presentStateRef.current.bibleDisplayMode !== 'double') return

    const syncToken = Date.now()
    translationSyncTokenRef.current = syncToken
    const nextVerse = await fetchVerseForReference(
      nextTranslation,
      activeVerse.book,
      activeVerse.chapter,
      activeVerse.verse
    )

    if (!nextVerse || translationSyncTokenRef.current !== syncToken) return

    runPresentAction({
      title: `Second translation switched to ${nextTranslation}`,
      detail: `${activeVerse.book} ${activeVerse.chapter}:${activeVerse.verse} now shows ${nextTranslation} alongside ${activeVerse.translation}.`,
      undoDetail: 'Returned the second live translation to the previous version.',
      updater: prev => {
        if (prev.mode !== 'bible' || !prev.activeVerse || prev.bibleDisplayMode !== 'double') return prev
        return displayVerseSelection(prev, prev.activeVerse, {
          displayMode: 'double',
          secondaryVerse: nextVerse,
        })
      },
    })
  }

  const handleBibleDisplayModeChange = useCallback(async (displayMode: 'single' | 'double') => {
    const activeVerse = presentStateRef.current.mode === 'bible' ? presentStateRef.current.activeVerse : null

    if (!activeVerse) {
      updatePresent(prev => ({
        ...prev,
        bibleDisplayMode: displayMode,
        activeSecondaryVerse: displayMode === 'double' ? prev.activeSecondaryVerse : null,
      }))
      showToastMessage({
        title: displayMode === 'double' ? 'Double translation armed' : 'Single translation armed',
        detail: displayMode === 'double'
          ? 'The next scripture you send live will use two translations.'
          : 'The next scripture you send live will use one translation.',
        tone: 'info',
      })
      return
    }

    if (displayMode === 'single') {
      runPresentAction({
        title: 'Single translation live',
        detail: `${activeVerse.reference} is back to a single translation layout.`,
        undoDetail: 'Restored the double translation layout.',
        updater: prev => displayVerseSelection(prev, activeVerse, { displayMode: 'single' }),
      })
      return
    }

    const secondaryVerse = await fetchVerseForReference(
      selectedSecondaryTranslation,
      activeVerse.book,
      activeVerse.chapter,
      activeVerse.verse
    )

    if (!secondaryVerse) {
      showToastMessage({
        title: 'Second translation unavailable',
        detail: `${activeVerse.book} ${activeVerse.chapter}:${activeVerse.verse} could not be loaded in ${selectedSecondaryTranslation}.`,
        tone: 'warning',
      })
      return
    }

    runPresentAction({
      title: 'Double translation live',
      detail: `${activeVerse.reference} is now live with ${selectedSecondaryTranslation}.`,
      undoDetail: 'Returned the big screen to a single translation layout.',
      updater: prev => displayVerseSelection(prev, activeVerse, {
        displayMode: 'double',
        secondaryVerse,
      }),
    })
  }, [fetchVerseForReference, selectedSecondaryTranslation, showToastMessage, updatePresent, runPresentAction])

  const addAdditionalTime = () => {
    const extraMinutes = Math.max(1, additionalTimeMinutes || 1)
    const activeActivity = timerStateRef.current.activities[timerStateRef.current.currentIndex]

    runTimerAction({
      title: 'Additional time added',
      detail: activeActivity
        ? `${extraMinutes} minute${extraMinutes === 1 ? '' : 's'} added to ${activeActivity.name}.`
        : `${extraMinutes} minute${extraMinutes === 1 ? '' : 's'} added to the current timer.`,
      undoDetail: 'Removed the added time from the current item.',
      updater: prev => {
        const currentRemaining = prev.running ? Math.floor(computeRemaining(prev)) : prev.remaining
        const nextRemaining = currentRemaining + (extraMinutes * 60)
        const nextState = {
          ...prev,
          remaining: nextRemaining,
          additionalSeconds: (prev.additionalSeconds ?? 0) + (extraMinutes * 60),
          overtime: nextRemaining < 0,
          overtimeSeconds: Math.max(0, -nextRemaining),
        }
        return prev.running ? withStartAnchor(nextState, nextRemaining) : withPauseAnchor(nextState, nextRemaining)
      },
    })
  }

  const startPause = () => {
    const snapshot = timerStateRef.current
    const activeActivity = snapshot.activities[snapshot.currentIndex]
    runTimerAction({
      title: snapshot.running ? 'Timer paused' : 'Timer started',
      detail: activeActivity ? `${activeActivity.name} is ${snapshot.running ? 'paused' : 'now live'}.` : 'Timer state updated.',
      undoDetail: 'Returned the timer to its previous running state.',
      updater: prev => {
        if (prev.running) return withPauseAnchor(prev, Math.floor(computeRemaining(prev)))
        const remaining = Math.floor(computeRemaining(prev))
        const nextState = {
          ...prev,
          activityStartedAt: prev.activityStartedAt ?? getSyncedNow(),
        }
        return withStartAnchor(nextState, remaining)
      },
    })
  }

  const goNext = () => {
    const snapshot = timerStateRef.current
    const nextActivity = snapshot.activities[snapshot.currentIndex + 1]
    const nextState = runTimerAction({
      title: nextActivity ? `Moved to ${nextActivity.name}` : 'Programme already at final item',
      detail: nextActivity ? `Timer is ready for ${nextActivity.duration} minute${nextActivity.duration === 1 ? '' : 's'}.` : 'There is no next programme item to move to.',
      tone: nextActivity ? 'success' : 'warning',
      updater: prev => {
        const nextIdx = prev.currentIndex + 1
        if (nextIdx >= prev.activities.length) return prev
        return buildActivityStateFromIndex(prev, nextIdx, true)
      },
    })
    if (nextState !== snapshot) void logTimerSnapshot(snapshot, 'next')
  }

  const goPrev = () => {
    const snapshot = timerStateRef.current
    const previousActivity = snapshot.activities[Math.max(0, snapshot.currentIndex - 1)]
    const nextState = runTimerAction({
      title: previousActivity ? `Returned to ${previousActivity.name}` : 'Returned to first item',
      detail: previousActivity ? `${previousActivity.name} is ready to run.` : 'Timer returned to the first programme item.',
      updater: prev => {
        const idx = Math.max(0, prev.currentIndex - 1)
        return buildActivityStateFromIndex(prev, idx, false)
      },
    })
    if (nextState !== snapshot) void logTimerSnapshot(snapshot, 'go-prev')
  }

  const resetCurrent = () => {
    const snapshot = timerStateRef.current
    const activeActivity = snapshot.activities[snapshot.currentIndex]
    const nextState = runTimerAction({
      title: 'Current item reset',
      detail: activeActivity ? `${activeActivity.name} returned to its full ${activeActivity.duration} minute allocation.` : 'Current timer item reset.',
      updater: prev => buildActivityStateFromIndex(prev, prev.currentIndex, false),
    })
    if (nextState !== snapshot) void logTimerSnapshot(snapshot, 'reset-current')
  }

  const resetAll = () => {
    const snapshot = timerStateRef.current
    const firstActivity = snapshot.activities[0]
    const nextState = runTimerAction({
      title: 'Programme reset',
      detail: firstActivity ? `Timer moved back to ${firstActivity.name}.` : 'Programme timer reset.',
      tone: 'warning',
      updater: prev => {
        if (!prev.activities.length) return prev
        return buildActivityStateFromIndex(prev, 0, false)
      },
    })
    if (nextState !== snapshot) void logTimerSnapshot(snapshot, 'reset-all')
  }

  const selectActivity = (index: number) => {
    const snapshot = timerStateRef.current
    const activity = snapshot.activities[index]
    const nextState = runTimerAction({
      title: activity ? `Jumped to ${activity.name}` : 'Timer position updated',
      detail: activity ? `${activity.duration} minute${activity.duration === 1 ? '' : 's'} allocated.` : 'Programme item selected.',
      updater: prev => buildActivityStateFromIndex(prev, index, false),
    })
    if (nextState !== snapshot) void logTimerSnapshot(snapshot, 'select')
  }

  const addActivity = () => {
    const nextName = newActName.trim()
    if (!nextName) return
    runTimerAction({
      title: 'Programme item added',
      detail: `${nextName} added for ${newActDur} minute${newActDur === 1 ? '' : 's'}.`,
      undoDetail: 'Removed the new programme item.',
      updater: prev => ({ ...prev, activities: [...prev.activities, { id: generateId(), name: nextName, duration: newActDur }] }),
    })
    setNewActName('')
    setNewActDur(15)
  }

  const cancelRenameActivity = useCallback(() => {
    setEditingNameId(null)
    setEditingNameValue('')
  }, [])

  const removeActivity = (id: number) => {
    const snapshot = timerStateRef.current
    const activity = snapshot.activities.find(item => item.id === id)
    if (editingDurationId === id) setEditingDurationId(null)
    if (editingNameId === id) cancelRenameActivity()
    const nextState = runTimerAction({
      title: 'Programme item removed',
      detail: activity ? `${activity.name} was removed from the programme.` : 'Programme item removed.',
      tone: 'warning',
      undoDetail: 'Restored the removed programme item.',
      updater: prev => {
        const removedIndex = prev.activities.findIndex(item => item.id === id)
        const filtered = prev.activities.filter(item => item.id !== id)
        if (!filtered.length) return prev
        let newIdx = prev.currentIndex
        if (removedIndex >= 0 && removedIndex < prev.currentIndex) {
          newIdx = Math.max(0, prev.currentIndex - 1)
        } else if (prev.currentIndex >= filtered.length) {
          newIdx = filtered.length - 1
        }
        return { ...prev, activities: filtered, currentIndex: newIdx }
      },
    })
    if (nextState !== snapshot && snapshot.activities[snapshot.currentIndex]?.id === id) {
      void logTimerSnapshot(snapshot, 'remove')
    }
  }

  const updateActivityName = (id: number, name: string) => {
    const previousName = timerStateRef.current.activities.find(activity => activity.id === id)?.name ?? 'Programme item'
    runTimerAction({
      title: 'Programme renamed',
      detail: `${previousName} is now ${name}.`,
      undoDetail: 'Restored the previous programme name.',
      updater: prev => ({
        ...prev,
        activities: prev.activities.map((activity): Activity => (activity.id === id ? { ...activity, name } : activity)),
      }),
    })
  }

  const beginRenameActivity = (activity: Activity) => {
    setEditingDurationId(null)
    setEditingNameId(activity.id)
    setEditingNameValue(activity.name)
  }

  const commitRenameActivity = (id: number) => {
    const nextName = editingNameValue.trim()
    const currentName = timerState.activities.find(activity => activity.id === id)?.name ?? ''
    if (nextName && nextName !== currentName) updateActivityName(id, nextName)
    cancelRenameActivity()
  }

  const reorderActivities = (fromId: number, toId: number) => {
    if (fromId === toId) return
    const movedActivity = timerStateRef.current.activities.find(activity => activity.id === fromId)
    const targetActivity = timerStateRef.current.activities.find(activity => activity.id === toId)
    runTimerAction({
      title: 'Programme reordered',
      detail: movedActivity && targetActivity ? `${movedActivity.name} was moved around ${targetActivity.name}.` : 'Programme order updated.',
      undoDetail: 'Returned the programme to its previous order.',
      updater: prev => {
        const fromIndex = prev.activities.findIndex(activity => activity.id === fromId)
        const toIndex = prev.activities.findIndex(activity => activity.id === toId)
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev

        const activities = [...prev.activities]
        const [moved] = activities.splice(fromIndex, 1)
        activities.splice(toIndex, 0, moved)

        const activeActivityId = prev.activities[prev.currentIndex]?.id
        const nextCurrentIndex =
          activeActivityId == null
            ? prev.currentIndex
            : Math.max(0, activities.findIndex(activity => activity.id === activeActivityId))

        return { ...prev, activities, currentIndex: nextCurrentIndex }
      },
    })
  }

  const updateDuration = (id: number, duration: number) => {
    const activity = timerStateRef.current.activities.find(item => item.id === id)
    runTimerAction({
      title: 'Duration updated',
      detail: activity ? `${activity.name} now runs for ${duration} minute${duration === 1 ? '' : 's'}.` : `Duration changed to ${duration} minutes.`,
      undoDetail: 'Restored the previous duration.',
      updater: prev => {
        const activities = prev.activities.map((activity): Activity => (activity.id === id ? { ...activity, duration } : activity))
        const curIndex = prev.currentIndex
        const currentActivity = prev.activities[curIndex]
        const isActive = currentActivity?.id === id
        if (!isActive) return { ...prev, activities }
        const oldDurationSeconds = ((currentActivity.duration || 0) * 60) + (prev.additionalSeconds ?? 0)
        const elapsedSeconds = prev.running ? Math.max(0, oldDurationSeconds - computeRemaining(prev)) : (oldDurationSeconds - prev.remaining)
        const newDurationSeconds = Math.max(1, (duration * 60) + (prev.additionalSeconds ?? 0))
        const newRemaining = newDurationSeconds - elapsedSeconds
        const nextState = { ...prev, activities, currentIndex: curIndex, remaining: newRemaining, overtime: newRemaining < 0, overtimeSeconds: Math.max(0, -newRemaining) }
        return prev.running ? withStartAnchor(nextState, newRemaining) : withPauseAnchor(nextState, newRemaining)
      },
    })
    setEditingDurationId(null)
  }

  useEffect(() => {
    transcriptTextRef.current = transcriptText
  }, [transcriptText])

  useEffect(() => {
    autoDisplayScripturesRef.current = autoDisplayScriptures
  }, [autoDisplayScriptures])

  const displayCaptionOnScreen = useCallback((caption: CaptionCue, options: { announce?: boolean } = {}) => {
    const announce = options.announce ?? true
    const previous = presentStateRef.current
    if (
      previous.mode === 'caption' &&
      previous.activeCaption?.id === caption.id &&
      previous.activeCaption?.text === caption.text
    ) {
      return previous
    }

    if (!announce) {
      const next = displayCaption(previous, caption)
      setPresentStateAndPersist(next)
      setLastAction({ label: 'Caption live', at: Date.now() })
      return next
    }

    return runPresentAction({
      title: 'Caption live',
      detail: `${caption.kind === 'quote' ? 'Quote' : 'Key point'} is now live on the big screen.`,
      undoDetail: 'Returned to the previous live screen content.',
      updater: prev => displayCaption(prev, caption),
    })
  }, [runPresentAction, setPresentStateAndPersist])

  const queueDetectedScriptures = useCallback(async (detected: ScriptureSuggestion[]) => {
    if (!detected.length) return

    const queuedAt = Date.now()
    const queued = detected.map(item => ({ ...item, queuedAt }))
    setScriptureSuggestions(prev => {
      const merged = new Map<string, QueuedScriptureSuggestion>()
      for (const item of [...queued, ...prev]) {
        if (!merged.has(item.canonicalId)) merged.set(item.canonicalId, item)
      }
      return Array.from(merged.values())
        .sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'verse' ? -1 : 1
          return b.queuedAt - a.queuedAt
        })
        .slice(0, SCRIPTURE_SUGGESTION_LIMIT)
    })

    if (!autoDisplayScripturesRef.current) return

    for (const suggestion of queued) {
      if (suggestion.kind !== 'verse' || suggestion.confidence !== 'high') continue
      const lastDisplayedAt = autoDisplayedSuggestionTimesRef.current.get(suggestion.canonicalId) ?? 0
      if (Date.now() - lastDisplayedAt < SCRIPTURE_AUTO_DISPLAY_COOLDOWN_MS) continue
      autoDisplayedSuggestionTimesRef.current.set(suggestion.canonicalId, Date.now())
      await revealSuggestedScriptureRef.current(suggestion, { display: true, switchTab: false })
      break
    }
  }, [])

  const queueDetectedCaptions = useCallback((detected: CaptionCue[]) => {
    if (!detected.length) return

    setCaptionSuggestions(prev => {
      const merged = new Map<string, CaptionCue>()
      for (const item of [...detected, ...prev]) {
        if (!merged.has(item.id)) merged.set(item.id, item)
      }
      return Array.from(merged.values())
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          if (a.kind !== b.kind) return a.kind === 'quote' ? -1 : 1
          return b.createdAt - a.createdAt
        })
        .slice(0, CAPTION_SUGGESTION_LIMIT)
    })
  }, [])

  const refreshCaptionSuggestionsFromTranscript = useCallback((sourceTranscript: string) => {
    const transcript = sourceTranscript.trim()
    if (!transcript) {
      setCaptionSuggestions([])
      return []
    }

    const detected = extractCaptionCues(transcript, {
      limit: CAPTION_SUGGESTION_LIMIT,
      createdAt: Date.now(),
    })

    setCaptionSuggestions(detected)

    return detected
  }, [])

  const beginCaptionEditing = useCallback((caption: CaptionCue) => {
    setCaptionDraft(caption)
    setCaptionDraftText(caption.text)
  }, [])

  const persistCaptionDraftToQueue = useCallback(() => {
    if (!captionDraft) return null

    const nextText = captionDraftText.trim()
    if (!nextText) {
      showToastMessage({
        title: 'Caption text required',
        detail: 'Write the edited caption text before sending it live.',
        tone: 'warning',
      })
      return null
    }

    const updatedCaption: CaptionCue = {
      ...captionDraft,
      text: nextText,
      sourceText: captionDraft.sourceText || captionDraft.text,
    }

    setCaptionSuggestions(prev => prev.map(item => (
      item.id === updatedCaption.id
        ? updatedCaption
        : item
    )))
    setCaptionDraft(updatedCaption)

    return updatedCaption
  }, [captionDraft, captionDraftText, showToastMessage])

  const sendEditedCaptionLive = useCallback(() => {
    const updatedCaption = persistCaptionDraftToQueue()
    if (!updatedCaption) return
    displayCaptionOnScreen(updatedCaption)
  }, [displayCaptionOnScreen, persistCaptionDraftToQueue])

  const downloadTranscript = useCallback(() => {
    const transcript = transcriptTextRef.current.trim() || refinedTranscriptTextRef.current.trim()
    if (!transcript) {
      showToastMessage({
        title: 'No transcript yet',
        detail: 'Start the microphone first, then download the sermon transcript when text appears.',
        tone: 'warning',
      })
      return
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const lines = [
      'Elim Christian Garden International',
      'Sermon Transcript Export',
      '',
      `Exported: ${new Date().toLocaleString()}`,
      `Provider: ${transcriptProviderMode === 'hybrid' ? 'Hybrid' : transcriptProviderMode === 'openai' ? 'OpenAI' : 'Browser'}`,
      `Engine: ${transcriptProviderMode === 'hybrid'
        ? `Browser speech recognition + OpenAI ${openAITranscribeModel || 'transcription'} refinement`
        : transcriptProviderMode === 'openai'
          ? `OpenAI ${openAITranscribeModel || 'transcription'} live chunk transcription`
          : 'Local browser speech recognition'}`,
      '',
      transcript,
      '',
    ]

    if (
      transcriptTextRef.current.trim() &&
      refinedTranscriptTextRef.current.trim() &&
      refinedTranscriptTextRef.current.trim() !== transcriptTextRef.current.trim()
    ) {
      lines.push('OpenAI Refined Transcript', '', refinedTranscriptTextRef.current.trim(), '')
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sermon-transcript-${timestamp}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    showToastMessage({
      title: 'Transcript downloaded',
      detail: 'The current sermon transcript was exported as a text file for editing and sharing.',
      tone: 'success',
    })
  }, [openAITranscribeModel, showToastMessage, transcriptProviderMode])

  const handleTranscriptFinalChunk = useCallback(async (finalizedChunk: string) => {
    const cleanChunk = finalizedChunk.trim()
    if (!cleanChunk) return
    if (!shouldAppendTranscriptChunk(transcriptTextRef.current, cleanChunk)) return

    const nextTranscript = appendTranscript(transcriptTextRef.current, cleanChunk)
    transcriptTextRef.current = nextTranscript
    setTranscriptText(nextTranscript)

    const mergedDetections = new Map<string, ScriptureSuggestion>()
    for (const item of detectScriptureSuggestions(cleanChunk)) {
      if (!mergedDetections.has(item.canonicalId)) mergedDetections.set(item.canonicalId, item)
    }

    await queueDetectedScriptures(Array.from(mergedDetections.values()))

    if (captionsEnabled) {
      queueDetectedCaptions(
        extractCaptionCues(cleanChunk, {
          limit: 4,
          createdAt: Date.now(),
        })
      )
    }
  }, [captionsEnabled, queueDetectedCaptions, queueDetectedScriptures])

  const processTranscriptRefinementQueue = useCallback(async () => {
    if (transcriptRefinementInFlightRef.current) return

    transcriptRefinementInFlightRef.current = true

    try {
      while (transcriptRefinementQueueRef.current.length > 0) {
        const nextChunk = transcriptRefinementQueueRef.current.shift()
        if (!nextChunk) continue
        try {
          const response = await fetch('/api/scripture-assist/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: nextChunk.audioBase64,
              mimeType: nextChunk.mimeType,
              recentTranscript: transcriptTextRef.current.slice(-1400),
            }),
          })

          const payload = await response.json().catch(() => null)
          if (!response.ok) {
            throw new Error(typeof payload?.error === 'string' ? payload.error : `OpenAI transcription failed with status ${response.status}.`)
          }

          const refinedChunk = typeof payload?.text === 'string' ? payload.text.trim() : ''
          if (!refinedChunk) {
            emptyOpenAIChunkCountRef.current += 1
            if (
              transcriptProviderModeRef.current === 'openai' &&
              browserTranscriptSupported &&
              emptyOpenAIChunkCountRef.current >= OPENAI_EMPTY_CHUNK_LIMIT
            ) {
              setOpenAITranscriptError('OpenAI is hearing audio but not returning words yet. Browser speech assist was started so you can keep working.')
              setOpenAIBrowserAssistActive(true)
              setTranscriptError('')
              setTranscriptInterimText('')
              try {
                speechRecognitionRef.current?.start()
              } catch {}
            }
            continue
          }

          emptyOpenAIChunkCountRef.current = 0
          setOpenAIBrowserAssistActive(false)
          if (!shouldAppendTranscriptChunk(refinedTranscriptTextRef.current, refinedChunk)) continue

          const nextRefinedTranscript = appendTranscript(refinedTranscriptTextRef.current, refinedChunk)
          refinedTranscriptTextRef.current = nextRefinedTranscript
          setRefinedTranscriptText(nextRefinedTranscript)

          if (transcriptProviderModeRef.current !== 'browser') {
            const nextTranscript = appendTranscript(transcriptTextRef.current, refinedChunk)
            transcriptTextRef.current = nextTranscript
            setTranscriptText(nextTranscript)
          }

          const mergedDetections = new Map<string, ScriptureSuggestion>()
          if (Array.isArray(payload?.suggestions)) {
            for (const item of payload.suggestions as ScriptureSuggestion[]) {
              if (item?.canonicalId && !mergedDetections.has(item.canonicalId)) {
                mergedDetections.set(item.canonicalId, item)
              }
            }
          }

          for (const item of detectScriptureSuggestions(refinedChunk)) {
            if (!mergedDetections.has(item.canonicalId)) mergedDetections.set(item.canonicalId, item)
          }

          await queueDetectedScriptures(Array.from(mergedDetections.values()))

          if (captionsEnabledRef.current) {
            queueDetectedCaptions(
              extractCaptionCues(refinedChunk, {
                limit: 4,
                createdAt: Date.now(),
              })
            )
          }
        } catch (error) {
          emptyOpenAIChunkCountRef.current = 0
          setOpenAITranscriptError(
            error instanceof Error ? error.message : 'OpenAI transcript refinement failed.'
          )
        }
      }
    } finally {
      transcriptRefinementInFlightRef.current = false
    }
  }, [browserTranscriptSupported, queueDetectedCaptions, queueDetectedScriptures])

  const enqueueOpenAITranscriptBlob = useCallback(async (blob: Blob, mimeType: string) => {
    if (!blob.size) return

    try {
      const audioBase64 = await blobToBase64(blob)
      transcriptRefinementQueueRef.current.push({
        audioBase64,
        mimeType: mimeType || blob.type || 'audio/webm',
      })
      void processTranscriptRefinementQueue()
    } catch (error) {
      setOpenAITranscriptError(
        error instanceof Error ? error.message : 'OpenAI audio capture failed.'
      )
    }
  }, [processTranscriptRefinementQueue])

  const clearTranscriptAssist = useCallback(() => {
    transcriptTextRef.current = ''
    refinedTranscriptTextRef.current = ''
    emptyOpenAIChunkCountRef.current = 0
    setTranscriptText('')
    setRefinedTranscriptText('')
    setTranscriptInterimText('')
    setTranscriptError('')
    setOpenAITranscriptError('')
    setOpenAIBrowserAssistActive(false)
    setScriptureSuggestions([])
    setCaptionSuggestions([])
    setCaptionDraft(null)
    setCaptionDraftText('')
    autoDisplayedSuggestionTimesRef.current.clear()
    transcriptRefinementQueueRef.current = []
  }, [])

  useEffect(() => {
    if (!captionsEnabled) return
    if (!transcriptTextRef.current.trim()) return
    refreshCaptionSuggestionsFromTranscript(transcriptTextRef.current)
  }, [captionsEnabled, refreshCaptionSuggestionsFromTranscript])

  useEffect(() => {
    if (captionSuggestions.length === 0) {
      setCaptionDraft(null)
      setCaptionDraftText('')
      return
    }
    if (!captionDraft) {
      beginCaptionEditing(captionSuggestions[0])
      return
    }
    if (!captionSuggestions.some(item => item.id === captionDraft.id)) {
      beginCaptionEditing(captionSuggestions[0])
    }
  }, [beginCaptionEditing, captionDraft, captionSuggestions])

  const stopBrowserTranscriptListener = useCallback(() => {
    setBrowserTranscriptListening(false)
    setTranscriptInterimText('')
    try {
      speechRecognitionRef.current?.stop()
    } catch {}
  }, [])

  const startBrowserTranscriptListener = useCallback(() => {
    if (!speechRecognitionRef.current) {
      setTranscriptError('Live transcription is not available in this browser. Please use Chrome or Edge on desktop.')
      return
    }

    setTranscriptError('')
    setTranscriptInterimText('')
    try {
      speechRecognitionRef.current.start()
    } catch {
      // Recognition may already be running during restarts.
    }
  }, [])

  const flushOpenAIAudioChunk = useCallback(() => {
    const pcmChunks = openAIPcmChunksRef.current
    if (pcmChunks.length === 0) return

    const samples = mergeFloat32Chunks(pcmChunks)
    openAIPcmChunksRef.current = []
    if (samples.length === 0) return

    const wavBlob = encodePcmAsWav(samples, openAISampleRateRef.current)
    if (wavBlob.size < OPENAI_TRANSCRIPT_MIN_CHUNK_BYTES) return

    void enqueueOpenAITranscriptBlob(wavBlob, 'audio/wav')
  }, [enqueueOpenAITranscriptBlob])

  const releaseOpenAITranscriptResources = useCallback(() => {
    if (openAIChunkFlushTimerRef.current) {
      clearInterval(openAIChunkFlushTimerRef.current)
      openAIChunkFlushTimerRef.current = null
    }

    const processor = openAIProcessorRef.current
    if (processor) {
      processor.onaudioprocess = null
      try {
        processor.disconnect()
      } catch {}
    }
    openAIProcessorRef.current = null

    const source = openAIAudioSourceRef.current
    if (source) {
      try {
        source.disconnect()
      } catch {}
    }
    openAIAudioSourceRef.current = null

    const audioContext = openAIAudioContextRef.current
    openAIAudioContextRef.current = null
    if (audioContext) {
      void audioContext.close().catch(() => {})
    }

    const stream = mediaStreamRef.current
    mediaStreamRef.current = null
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
    }

    openAIPcmChunksRef.current = []
    openAIRecorderRunningRef.current = false
    setOpenAITranscriptListening(false)
  }, [])

  const stopOpenAITranscriptListener = useCallback(() => {
    if (!openAIRecorderRunningRef.current) {
      releaseOpenAITranscriptResources()
      return
    }

    flushOpenAIAudioChunk()
    releaseOpenAITranscriptResources()
  }, [flushOpenAIAudioChunk, releaseOpenAITranscriptResources])

  const startOpenAITranscriptListener = useCallback(async () => {
    if (!openAITranscriptConfigured || !openAIRecorderSupported) return
    if (openAIRecorderRunningRef.current) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getSpeechFriendlyAudioConstraints(),
      })

      const windowWithWebkitAudio = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }
      const AudioContextCtor = window.AudioContext || windowWithWebkitAudio.webkitAudioContext
      if (!AudioContextCtor) {
        throw new Error('This browser cannot create raw audio for OpenAI transcription.')
      }

      const audioContext = new AudioContextCtor()
      await audioContext.resume().catch(() => {})
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)

      mediaStreamRef.current = stream
      openAIAudioContextRef.current = audioContext
      openAIAudioSourceRef.current = source
      openAIProcessorRef.current = processor
      openAISampleRateRef.current = audioContext.sampleRate
      openAIPcmChunksRef.current = []
      openAIRecorderRunningRef.current = true
      setOpenAITranscriptError('')

      processor.onaudioprocess = event => {
        if (!openAIRecorderRunningRef.current) return
        const input = event.inputBuffer.getChannelData(0)
        openAIPcmChunksRef.current.push(new Float32Array(input))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
      setOpenAITranscriptListening(true)

      openAIChunkFlushTimerRef.current = window.setInterval(() => {
        if (!openAIRecorderRunningRef.current) return
        flushOpenAIAudioChunk()
      }, OPENAI_TRANSCRIPT_CHUNK_MS)
    } catch (error) {
      setOpenAITranscriptError(
        error instanceof Error
          ? error.message
          : 'Could not start OpenAI background transcription.'
      )
      releaseOpenAITranscriptResources()
    }
  }, [flushOpenAIAudioChunk, openAIRecorderSupported, openAITranscriptConfigured, releaseOpenAITranscriptResources])

  const activateTranscriptProviderMode = useCallback((mode: TranscriptProviderMode) => {
    const canUseBrowser =
      (mode === 'browser' || mode === 'hybrid') &&
      browserTranscriptSupported
    const canUseOpenAI =
      (mode === 'openai' || mode === 'hybrid') &&
      openAITranscriptConfigured &&
      openAIRecorderSupported

    if (!canUseBrowser && !canUseOpenAI) {
      setTranscriptError(
        mode === 'browser'
          ? 'Browser transcription is not available here. Please use Chrome or Edge on desktop.'
          : mode === 'openai'
            ? 'OpenAI transcription needs a configured API key and browser audio capture support.'
            : 'Hybrid transcription needs both browser speech support and OpenAI transcription.'
      )
      return
    }

    shouldKeepListeningRef.current = canUseBrowser
    autoDisplayedSuggestionTimesRef.current.clear()
    setTranscriptError('')
    setOpenAITranscriptError('')
    if (canUseBrowser) startBrowserTranscriptListener()
    if (canUseOpenAI) void startOpenAITranscriptListener()
  }, [browserTranscriptSupported, openAIRecorderSupported, openAITranscriptConfigured, startBrowserTranscriptListener, startOpenAITranscriptListener])

  const startTranscriptListener = useCallback(() => {
    activateTranscriptProviderMode(transcriptProviderMode)
  }, [activateTranscriptProviderMode, transcriptProviderMode])

  const stopTranscriptListener = useCallback(() => {
    shouldKeepListeningRef.current = false
    emptyOpenAIChunkCountRef.current = 0
    setOpenAIBrowserAssistActive(false)
    stopBrowserTranscriptListener()
    stopOpenAITranscriptListener()
  }, [stopBrowserTranscriptListener, stopOpenAITranscriptListener])

  const handleTranscriptProviderModeChange = useCallback((mode: TranscriptProviderMode) => {
    if (mode === transcriptProviderMode) return

    const wasListening = browserTranscriptListening || openAITranscriptListening
    setTranscriptProviderMode(mode)
    setTranscriptError('')
    setOpenAITranscriptError('')
    setOpenAIBrowserAssistActive(false)
    emptyOpenAIChunkCountRef.current = 0

    if (!wasListening) return

    shouldKeepListeningRef.current = false
    stopBrowserTranscriptListener()
    stopOpenAITranscriptListener()

    window.setTimeout(() => {
      activateTranscriptProviderMode(mode)
    }, 180)
  }, [
    activateTranscriptProviderMode,
    browserTranscriptListening,
    openAITranscriptListening,
    stopBrowserTranscriptListener,
    stopOpenAITranscriptListener,
    transcriptProviderMode,
  ])

  const displayVerseOnScreen = useCallback(async (hit: { book: string; chapter: number; verse: number; text: string; translation?: string; reference?: string }) => {
    const selection = await resolveBibleDisplaySelection(hit)
    if (presentStateRef.current.bibleDisplayMode === 'double' && !selection.secondaryVerse) {
      showToastMessage({
        title: 'Second translation unavailable',
        detail: `${hit.book} ${hit.chapter}:${hit.verse} could not be loaded in ${selectedSecondaryTranslation}. Showing one translation instead.`,
        tone: 'warning',
      })
    }
    runPresentAction({
      title: 'Scripture live',
      detail: selection.displayMode === 'double' && selection.secondaryVerse
        ? `${selection.primaryVerse.reference} + ${selection.secondaryVerse.translation}`
        : selection.primaryVerse.reference,
      undoDetail: 'Returned to the previous live screen content.',
      updater: prev => displayVerseSelection(prev, selection.primaryVerse, {
        displayMode: selection.displayMode,
        secondaryVerse: selection.secondaryVerse,
      }),
    })
  }, [resolveBibleDisplaySelection, runPresentAction, selectedSecondaryTranslation, showToastMessage])

  const revealSuggestedScripture = useCallback(async (
    suggestion: ScriptureSuggestion,
    options: { display?: boolean; switchTab?: boolean } = {}
  ) => {
    const shouldDisplay = options.display ?? suggestion.kind === 'verse'
    const shouldSwitchTab = options.switchTab ?? true
    if (shouldSwitchTab) setActiveTab('bible')

    setSelectedBook(suggestion.book)
    setSelectedBookId(suggestion.bookId)
    setSelectedChapter(suggestion.chapter)
    setChapterInput(String(suggestion.chapter))
    setShowBookList(false)
    setShowTranslationList(false)
    setBibleLoading(true)

    try {
      const chapter = await fetchChapter(selectedTranslation, suggestion.bookId, suggestion.chapter, suggestion.book)
      const verses = chapter?.verses ?? []
      setChapterVerses(verses)
      chapterCacheRef.current.set(`${selectedTranslation}:${suggestion.bookId}:${suggestion.chapter}`, verses)

      if (shouldDisplay && suggestion.verse != null) {
        const verse = verses.find(item => item.verse === suggestion.verse)
        if (verse) {
          await displayVerseOnScreen({
            book: suggestion.book,
            chapter: suggestion.chapter,
            verse: suggestion.verse,
            text: verse.text,
            translation: selectedTranslation,
            reference: `${suggestion.book} ${suggestion.chapter}:${suggestion.verse} (${selectedTranslation})`,
          })
        } else {
          showToastMessage({
            title: 'Suggested scripture not found',
            detail: `${suggestion.reference} could not be loaded in ${selectedTranslation}.`,
            tone: 'warning',
          })
        }
      }
    } finally {
      setBibleLoading(false)
    }
  }, [displayVerseOnScreen, selectedTranslation, showToastMessage])

  useEffect(() => {
    revealSuggestedScriptureRef.current = revealSuggestedScripture
  }, [revealSuggestedScripture])

  const dismissScriptureSuggestion = useCallback((canonicalId: string) => {
    setScriptureSuggestions(prev => prev.filter(item => item.canonicalId !== canonicalId))
  }, [])

  const dismissCaptionSuggestion = useCallback((captionId: string) => {
    setCaptionSuggestions(prev => prev.filter(item => item.id !== captionId))
    setCaptionDraft(current => current?.id === captionId ? null : current)
    setCaptionDraftText(current => captionDraft?.id === captionId ? '' : current)
  }, [captionDraft])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setBrowserTranscriptSupported(false)
      return () => {
        shouldKeepListeningRef.current = false
      }
    }

    setBrowserTranscriptSupported(true)

    let restartTimeout: number | null = null
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onstart = () => {
      setBrowserTranscriptListening(true)
      setTranscriptError('')
    }
    recognition.onend = () => {
      setBrowserTranscriptListening(false)
      setTranscriptInterimText('')
      if (!shouldKeepListeningRef.current) return
      restartTimeout = window.setTimeout(() => {
        try {
          recognition.start()
        } catch {}
      }, 250)
    }
    recognition.onerror = event => {
      setTranscriptError(describeSpeechError(event.error))
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldKeepListeningRef.current = false
        setBrowserTranscriptListening(false)
      }
    }
    recognition.onresult = event => {
      let finalized = ''
      let interim = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index]?.[0]?.transcript?.trim()
        if (!transcript) continue
        if (event.results[index].isFinal) finalized = `${finalized} ${transcript}`.trim()
        else interim = `${interim} ${transcript}`.trim()
      }

      setTranscriptInterimText(interim)
      if (finalized) void handleTranscriptFinalChunk(finalized)
    }

    speechRecognitionRef.current = recognition

    return () => {
      shouldKeepListeningRef.current = false
      if (restartTimeout) clearTimeout(restartTimeout)
      speechRecognitionRef.current = null
      recognition.onstart = null
      recognition.onend = null
      recognition.onerror = null
      recognition.onresult = null
      try {
        recognition.stop()
      } catch {}
    }
  }, [handleTranscriptFinalChunk])

  useEffect(() => () => {
    stopOpenAITranscriptListener()
  }, [stopOpenAITranscriptListener])

  const filteredTranslations = translationSearch.trim()
    ? translations.filter(translation =>
      (translation.id || '').toLowerCase().includes(translationSearch.toLowerCase()) ||
      (translation.name || '').toLowerCase().includes(translationSearch.toLowerCase()) ||
      (translation.language || '').toLowerCase().includes(translationSearch.toLowerCase()))
    : translations

  const filteredSecondaryTranslations = secondaryTranslationSearch.trim()
    ? translations.filter(translation =>
      (translation.id || '').toLowerCase().includes(secondaryTranslationSearch.toLowerCase()) ||
      (translation.name || '').toLowerCase().includes(secondaryTranslationSearch.toLowerCase()) ||
      (translation.language || '').toLowerCase().includes(secondaryTranslationSearch.toLowerCase()))
    : translations

  const filteredBooks = bookSearch.trim()
    ? books.filter(book => book.name.toLowerCase().includes(bookSearch.toLowerCase()))
    : books

  const quickRefSuggestion = useMemo(() => {
    if (!quickRef.trim()) return null

    const leadingWhitespace = quickRef.match(/^\s*/)?.[0] ?? ''
    const trimmed = quickRef.trimStart()
    const digitIndex = trimmed.search(/\d/)
    const rawBookPart = (digitIndex === -1 ? trimmed : trimmed.slice(0, digitIndex)).trim()
    if (!rawBookPart) return null

    const normalizedBookPart = normalizeSearchText(rawBookPart)
    if (!normalizedBookPart) return null

    const bookList = books.length > 0 ? books : STANDARD_BOOKS
    const match = bookList.find(book => {
      const normalizedName = normalizeSearchText(book.name)
      return normalizedName.startsWith(normalizedBookPart) || normalizedName.includes(normalizedBookPart)
    })

    if (!match) return null

    const suffix = digitIndex === -1 ? '' : trimmed.slice(digitIndex).trimStart()
    const nextValue = `${leadingWhitespace}${match.name}${suffix ? ` ${suffix}` : ''}`
    if (nextValue === quickRef) return null

    return {
      book: match.name,
      value: nextValue,
    }
  }, [books, quickRef])

  const acceptQuickRefSuggestion = useCallback(() => {
    if (!quickRefSuggestion) return
    setQuickRef(quickRefSuggestion.value)
    setQuickRefError('')
  }, [quickRefSuggestion])

  const selectedBookMeta = useMemo(
    () =>
      books.find(book => String(book.bookid) === selectedBookId || book.name === selectedBook)
      ?? STANDARD_BOOKS.find(book => String(book.bookid) === selectedBookId || book.name === selectedBook)
      ?? null,
    [books, selectedBook, selectedBookId]
  )
  const maxChapterCount = Math.max(1, selectedBookMeta?.chapters ?? selectedChapter)
  const canGoPrevChapter = selectedChapter > 1
  const canGoNextChapter = selectedChapter < maxChapterCount
  const chapterViewVerses = useMemo(() => chapterVerses, [chapterVerses])
  const activeVerseNumber =
    presentState.activeVerse?.book === selectedBook && presentState.activeVerse?.chapter === selectedChapter
      ? presentState.activeVerse.verse
      : null
  const activeVerseIndex =
    activeVerseNumber == null
      ? -1
      : chapterViewVerses.findIndex(verse => verse.verse === activeVerseNumber)
  const canGoPrevVerse = activeVerseIndex > 0
  const canGoNextVerse = activeVerseIndex >= 0 && activeVerseIndex < chapterViewVerses.length - 1

  const jumpToChapter = (chapter: number) => {
    const nextChapter = Math.min(maxChapterCount, Math.max(1, chapter))
    setSelectedChapter(nextChapter)
    setChapterInput(String(nextChapter))
  }

  const jumpToVerse = (delta: number) => {
    if (activeVerseIndex < 0) return
    const targetVerse = chapterViewVerses[activeVerseIndex + delta]
    if (!targetVerse) return
    void displayVerseOnScreen({
      book: selectedBook,
      chapter: selectedChapter,
      verse: targetVerse.verse,
      text: targetVerse.text,
      translation: selectedTranslation,
      reference: `${selectedBook} ${selectedChapter}:${targetVerse.verse} (${selectedTranslation})`,
    })
  }

  const handleQuickRef = async () => {
    const raw = quickRef.trim()
    if (!raw) return
    setQuickRefError('')
    const match = raw.match(/^(.+?)\s+(\d+)(?::(\d+))?$/)
    if (!match) {
      setQuickRefError('Format: Book Chapter:Verse  e.g. John 3:16')
      return
    }
    const bookQuery = match[1].toLowerCase()
    const chapterNumber = parseInt(match[2], 10)
    const verseNumber = match[3] ? parseInt(match[3], 10) : null
    const bookList = books.length > 0 ? books : STANDARD_BOOKS
    const found = bookList.find(book => book.name.toLowerCase().startsWith(bookQuery) || book.name.toLowerCase().includes(bookQuery))
    if (!found) {
      setQuickRefError(`Book not found: "${match[1]}"`)
      return
    }
    setSelectedBook(found.name)
    setSelectedBookId(String(found.bookid))
    setSelectedChapter(chapterNumber)
    setChapterInput(String(chapterNumber))
    setShowBookList(false)
    setShowTranslationList(false)
    if (verseNumber) {
      setBibleLoading(true)
      const chapter = await fetchChapter(selectedTranslation, String(found.bookid), chapterNumber, found.name)
      if (chapter) {
        setChapterVerses(chapter.verses)
        chapterCacheRef.current.set(`${selectedTranslation}:${found.bookid}:${chapterNumber}`, chapter.verses)
        setBibleLoading(false)
        const verse = chapter.verses.find(item => item.verse === verseNumber)
        if (verse) {
          await displayVerseOnScreen({ book: found.name, chapter: chapterNumber, verse: verseNumber, text: verse.text, translation: selectedTranslation, reference: `${found.name} ${chapterNumber}:${verseNumber} (${selectedTranslation})` })
        } else {
          setQuickRefError(`Verse ${verseNumber} not found in ${found.name} ${chapterNumber}`)
        }
      } else {
        setBibleLoading(false)
        setQuickRefError('Could not load chapter')
      }
    }
    setQuickRef('')
  }

  const runKeywordSearch = async () => {
    const raw = keywordSearch.trim()
    if (!raw) {
      setKeywordResults([])
      setKeywordSearchError('')
      return
    }
    const normalizedQuery = normalizeSearchText(raw)
    const queryTerms = normalizedQuery.split(' ').filter(term => term.length >= 2)
    const phraseQuery = queryTerms.length > 1 ? normalizedQuery : null
    if (!queryTerms.length) {
      setKeywordSearchError('Please enter at least one word to search')
      return
    }
    const token = Date.now()
    bibleSearchTokenRef.current = token
    setKeywordSearching(true)
    setKeywordSearchError('')
    setKeywordResults([])
    setKeywordSearchProgress('Starting search…')
    try {
      const bookList = books.length > 0 ? books : STANDARD_BOOKS
      const hits: BibleSearchHit[] = []
      for (const book of bookList) {
        if (bibleSearchTokenRef.current !== token) return
        setKeywordSearchProgress(`Searching ${book.name}…`)
        const chapters = Math.max(1, book.chapters || 1)
        for (let chapter = 1; chapter <= chapters; chapter += 1) {
          if (bibleSearchTokenRef.current !== token) return
          const cacheKey = `${selectedTranslation}:${book.bookid}:${chapter}`
          let verses = chapterCacheRef.current.get(cacheKey)
          if (!verses) {
            const response = await fetchChapter(selectedTranslation, String(book.bookid), chapter, book.name)
            verses = response?.verses ?? []
            chapterCacheRef.current.set(cacheKey, verses)
          }
          for (const verse of verses) {
            const { matched, score, matchedTerms } = scoreVerse(verse.text, queryTerms, phraseQuery)
            if (matched) {
              hits.push({
                book: book.name,
                bookId: String(book.bookid),
                chapter,
                verse: verse.verse,
                text: verse.text,
                translation: selectedTranslation,
                reference: `${book.name} ${chapter}:${verse.verse} (${selectedTranslation})`,
                score,
                matchedTerms,
              })
            }
            if (!phraseQuery && hits.length >= KEYWORD_SEARCH_MAX_RESULTS * 3) break
          }
          if (!phraseQuery && hits.length >= KEYWORD_SEARCH_MAX_RESULTS * 3) break
        }
        if (!phraseQuery && hits.length >= KEYWORD_SEARCH_MAX_RESULTS * 3) break
      }
      if (bibleSearchTokenRef.current !== token) return
      hits.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      const top = hits.slice(0, KEYWORD_SEARCH_MAX_RESULTS)
      setKeywordResults(top)
      setKeywordSearchProgress('')
      if (top.length === 0) setKeywordSearchError(`No results found for "${raw}". Try a different or shorter word.`)
    } catch {
      if (bibleSearchTokenRef.current === token) setKeywordSearchError('Keyword search failed')
    } finally {
      if (bibleSearchTokenRef.current === token) {
        setKeywordSearching(false)
        setKeywordSearchProgress('')
      }
    }
  }

  const openKeywordHit = async (hit: BibleSearchHit) => {
    setSelectedBook(hit.book)
    setSelectedBookId(hit.bookId)
    setSelectedChapter(hit.chapter)
    setChapterInput(String(hit.chapter))
    setKeywordSearchError('')
    const cacheKey = `${selectedTranslation}:${hit.bookId}:${hit.chapter}`
    let verses = chapterCacheRef.current.get(cacheKey)
    if (!verses) {
      const chapter = await fetchChapter(selectedTranslation, hit.bookId, hit.chapter, hit.book)
      verses = chapter?.verses ?? []
      chapterCacheRef.current.set(cacheKey, verses)
    }
    setChapterVerses(verses)
    await displayVerseOnScreen(hit)
  }

  const resetSongEditor = () => {
    setEditingSongId(null)
    setNewSongTitle('')
    setNewSongArtist('')
    setNewSongLyrics('')
    setNewSongInterpretation('')
    setShowSongEditor(false)
  }

  const beginSongEditing = (song: Song) => {
    setEditingSongId(song.id)
    setNewSongTitle(song.title)
    setNewSongArtist(song.artist ?? '')
    setNewSongLyrics(stringifySongLines(song.lines, 'text'))
    setNewSongInterpretation(stringifySongLines(song.lines, 'interpretation'))
    setShowSongEditor(true)
  }

  const toggleSongEditor = () => {
    if (showSongEditor) {
      resetSongEditor()
      return
    }
    setEditingSongId(null)
    setNewSongTitle('')
    setNewSongArtist('')
    setNewSongLyrics('')
    setNewSongInterpretation('')
    setShowSongEditor(true)
  }

  const saveSong = () => {
    if (!newSongTitle.trim() || !newSongLyrics.trim()) return
    const lines = buildSongLines(newSongLyrics, newSongInterpretation)
    runPresentAction({
      title: editingSongId !== null ? 'Song updated' : 'Song saved',
      detail: editingSongId !== null
        ? `${newSongTitle.trim()} was updated in the song library.`
        : `${newSongTitle.trim()} added to the song library.`,
      undoDetail: editingSongId !== null ? 'Reverted the song to its previous version.' : 'Removed the newly added song.',
      updater: prev => editingSongId !== null
        ? updateSong(prev, editingSongId, { title: newSongTitle.trim(), artist: newSongArtist.trim() || undefined, lines })
        : addSong(prev, { title: newSongTitle.trim(), artist: newSongArtist.trim() || undefined, lines }),
    })
    resetSongEditor()
  }

  const presentSong = (songId: number) => {
    const song = presentStateRef.current.songs.find(item => item.id === songId)
    runPresentAction({
      title: 'Song live',
      detail: song ? `${song.title} is now on screen.` : 'Song is now on screen.',
      undoDetail: 'Returned to the previous live screen content.',
      updater: prev => goToLine(selectSong(prev, songId), 0),
    })
  }

  const goToSongLine = (lineIndex: number) => {
    const song = presentStateRef.current.songs.find(item => item.id === presentStateRef.current.activeSongId)
    runPresentAction({
      title: 'Song line updated',
      detail: song ? `${song.title} · line ${lineIndex + 1}` : `Line ${lineIndex + 1} is now live.`,
      undoDetail: 'Returned the song to the previous live line.',
      updater: prev => goToLine(prev, lineIndex),
    })
  }

  const songLine = (delta: number) => {
    runPresentAction({
      title: 'Song line updated',
      detail: 'Advanced the current live song line.',
      undoDetail: 'Returned the song to the previous live line.',
      updater: prev => goToLine(prev, prev.activeLineIndex + delta),
    })
  }

  const presentImageOnScreen = (imageId: number) => {
    const image = presentStateRef.current.images.find(item => item.id === imageId)
    runPresentAction({
      title: 'Image live',
      detail: image ? `${image.name} is now on screen.` : 'Image is now on screen.',
      undoDetail: 'Returned to the previous live screen content.',
      updater: prev => displayImage(prev, imageId),
    })
  }

  const presentVideoOnScreen = (videoId: number) => {
    const video = presentStateRef.current.videos.find(item => item.id === videoId)
    runPresentAction({
      title: 'Video live',
      detail: video ? `${video.name} is now playing.` : 'Video is now live.',
      undoDetail: 'Returned to the previous live screen content.',
      updater: prev => displayVideo(prev, videoId),
    })
  }

  const presentDeckOnScreen = (presentationId: number) => {
    const presentation = presentStateRef.current.presentations.find(item => item.id === presentationId)
    runPresentAction({
      title: 'Presentation live',
      detail: presentation ? `${presentation.name} is now on screen.` : 'Presentation is now on screen.',
      undoDetail: 'Returned to the previous live screen content.',
      updater: prev => displayPresentation(prev, presentationId),
    })
  }

  const presentNoticeOnScreen = (noticeId: number) => {
    const notice = presentStateRef.current.notices.find(item => item.id === noticeId)
    runPresentAction({
      title: 'Notice live',
      detail: notice ? `${notice.title} is now on screen.` : 'Notice is now on screen.',
      undoDetail: 'Returned to the previous live screen content.',
      updater: prev => displayNotice(prev, noticeId),
    })
  }

  const handleBibleBackgroundUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = loadEvent => {
        const value = loadEvent.target?.result as string
        updatePresent(prev => addBibleBackground(prev, { name: file.name, kind: 'image', value }))
        setLastAction({ label: 'Bible background added', at: Date.now() })
        showToastMessage({ title: 'Bible background uploaded', detail: file.name, tone: 'success' })
      }
      reader.readAsDataURL(file)
    })
    event.target.value = ''
  }

  const handleSelectBibleBackground = (backgroundId: string) => {
    const background = presentStateRef.current.bibleBackgrounds.find(item => item.id === backgroundId)
    updatePresent(prev => setBibleBackground(prev, backgroundId))
    setLastAction({ label: 'Bible background updated', at: Date.now() })
    showToastMessage({
      title: 'Bible background updated',
      detail: background ? `${background.name} is now behind the scripture.` : 'The selected background is now live.',
      tone: 'success',
    })
  }

  const handleDeleteBibleBackground = (backgroundId: string) => {
    const background = presentStateRef.current.bibleBackgrounds.find(item => item.id === backgroundId)
    if (!background || background.builtIn) return
    updatePresent(prev => deleteBibleBackground(prev, backgroundId))
    setLastAction({ label: 'Bible background removed', at: Date.now() })
    showToastMessage({
      title: 'Bible background deleted',
      detail: `${background.name} was removed from the scripture background library.`,
      tone: 'info',
    })
  }

  const handleBibleTextColorChange = (color: string) => {
    updatePresent(prev => setBibleTextColor(prev, color))
    setLastAction({ label: 'Bible text color updated', at: Date.now() })
    showToastMessage({
      title: 'Bible text color updated',
      detail: 'The scripture text color was changed on the big screen.',
      tone: 'success',
    })
  }

  const handleBibleFontFamilyChange = (fontFamilyId: string) => {
    updatePresent(prev => setBibleFontFamily(prev, fontFamilyId))
    setLastAction({ label: 'Bible font updated', at: Date.now() })
    showToastMessage({
      title: 'Bible font updated',
      detail: 'The scripture font family was changed on the big screen.',
      tone: 'success',
    })
  }

  const handleBibleFontScaleChange = (fontScale: number) => {
    const nextScale = clampBibleFontScale(fontScale)
    updatePresent(prev => setBibleFontScale(prev, nextScale))
    setLastAction({ label: 'Bible font size updated', at: Date.now() })
  }

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = loadEvent => {
        const url = loadEvent.target?.result as string
        updatePresent(prev => addImage(prev, { name: file.name, url }))
        setLastAction({ label: 'Image added to library', at: Date.now() })
        showToastMessage({ title: 'Image uploaded', detail: file.name, tone: 'success' })
      }
      reader.readAsDataURL(file)
    })
  }

  const handleVideoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    setMediaUploadProgress('Processing video…')
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file)
      updatePresent(prev => addVideo(prev, { name: file.name, url, type: file.type || 'video/mp4' }))
      setLastAction({ label: 'Video added to library', at: Date.now() })
      showToastMessage({ title: 'Video uploaded', detail: file.name, tone: 'success' })
    })
    setMediaUploadProgress('')
    event.target.value = ''
  }

  const handlePresentationUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    setMediaUploadProgress('Uploading…')
    for (const file of Array.from(files)) {
      const isPptx = file.name.toLowerCase().endsWith('.pptx') || file.name.toLowerCase().endsWith('.ppt') || file.name.toLowerCase().endsWith('.odp')
      if (isPptx) {
        const formData = new FormData()
        formData.append('file', file)
        try {
          setMediaUploadProgress(`Converting ${file.name}…`)
          const res = await fetch('/api/convert-presentation', { method: 'POST', body: formData })
          if (res.ok) {
            const data = await res.json()
            updatePresent(prev => addPresentation(prev, { name: file.name.replace(/\.(pptx?|odp)$/i, '.pdf'), url: data.url, type: 'application/pdf', pageCount: data.pageCount }))
            setLastAction({ label: 'Presentation added to library', at: Date.now() })
            showToastMessage({ title: 'Presentation ready', detail: file.name, tone: 'success' })
          } else {
            const url = URL.createObjectURL(file)
            updatePresent(prev => addPresentation(prev, { name: file.name, url, type: file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }))
            setLastAction({ label: 'Presentation added to library', at: Date.now() })
            showToastMessage({ title: 'Presentation uploaded', detail: file.name, tone: 'warning' })
          }
        } catch {
          const url = URL.createObjectURL(file)
          updatePresent(prev => addPresentation(prev, { name: file.name, url, type: file.type }))
          setLastAction({ label: 'Presentation added to library', at: Date.now() })
          showToastMessage({ title: 'Presentation uploaded', detail: file.name, tone: 'warning' })
        }
      } else {
        const reader = new FileReader()
        reader.onload = loadEvent => {
          const url = loadEvent.target?.result as string
          updatePresent(prev => addPresentation(prev, { name: file.name, url, type: 'application/pdf' }))
          setLastAction({ label: 'Presentation added to library', at: Date.now() })
          showToastMessage({ title: 'Presentation uploaded', detail: file.name, tone: 'success' })
        }
        reader.readAsDataURL(file)
      }
    }
    setMediaUploadProgress('')
    event.target.value = ''
  }

  const addGoogleSlides = () => {
    setGoogleSlidesError('')
    const raw = googleSlidesUrl.trim()
    if (!raw) return
    let embedUrl = raw
    if (raw.includes('docs.google.com/presentation')) {
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
    runPresentAction({
      title: 'Google Slides added',
      detail: 'Google Slides deck added to the presentation library.',
      undoDetail: 'Removed the Google Slides deck that was just added.',
      updater: prev => addPresentation(prev, {
        name: 'Google Slides',
        url: embedUrl,
        type: 'google-slides',
        embedUrl,
      }),
    })
    setGoogleSlidesUrl('')
  }

  const saveNotice = () => {
    if (!newNoticeTitle.trim()) return
    runPresentAction({
      title: 'Notice saved',
      detail: `${newNoticeTitle.trim()} added to announcements.`,
      undoDetail: 'Removed the newly created notice.',
      updater: prev => addNotice(prev, { title: newNoticeTitle.trim(), body: newNoticeBody.trim(), style: newNoticeStyle }),
    })
    setNewNoticeTitle('')
    setNewNoticeBody('')
    setNewNoticeStyle('default')
    setShowNoticeEditor(false)
  }

  const goBlank = () => runPresentAction({
    title: 'Blank screen live',
    detail: 'The big screen output is now intentionally blank.',
    tone: 'warning',
    undoDetail: 'Returned to the previous live screen content.',
    updater: prev => (prev.mode === 'blank' ? prev : setMode(prev, 'blank')),
  })

  const goTimerMode = () => runPresentAction({
    title: 'Timer live',
    detail: 'The big screen is now showing the main countdown timer.',
    undoDetail: 'Returned to the previous live screen content.',
    updater: prev => (prev.mode === 'timer' ? prev : setMode(prev, 'timer')),
  })

  const logoutControl = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    window.location.assign('/login?logged_out=1')
  }

  shortcutActionsRef.current = { startPause, goNext, goPrev, jumpToVerse, songLine }

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON'
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return

      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault()
        setShowShortcutHelp(true)
        return
      }

      if (event.key === 'Escape') {
        setShowShortcutHelp(false)
        return
      }

      if (event.altKey) {
        const index = Number(event.key) - 1
        if (index >= 0 && index < TAB_OPTIONS.length) {
          event.preventDefault()
          setActiveTab(TAB_OPTIONS[index].id)
          return
        }
      }

      if (event.key === '/' && activeTab === 'bible') {
        event.preventDefault()
        keywordSearchInputRef.current?.focus()
        keywordSearchInputRef.current?.select()
        return
      }

      if (activeTab === 'timer') {
        if (event.code === 'Space') {
          event.preventDefault()
          shortcutActionsRef.current.startPause()
          return
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          shortcutActionsRef.current.goNext()
          return
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          shortcutActionsRef.current.goPrev()
          return
        }
      }

      if (activeTab === 'bible') {
        if (event.key === 'ArrowRight' && canGoNextVerse) {
          event.preventDefault()
          shortcutActionsRef.current.jumpToVerse(1)
          return
        }
        if (event.key === 'ArrowLeft' && canGoPrevVerse) {
          event.preventDefault()
          shortcutActionsRef.current.jumpToVerse(-1)
          return
        }
      }

      if (activeTab === 'songs' && presentStateRef.current.mode === 'song') {
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          shortcutActionsRef.current.songLine(1)
          return
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          shortcutActionsRef.current.songLine(-1)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, canGoNextVerse, canGoPrevVerse])

  const current = timerState.activities[timerState.currentIndex] ?? { name: 'No Activity', duration: 0 }
  const currentSeconds = Math.max(1, (current.duration * 60) + (timerState.additionalSeconds ?? 0))
  const currentAdditionalMinutes = (timerState.additionalSeconds ?? 0) / 60
  const color = getTimerColor(displayRemaining, currentSeconds)
  const theme = COLOR_MAP[color]
  const pct = Math.max(0, Math.min(100, (displayRemaining / currentSeconds) * 100))
  const totalMins = timerState.activities.reduce((sum, activity) => sum + (activity.duration || 0), 0) + currentAdditionalMinutes
  const activeSong = presentState.songs.find(song => song.id === presentState.activeSongId) ?? null
  const activeSongLine = activeSong?.lines[presentState.activeLineIndex] ?? null
  const activeCaption = presentState.activeCaption
  const activeSecondaryVerse = presentState.activeSecondaryVerse
  const activeImage = presentState.images.find(item => item.id === presentState.activeImageId) ?? null
  const activeVideo = presentState.videos.find(item => item.id === presentState.activeVideoId) ?? null
  const activePresentation = presentState.presentations.find(item => item.id === presentState.activePresentationId) ?? null
  const activeNotice = presentState.notices.find(item => item.id === presentState.activeNoticeId) ?? null
  const nextActivity = timerState.activities[timerState.currentIndex + 1] ?? null
  const transcriptListening = browserTranscriptListening || openAITranscriptListening
  const browserTranscriptAvailable = browserTranscriptSupported
  const openAITranscriptAvailable = openAITranscriptConfigured && openAIRecorderSupported
  const hybridTranscriptAvailable = browserTranscriptAvailable && openAITranscriptAvailable
  const transcriptProviderOptions: Array<{ id: TranscriptProviderMode; label: string; available: boolean }> = [
    { id: 'browser', label: 'Browser', available: browserTranscriptAvailable },
    { id: 'openai', label: 'OpenAI', available: openAITranscriptAvailable },
    { id: 'hybrid', label: 'Hybrid', available: hybridTranscriptAvailable },
  ]
  const transcriptSupported = transcriptProviderMode === 'browser'
    ? browserTranscriptAvailable
    : transcriptProviderMode === 'openai'
      ? openAITranscriptAvailable
      : hybridTranscriptAvailable
  const transcriptProviderLabel = transcriptProviderMode === 'hybrid'
    ? 'Hybrid'
    : transcriptProviderMode === 'openai'
      ? 'OpenAI'
      : 'Browser'
  const transcriptProviderDetail = transcriptProviderMode === 'browser'
    ? browserTranscriptAvailable
      ? 'Local browser speech recognition'
      : 'Browser transcription is not available in this browser.'
    : transcriptProviderMode === 'openai'
      ? openAITranscriptAvailable
        ? `OpenAI ${openAITranscribeModel || 'transcription'} live chunk transcription${openAIExtractionModel ? ` with ${openAIExtractionModel} scripture extraction` : ''}${openAIBrowserAssistActive ? ' with temporary browser speech assist' : ''}.${openAITranscriptError ? ` ${openAITranscriptError}` : ''}`
        : 'OpenAI transcription needs a configured API key and browser audio capture support.'
      : hybridTranscriptAvailable
        ? `Instant browser speech with OpenAI ${openAITranscribeModel || 'transcription'} refining audio chunks in the background.${openAITranscriptError ? ` OpenAI issue: ${openAITranscriptError}` : ''}`
        : 'Hybrid mode needs both browser speech recognition and OpenAI transcription to be available.'
  const displayedTranscriptText = transcriptText.trim() || refinedTranscriptText.trim()
  const transcriptReady = Boolean(displayedTranscriptText.trim())
  const combinedTranscript = `${displayedTranscriptText}${transcriptInterimText ? `${displayedTranscriptText ? ' ' : ''}${transcriptInterimText}` : ''}`.trim()
  const visibleTranscriptError = transcriptError || (transcriptProviderMode !== 'browser' ? openAITranscriptError : '')
  const elapsedMins = timerState.activities.length === 0 ? 0 : Math.round(
    (timerState.activities.slice(0, timerState.currentIndex).reduce((sum, activity) => sum + activity.duration, 0) * 60
    + (currentSeconds - Math.max(0, displayRemaining))) / 60
  )
  const sessionRemainingMins = Math.max(0, totalMins - elapsedMins)
  const transcriptStatusLabel = !transcriptSupported
    ? 'Unavailable'
    : transcriptListening
      ? transcriptProviderMode === 'hybrid' ? 'Listening + refining' : openAIBrowserAssistActive ? 'Listening + assist' : 'Listening now'
      : transcriptProviderMode === 'hybrid' ? 'Ready for hybrid' : 'Ready'
  const transcriptStatusColor = !transcriptSupported
    ? '#f87171'
    : transcriptListening
      ? '#4ade80'
      : transcriptProviderMode === 'hybrid' ? '#60a5fa' : '#94a3b8'

  const liveSummary = useMemo(() => {
    if (presentState.mode === 'timer') return { label: 'Timer live', detail: `${current.name} · ${formatTime(displayRemaining)}` }
    if (presentState.mode === 'blank') return { label: 'Blank screen', detail: 'Output intentionally hidden from the big screen.' }
    if (presentState.mode === 'bible' && presentState.activeVerse) {
      return {
        label: presentState.bibleDisplayMode === 'double' && activeSecondaryVerse ? 'Double Bible live' : 'Bible live',
        detail: presentState.bibleDisplayMode === 'double' && activeSecondaryVerse
          ? `${presentState.activeVerse.reference} + ${activeSecondaryVerse.translation}`
          : presentState.activeVerse.reference,
      }
    }
    if (presentState.mode === 'song') {
      return { label: 'Song live', detail: activeSong ? `${activeSong.title} · line ${presentState.activeLineIndex + 1}` : 'Selected song is live.' }
    }
    if (presentState.mode === 'caption' && activeCaption) {
      return { label: 'Caption live', detail: activeCaption.kind === 'quote' ? 'Live quote on screen' : 'Key point on screen' }
    }
    if (presentState.mode === 'image') {
      return { label: 'Image live', detail: activeImage?.name ?? 'Selected image is live.' }
    }
    if (presentState.mode === 'video') {
      return { label: 'Video live', detail: activeVideo?.name ?? 'Selected video is live.' }
    }
    if (presentState.mode === 'presentation') {
      return { label: 'Presentation live', detail: activePresentation?.name ?? 'Selected presentation is live.' }
    }
    if (presentState.mode === 'notice') {
      return { label: 'Notice live', detail: activeNotice?.title ?? 'Selected notice is live.' }
    }
    return { label: 'Ready', detail: 'Choose something to display on the big screen.' }
  }, [activeCaption, activeImage, activeNotice, activePresentation, activeSecondaryVerse, activeSong, activeVideo, current.name, displayRemaining, presentState])

  const liveOutputPreview = useMemo(() => {
    if (presentState.mode === 'timer') {
      return {
        modeLabel: 'Timer',
        title: current.name,
        subtitle: `${formatTime(displayRemaining)} remaining`,
        body: `Activity ${timerState.currentIndex + 1} of ${timerState.activities.length} is currently live on the big screen.${currentAdditionalMinutes > 0 ? ` ${currentAdditionalMinutes} extra minute${currentAdditionalMinutes === 1 ? '' : 's'} already added.` : ''}`,
        footer: nextActivity ? `Up next: ${nextActivity.name}` : 'This is the final programme item.',
        accent: theme.text,
        tone: theme.glow,
        visual: formatTime(displayRemaining),
      }
    }
    if (presentState.mode === 'blank') {
      return {
        modeLabel: 'Blank',
        title: 'Blank screen is live',
        subtitle: 'The audience currently sees no content.',
        body: 'Use this when you want to pause output between moments or transitions.',
        footer: 'Show Timer or display new content when you are ready.',
        accent: '#94a3b8',
        tone: 'rgba(148,163,184,0.12)',
        visual: 'OFF',
      }
    }
    if (presentState.mode === 'bible' && presentState.activeVerse) {
      return {
        modeLabel: 'Bible',
        title: presentState.activeVerse.reference,
        subtitle: presentState.bibleDisplayMode === 'double' && activeSecondaryVerse
          ? `${presentState.activeVerse.translation} + ${activeSecondaryVerse.translation} scripture is live`
          : `${presentState.activeVerse.translation} scripture is live`,
        body: presentState.bibleDisplayMode === 'double' && activeSecondaryVerse
          ? `${presentState.activeVerse.text}\n\n${activeSecondaryVerse.text}`
          : presentState.activeVerse.text,
        footer: presentState.bibleDisplayMode === 'double' && activeSecondaryVerse
          ? 'The congregation is currently reading two translations of this verse.'
          : 'The congregation is currently reading this verse.',
        accent: '#7dd3fc',
        tone: 'rgba(56,189,248,0.12)',
        visual: 'Jn',
      }
    }
    if (presentState.mode === 'song' && activeSong) {
      return {
        modeLabel: 'Song',
        title: activeSong.title,
        subtitle: activeSong.artist ? `${activeSong.artist} · line ${presentState.activeLineIndex + 1}` : `Line ${presentState.activeLineIndex + 1} of ${activeSong.lines.length}`,
        body: activeSongLine?.text ?? 'The selected song is currently live on the big screen.',
        footer: activeSongLine ? 'This lyric line is what the audience currently sees.' : 'Song is currently live.',
        accent: '#4ade80',
        tone: 'rgba(74,222,128,0.12)',
        visual: '♪',
      }
    }
    if (presentState.mode === 'caption' && activeCaption) {
      return {
        modeLabel: 'Caption',
        title: activeCaption.kind === 'quote' ? 'Live sermon quote' : 'Live key point',
        subtitle: activeCaption.kind === 'quote' ? 'Quote card is currently live' : 'Key point card is currently live',
        body: activeCaption.text,
        footer: 'The congregation is currently seeing this caption from the transcript.',
        accent: activeCaption.kind === 'quote' ? '#fbbf24' : '#22c55e',
        tone: activeCaption.kind === 'quote' ? 'rgba(251,191,36,0.12)' : 'rgba(34,197,94,0.12)',
        visual: activeCaption.kind === 'quote' ? 'Q' : 'KP',
      }
    }
    if (presentState.mode === 'image' && activeImage) {
      return {
        modeLabel: 'Image',
        title: activeImage.name,
        subtitle: 'Still image is live on the big screen',
        body: 'The audience currently sees this image. Check the preview tile to confirm the artwork.',
        footer: 'Use another display action when you want to replace it.',
        accent: '#38bdf8',
        tone: 'rgba(56,189,248,0.12)',
        thumbnailUrl: activeImage.url,
        visual: 'IMG',
      }
    }
    if (presentState.mode === 'video' && activeVideo) {
      return {
        modeLabel: 'Video',
        title: activeVideo.name,
        subtitle: 'Video playback is currently live',
        body: `Format: ${activeVideo.type || 'video'}. The audience is currently watching this clip.`,
        footer: 'Keep this in view while the clip plays.',
        accent: '#f97316',
        tone: 'rgba(249,115,22,0.12)',
        videoUrl: activeVideo.url,
        visual: '▶',
      }
    }
    if (presentState.mode === 'presentation' && activePresentation) {
      return {
        modeLabel: 'Presentation',
        title: activePresentation.name,
        subtitle: activePresentation.type === 'google-slides' ? 'Google Slides deck is live' : 'Presentation is currently live',
        body: activePresentation.pageCount ? `${activePresentation.pageCount} page presentation is on screen.` : 'The audience is currently viewing this presentation.',
        footer: 'Advance or replace it from the Media tab when needed.',
        accent: '#a78bfa',
        tone: 'rgba(167,139,250,0.12)',
        visual: 'PDF',
      }
    }
    if (presentState.mode === 'notice' && activeNotice) {
      return {
        modeLabel: 'Notice',
        title: activeNotice.title,
        subtitle: `${activeNotice.style.charAt(0).toUpperCase()}${activeNotice.style.slice(1)} notice is live`,
        body: activeNotice.body || 'This notice is currently on the big screen.',
        footer: 'The congregation is currently seeing this announcement.',
        accent: activeNotice.style === 'urgent' ? '#fb7185' : activeNotice.style === 'celebration' ? '#fbbf24' : '#60a5fa',
        tone: activeNotice.style === 'urgent' ? 'rgba(251,113,133,0.12)' : activeNotice.style === 'celebration' ? 'rgba(251,191,36,0.12)' : 'rgba(96,165,250,0.12)',
        visual: '📢',
      }
    }
    return {
      modeLabel: 'Ready',
      title: 'Nothing live yet',
      subtitle: 'Choose content to send to the big screen.',
      body: 'As soon as you present a timer, scripture, song, media item, or notice, it will appear here for the operator to verify.',
      footer: 'This area is your confidence check before and during live moments.',
      accent: '#94a3b8',
      tone: 'rgba(148,163,184,0.12)',
      visual: 'LIVE',
    }
  }, [activeCaption, activeImage, activeNotice, activePresentation, activeSecondaryVerse, activeSong, activeSongLine, activeVideo, current.name, currentAdditionalMinutes, displayRemaining, nextActivity, presentState, theme.glow, theme.text, timerState.activities.length, timerState.currentIndex])

  const systemHealthy = systemHealth.overall === 'healthy'
  const systemStatusLabel = systemHealth.overall === 'checking' ? 'Checking system' : systemHealthy ? 'System healthy' : 'Needs attention'
  const systemStatusColor = systemHealth.overall === 'checking' ? '#fbbf24' : systemHealthy ? '#4ade80' : '#fb7185'
  const lastCheckedLabel = systemHealth.checkedAt
    ? new Date(systemHealth.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Pending'
  const lastActionLabel = lastAction
    ? `${lastAction.label} · ${new Date(lastAction.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'No live action yet'
  const healthServiceBadges: { id: keyof SystemHealth['services']; label: string; status: HealthServiceState }[] = [
    { id: 'auth', label: 'Auth', status: systemHealth.services.auth },
    { id: 'clock', label: 'Clock', status: systemHealth.services.clock },
    { id: 'timer', label: 'Timer', status: systemHealth.services.timer },
    { id: 'present', label: 'Screen', status: systemHealth.services.present },
  ]
  const liveStripMetrics = [
    { id: 'now', label: 'Now Timing', value: current.name, meta: `${formatTime(displayRemaining)} remaining` },
    { id: 'next', label: 'Up Next', value: nextActivity?.name ?? 'Final item', meta: nextActivity ? `${nextActivity.duration} min allocation` : 'No further programme item queued' },
    { id: 'last-action', label: 'Last Action', value: lastAction ? 'Updated' : 'Waiting', meta: lastActionLabel },
  ]

  const handleOpenBigScreen = () => {
    window.open('/screen', '_blank', `width=${window.screen.width},height=${window.screen.height},left=0,top=0`)
  }

  const handleOperatorNotesChange = (value: string) => {
    setOperatorNotes(value)
    if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current)
    notesSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem('elim_op_notes', value)
      } catch {}
    }, 400)
  }

  const handleOperatorNotesBlur = () => {
    if (operatorNotes.trim()) void saveOperatorNoteToServer(operatorNotes.trim())
  }

  const handleAppendQuickCue = (note: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const value = operatorNotes ? `${operatorNotes}\n[${timestamp}] ${note}` : `[${timestamp}] ${note}`
    setOperatorNotes(value)
    try {
      localStorage.setItem('elim_op_notes', value)
    } catch {}
  }

  const handleClearOperatorNotes = () => {
    setOperatorNotes('')
    try {
      localStorage.removeItem('elim_op_notes')
    } catch {}
  }

  const handleActivityDragStart = (activityId: number) => {
    setDraggedActivityId(activityId)
    setDragOverActivityId(activityId)
    if (editingDurationId != null) setEditingDurationId(null)
    if (editingNameId != null) cancelRenameActivity()
  }

  const handleActivityDragEnd = () => {
    setDraggedActivityId(null)
    setDragOverActivityId(null)
  }

  const handleActivityDrop = (activityId: number) => {
    if (draggedActivityId != null) reorderActivities(draggedActivityId, activityId)
    handleActivityDragEnd()
  }

  const handleBeginDurationEdit = (activityId: number) => {
    if (editingNameId != null) cancelRenameActivity()
    setEditingDurationId(activityId)
  }

  const handleAlertPositionChange = (value: 'top' | 'bottom') => {
    updatePresent(prev => ({ ...prev, alertPosition: value }))
  }

  const handleAlertRepeatsChange = (value: number) => {
    updatePresent(prev => ({ ...prev, alertRepeats: Math.max(1, value || 1) }))
  }

  const handleToggleAlert = () => {
    updatePresent(prev => ({ ...prev, alertActive: !prev.alertActive }))
  }

  const handleReportPeriodChange = (value: ReportPeriod) => {
    setReportPeriod(value)
  }

  const handleReportYearChange = (value: number) => {
    setReportYear(value || new Date().getFullYear())
  }

  const handleReportMonthChange = (value: number) => {
    setReportMonth(Math.min(12, Math.max(1, value || 1)))
  }

  const handleReportWeekStartChange = (value: string) => {
    setReportWeekStart(value || reportWeekStart)
  }

  const downloadReportPdf = () => {
    window.open(buildReportUrl('pdf'), '_blank', 'noopener,noreferrer')
  }

  const handleQuickRefChange = (value: string) => {
    setQuickRef(value)
    setQuickRefError('')
  }

  const handleKeywordSearchChange = (value: string) => {
    setKeywordSearch(value)
    setKeywordSearchError('')
    if (!value.trim()) {
      setKeywordResults([])
      setKeywordSearchProgress('')
    }
  }

  const handleTranslationSearchChange = (value: string) => {
    setTranslationSearch(value)
    setShowTranslationList(true)
  }

  const handleSecondaryTranslationSearchChange = (value: string) => {
    setSecondaryTranslationSearch(value)
    setShowSecondaryTranslationList(true)
  }

  const handleBookSearchChange = (value: string) => {
    setBookSearch(value)
    setShowBookList(true)
  }

  const handleSelectBook = (bookName: string, bookId: string) => {
    setSelectedBook(bookName)
    setSelectedBookId(bookId)
    setSelectedChapter(1)
    setChapterInput('1')
    setBookSearch('')
    setShowBookList(false)
  }

  const handleCommitChapterInput = () => {
    const nextChapter = parseInt(chapterInput, 10) || 1
    jumpToChapter(nextChapter)
  }

  const handleGoogleSlidesUrlChange = (value: string) => {
    setGoogleSlidesUrl(value)
    setGoogleSlidesError('')
  }

  const handleDeleteCaptionDraft = () => {
    if (!captionDraft) return
    dismissCaptionSuggestion(captionDraft.id)
    showToastMessage({
      title: 'Caption deleted',
      detail: 'The selected caption cue was removed from the queue.',
      tone: 'info',
    })
  }

  const handleSaveCaptionDraft = () => {
    const updatedCaption = persistCaptionDraftToQueue()
    if (!updatedCaption) return
    showToastMessage({
      title: 'Draft saved',
      detail: 'Your edited caption is saved in the queue and ready to send live.',
      tone: 'success',
    })
  }

  const handleClearCaptionCues = () => {
    setCaptionSuggestions([])
    setCaptionDraft(null)
    setCaptionDraftText('')
  }

  return {
    activeTab,
    toast,
    showShortcutHelp,
    shortcuts: SHORTCUTS,
    closeShortcutHelp: () => setShowShortcutHelp(false),
    dismissToast,
    handleToastUndo,
    headerProps: {
      churchName: CHURCH_NAME,
      systemStatusColor,
      systemStatusLabel,
      onBlankScreen: goBlank,
      onShowTimer: goTimerMode,
      onOpenBigScreen: handleOpenBigScreen,
      onLogout: () => {
        void logoutControl()
      },
    },
    tabBarProps: {
      tabs: TAB_OPTIONS,
      activeTab,
      presentMode: presentState.mode,
      onSelectTab: (tabId: string) => setActiveTab(tabId as Tab),
    },
    liveStripProps: {
      liveSummary,
      liveOutputPreview,
      metrics: liveStripMetrics,
      systemStatusLabel,
      systemStatusColor,
      lastCheckedLabel,
      healthServiceBadges,
      onViewShortcuts: () => setShowShortcutHelp(true),
    },
    timerTabProps: {
      theme,
      current,
      displayRemaining,
      progressPercent: pct,
      running: timerState.running,
      currentIndex: timerState.currentIndex,
      activities: timerState.activities,
      totalMinutes: totalMins,
      elapsedMinutes: elapsedMins,
      remainingMinutes: sessionRemainingMins,
      currentAdditionalMinutes,
      autoNextBufferSeconds: AUTO_NEXT_BUFFER_SECONDS,
      additionalTimeOptions: ADDITIONAL_TIME_OPTIONS,
      additionalTimeMinutes,
      durationOptions: DURATION_OPTIONS,
      newActivityName: newActName,
      newActivityDuration: newActDur,
      editingNameId,
      editingNameValue,
      editingDurationId,
      draggedActivityId,
      dragOverActivityId,
      onPrevious: goPrev,
      onToggleRunning: startPause,
      onNext: goNext,
      onResetCurrent: resetCurrent,
      onResetAll: resetAll,
      onAddAdditionalTime: addAdditionalTime,
      onAdditionalTimeMinutesChange: setAdditionalTimeMinutes,
      onNewActivityNameChange: setNewActName,
      onNewActivityDurationChange: setNewActDur,
      onAddActivity: addActivity,
      onSelectActivity: selectActivity,
      onActivityDragOver: setDragOverActivityId,
      onActivityDrop: handleActivityDrop,
      onActivityDragStart: handleActivityDragStart,
      onActivityDragEnd: handleActivityDragEnd,
      onEditingNameValueChange: setEditingNameValue,
      onBeginRenameActivity: beginRenameActivity,
      onCommitRenameActivity: commitRenameActivity,
      onCancelRenameActivity: cancelRenameActivity,
      onBeginDurationEdit: handleBeginDurationEdit,
      onUpdateDuration: updateDuration,
      onRemoveActivity: removeActivity,
      operatorNotes,
      onOperatorNotesChange: handleOperatorNotesChange,
      onOperatorNotesBlur: handleOperatorNotesBlur,
      onAppendQuickCue: handleAppendQuickCue,
      onClearOperatorNotes: handleClearOperatorNotes,
      alertMinistersInput,
      onAlertMinistersInputChange: setAlertMinistersInput,
      alertPosition: presentState.alertPosition,
      onAlertPositionChange: handleAlertPositionChange,
      alertRepeats: presentState.alertRepeats,
      onAlertRepeatsChange: handleAlertRepeatsChange,
      alertActive: presentState.alertActive,
      onApplyAlert: applyAlertConfig,
      onToggleAlert: handleToggleAlert,
      reportPeriod,
      onReportPeriodChange: handleReportPeriodChange,
      reportYear,
      onReportYearChange: handleReportYearChange,
      reportMonth,
      onReportMonthChange: handleReportMonthChange,
      reportWeekStart,
      onReportWeekStartChange: handleReportWeekStartChange,
      onFetchReport: () => {
        void fetchTimerReport()
      },
      onDownloadReportPdf: downloadReportPdf,
      reportLabel,
      reportLoading,
      reportError,
      reportSummary,
      reportRows,
      reportSessions,
    },
    bibleTabProps: {
      activeVerse: presentState.activeVerse,
      activeSecondaryVerse,
      bibleDisplayMode: presentState.bibleDisplayMode,
      bibleBackgrounds: presentState.bibleBackgrounds,
      activeBibleBackgroundId: presentState.activeBibleBackgroundId,
      bibleTextColor: presentState.bibleTextColor,
      bibleTextColorOptions: BIBLE_TEXT_COLOR_OPTIONS,
      bibleFontFamilyId: presentState.bibleFontFamilyId,
      bibleFontOptions: BIBLE_FONT_OPTIONS,
      bibleFontScale: presentState.bibleFontScale,
      transcriptListening,
      transcriptReady,
      transcriptSupported,
      transcriptStatusLabel,
      transcriptStatusColor,
      transcriptProviderMode,
      transcriptProviderOptions,
      transcriptProviderLabel,
      transcriptProviderDetail,
      autoDisplayScriptures,
      transcriptError: visibleTranscriptError,
      transcriptText: displayedTranscriptText,
      transcriptInterimText,
      combinedTranscript,
      captionSuggestionCount: captionSuggestions.length,
      scriptureSuggestions,
      onToggleListening: transcriptListening ? stopTranscriptListener : startTranscriptListener,
      onTranscriptProviderModeChange: handleTranscriptProviderModeChange,
      onDownloadTranscript: downloadTranscript,
      onClearTranscriptAssist: clearTranscriptAssist,
      onToggleAutoDisplay: setAutoDisplayScriptures,
      onOpenCaptions: () => setActiveTab('captions'),
      onOpenSuggestion: (suggestion: ScriptureSuggestion) => {
        void revealSuggestedScripture(suggestion, { display: false, switchTab: true })
      },
      onDisplaySuggestion: (suggestion: ScriptureSuggestion) => {
        void revealSuggestedScripture(suggestion, { display: true, switchTab: true })
      },
      onDismissSuggestion: dismissScriptureSuggestion,
      quickRef,
      onQuickRefChange: handleQuickRefChange,
      quickRefSuggestion,
      onAcceptQuickRefSuggestion: acceptQuickRefSuggestion,
      onSubmitQuickRef: handleQuickRef,
      quickRefError,
      keywordSearchInputRef,
      keywordSearch,
      onKeywordSearchChange: handleKeywordSearchChange,
      onRunKeywordSearch: () => {
        void runKeywordSearch()
      },
      keywordSearching,
      keywordSearchProgress,
      keywordSearchError,
      keywordResults,
      highlightTerms,
      onOpenKeywordHit: openKeywordHit,
      translations,
      filteredTranslations,
      selectedTranslation,
      translationSearch,
      onTranslationSearchChange: handleTranslationSearchChange,
      showTranslationList,
      onShowTranslationList: () => setShowTranslationList(true),
      onHideTranslationList: () => setShowTranslationList(false),
      onLoadTranslations: loadTranslationsData,
      onSelectTranslation: (translationId: string) => {
        void handleTranslationSelect(translationId)
      },
      selectedSecondaryTranslation,
      secondaryTranslationSearch,
      filteredSecondaryTranslations,
      showSecondaryTranslationList,
      onSecondaryTranslationSearchChange: handleSecondaryTranslationSearchChange,
      onShowSecondaryTranslationList: () => setShowSecondaryTranslationList(true),
      onHideSecondaryTranslationList: () => setShowSecondaryTranslationList(false),
      onSelectSecondaryTranslation: (translationId: string) => {
        void handleSecondaryTranslationSelect(translationId)
      },
      onBibleDisplayModeChange: (displayMode: 'single' | 'double') => {
        void handleBibleDisplayModeChange(displayMode)
      },
      onBibleBackgroundUpload: handleBibleBackgroundUpload,
      onSelectBibleBackground: handleSelectBibleBackground,
      onDeleteBibleBackground: handleDeleteBibleBackground,
      onBibleTextColorChange: handleBibleTextColorChange,
      onBibleFontFamilyChange: handleBibleFontFamilyChange,
      onBibleFontScaleChange: handleBibleFontScaleChange,
      selectedBook,
      selectedBookId,
      bookSearch,
      onBookSearchChange: handleBookSearchChange,
      showBookList,
      onShowBookList: () => setShowBookList(true),
      onHideBookList: () => setShowBookList(false),
      filteredBooks,
      onSelectBook: handleSelectBook,
      selectedChapter,
      chapterInput,
      onChapterInputChange: setChapterInput,
      maxChapterCount,
      onCommitChapterInput: handleCommitChapterInput,
      onJumpToChapter: jumpToChapter,
      canGoPrevChapter,
      canGoNextChapter,
      chapterViewVerses,
      bibleLoading,
      activeVerseIndex,
      canGoPrevVerse,
      canGoNextVerse,
      onJumpToVerse: jumpToVerse,
      onDisplayVerse: (verse: BibleVerse) => {
        void displayVerseOnScreen(verse)
      },
    },
    captionsTabProps: {
      isCaptionLive: presentState.mode === 'caption',
      activeCaption,
      onShowTimer: goTimerMode,
      transcriptListening,
      transcriptReady,
      transcriptStatusLabel,
      transcriptStatusColor,
      transcriptProviderMode,
      transcriptProviderOptions,
      transcriptProviderLabel,
      captionsEnabled,
      onCaptionsEnabledChange: setCaptionsEnabled,
      transcriptError: visibleTranscriptError,
      combinedTranscript,
      transcriptText: displayedTranscriptText,
      transcriptInterimText,
      captionSuggestions,
      captionDraft,
      captionDraftText,
      onCaptionDraftTextChange: setCaptionDraftText,
      onToggleListening: transcriptListening ? stopTranscriptListener : startTranscriptListener,
      onTranscriptProviderModeChange: handleTranscriptProviderModeChange,
      onRefreshSuggestions: () => refreshCaptionSuggestionsFromTranscript(transcriptTextRef.current),
      onDownloadTranscript: downloadTranscript,
      onDeleteDraft: handleDeleteCaptionDraft,
      onSaveDraft: handleSaveCaptionDraft,
      onSendEditedLive: sendEditedCaptionLive,
      onBeginCaptionEditing: beginCaptionEditing,
      onDismissCaptionSuggestion: dismissCaptionSuggestion,
      onClearCaptionCues: handleClearCaptionCues,
    },
    songsTabProps: {
      presentState,
      activeSong,
      showSongEditor,
      editingSongId,
      newSongTitle,
      newSongArtist,
      newSongLyrics,
      newSongInterpretation,
      onToggleSongEditor: toggleSongEditor,
      onSongTitleChange: setNewSongTitle,
      onSongArtistChange: setNewSongArtist,
      onSongLyricsChange: setNewSongLyrics,
      onSongInterpretationChange: setNewSongInterpretation,
      onSaveSong: saveSong,
      onBeginSongEditing: beginSongEditing,
      onPresentSong: presentSong,
      onDeleteSong: (songId: number) => updatePresent(prev => deleteSong(prev, songId)),
      onSongLine: songLine,
      onGoToSongLine: goToSongLine,
    },
    imagesTabProps: {
      presentState,
      onImageUpload: handleImageUpload,
      onPresentImage: presentImageOnScreen,
      onDeleteImage: (imageId: number) => updatePresent(prev => deleteImage(prev, imageId)),
    },
    mediaTabProps: {
      presentState,
      videoAccept: VIDEO_ACCEPT,
      presentationAccept: PRESENTATION_ACCEPT,
      mediaUploadProgress,
      googleSlidesUrl,
      googleSlidesError,
      onGoogleSlidesUrlChange: handleGoogleSlidesUrlChange,
      onAddGoogleSlides: addGoogleSlides,
      onVideoUpload: handleVideoUpload,
      onPresentationUpload: handlePresentationUpload,
      onPresentVideo: presentVideoOnScreen,
      onDeleteVideo: (videoId: number) => updatePresent(prev => deleteVideo(prev, videoId)),
      onPresentPresentation: presentDeckOnScreen,
      onDeletePresentation: (presentationId: number) => updatePresent(prev => deletePresentation(prev, presentationId)),
    },
    noticesTabProps: {
      presentState,
      showNoticeEditor,
      newNoticeTitle,
      newNoticeBody,
      newNoticeStyle,
      onToggleNoticeEditor: () => setShowNoticeEditor(value => !value),
      onNoticeTitleChange: setNewNoticeTitle,
      onNoticeBodyChange: setNewNoticeBody,
      onNoticeStyleChange: (value: Notice['style']) => setNewNoticeStyle(value),
      onSaveNotice: saveNotice,
      onPresentNotice: presentNoticeOnScreen,
      onDeleteNotice: (noticeId: number) => updatePresent(prev => deleteNotice(prev, noticeId)),
    },
  }
}
