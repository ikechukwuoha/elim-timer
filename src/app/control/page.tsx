'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { TimerState, Activity, TimerColor, PresentState, Song, SongLine, Notice } from '@/types'
import { loadState, saveAndBroadcast, getTimerColor, formatTime, generateId } from '@/utils/timerStore'
import {
  loadPresentState, savePresentState,
  displayVerse, selectSong, goToLine, displayImage, displayNotice,
  addSong, deleteSong, addImage, deleteImage, addNotice, deleteNotice, setMode,
} from '@/utils/presentStore'
import {
  fetchTranslations, fetchBooks, fetchChapter,
  PRESET_TRANSLATIONS, FALLBACK_TRANSLATIONS, BOOK_ID_MAP, STANDARD_BOOKS,
} from '@/utils/bibleApi'
import type { BibleTranslation, BibleBook } from '@/utils/bibleApi'

const CHURCH_NAME      = 'Elim Christian Garden International'
const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120]
type Tab = 'timer' | 'bible' | 'songs' | 'images' | 'notices'

type ColorTheme = { bg: string; text: string; border: string }
const COLOR_MAP: Record<TimerColor, ColorTheme> = {
  green:  { bg: '#052e16', text: '#22c55e', border: '#15803d' },
  yellow: { bg: '#292524', text: '#fbbf24', border: '#a16207' },
  red:    { bg: '#1c0a0a', text: '#f87171', border: '#b91c1c' },
}

export default function ControlPanel() {
  // ── Core state ────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState<Tab>('timer')
  const [timerState,   setTimerState]   = useState<TimerState | null>(null)
  const [presentState, setPresentState] = useState<PresentState | null>(null)
  const [editingId,    setEditingId]    = useState<number | null>(null)
  const [newActName,   setNewActName]   = useState('')
  const [newActDur,    setNewActDur]    = useState(15)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Bible state ───────────────────────────────────────────
  const [translations,        setTranslations]        = useState<BibleTranslation[]>(PRESET_TRANSLATIONS)
  const [selectedTranslation, setSelectedTranslation] = useState('KJV')
  const [translationSearch,   setTranslationSearch]   = useState('')
  const [showTranslationList, setShowTranslationList] = useState(false)
  const [books,               setBooks]               = useState<BibleBook[]>([])
  const [selectedBook,        setSelectedBook]        = useState('John')
  const [selectedBookId,      setSelectedBookId]      = useState('43')
  const [bookSearch,          setBookSearch]          = useState('')
  const [showBookList,        setShowBookList]        = useState(false)
  const [selectedChapter,     setSelectedChapter]     = useState(3)
  const [chapterInput,        setChapterInput]        = useState('3')
  const [chapterVerses,       setChapterVerses]       = useState<{ verse: number; text: string }[]>([])
  const [bibleLoading,        setBibleLoading]        = useState(false)
  const [verseSearch,         setVerseSearch]         = useState('')
  const [quickRef,            setQuickRef]            = useState('')
  const [quickRefError,       setQuickRefError]       = useState('')

  // ── Song editor state ─────────────────────────────────────
  const [showSongEditor,    setShowSongEditor]    = useState(false)
  const [newSongTitle,      setNewSongTitle]      = useState('')
  const [newSongArtist,     setNewSongArtist]     = useState('')
  const [newSongLyrics,     setNewSongLyrics]     = useState('')

  // ── Notice editor state ───────────────────────────────────
  const [showNoticeEditor,  setShowNoticeEditor]  = useState(false)
  const [newNoticeTitle,    setNewNoticeTitle]    = useState('')
  const [newNoticeBody,     setNewNoticeBody]     = useState('')
  const [newNoticeStyle,    setNewNoticeStyle]    = useState<Notice['style']>('default')

  // Hydrate
  useEffect(() => {
    setTimerState(loadState())
    setPresentState(loadPresentState())
    // Don't auto-load all translations — presets load instantly
    // User can click "Load all" to fetch the full list
  }, [])

  // Load books when translation changes
  useEffect(() => {
    if (!selectedTranslation) return
    fetchBooks(selectedTranslation).then(b => {
      setBooks(b)
      if (b.length > 0) {
        const john = b.find(bk => bk.name === 'John') ?? b[0]
        setSelectedBook(john.name)
        setSelectedBookId(String(john.bookid))
      }
    })
  }, [selectedTranslation])

  // Load chapter
  useEffect(() => {
    if (!selectedBookId || !selectedTranslation) return
    setBibleLoading(true)
    fetchChapter(selectedTranslation, selectedBookId, selectedChapter, selectedBook)
      .then(ch => {
        setChapterVerses(ch ? ch.verses : [])
        setBibleLoading(false)
      })
  }, [selectedTranslation, selectedBookId, selectedChapter, selectedBook])

  async function loadTranslationsData() {
    const data = await fetchTranslations()
    setTranslations(data)
  }

  // ── Timer updater ─────────────────────────────────────────
  const updateTimer = useCallback((updater: (prev: TimerState) => TimerState) => {
    setTimerState(prev => {
      if (!prev) return prev
      const next = updater(prev)
      saveAndBroadcast(next)
      return next
    })
  }, [])

  const updatePresent = useCallback((updater: (prev: PresentState) => PresentState) => {
    setPresentState(prev => {
      if (!prev) return prev
      const next = updater(prev)
      savePresentState(next)
      return next
    })
  }, [])

  // Timer tick
  useEffect(() => {
    if (!timerState) return
    if (timerState.running) {
      intervalRef.current = setInterval(() => {
        updateTimer(prev => {
          if (!prev.running) return prev
          const newRemaining = prev.remaining - 1
          return {
            ...prev,
            remaining:       newRemaining,
            overtime:        newRemaining < 0,
            overtimeSeconds: newRemaining < 0 ? Math.abs(newRemaining) : 0,
          }
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerState?.running, updateTimer])

  // ── Timer actions ─────────────────────────────────────────
  const startPause = () => updateTimer(p => ({ ...p, running: !p.running }))

  const goNext = () => updateTimer(p => {
    const next = p.currentIndex + 1
    if (next >= p.activities.length) return p
    return { ...p, currentIndex: next, remaining: p.activities[next].duration * 60,
      overtime: false, overtimeSeconds: 0, running: p.running }
  })

  const goPrev = () => updateTimer(p => {
    const idx = Math.max(0, p.currentIndex - 1)
    return { ...p, currentIndex: idx, remaining: p.activities[idx].duration * 60,
      overtime: false, overtimeSeconds: 0, running: false }
  })

  const resetCurrent = () => updateTimer(p => ({
    ...p, running: false,
    remaining: p.activities[p.currentIndex].duration * 60,
    overtime: false, overtimeSeconds: 0,
  }))

  const resetAll = () => updateTimer(p => ({
    ...p, currentIndex: 0, running: false,
    remaining: p.activities[0].duration * 60,
    overtime: false, overtimeSeconds: 0,
  }))

  const selectActivity = (i: number) => updateTimer(p => ({
    ...p, currentIndex: i,
    remaining: p.activities[i].duration * 60,
    overtime: false, overtimeSeconds: 0, running: false,
  }))

  const addActivity = () => {
    if (!newActName.trim()) return
    updateTimer(p => ({
      ...p, activities: [...p.activities,
        { id: generateId(), name: newActName.trim(), duration: newActDur }],
    }))
    setNewActName('')
    setNewActDur(15)
  }

  const removeActivity = (id: number) => updateTimer(p => {
    const filtered = p.activities.filter(a => a.id !== id)
    if (!filtered.length) return p
    const newIdx = Math.min(p.currentIndex, filtered.length - 1)
    return { ...p, activities: filtered, currentIndex: newIdx,
      remaining: filtered[newIdx].duration * 60, overtime: false, overtimeSeconds: 0, running: false }
  })

  const updateDuration = (id: number, duration: number) => {
    updateTimer(p => {
      const activities = p.activities.map((a): Activity => a.id === id ? { ...a, duration } : a)
      const isActive = p.activities[p.currentIndex].id === id
      return { ...p, activities, remaining: isActive ? duration * 60 : p.remaining }
    })
    setEditingId(null)
  }

  // ── Bible actions ─────────────────────────────────────────
  const displayVerseOnScreen = (verse: number, text: string) => {
    updatePresent(p => displayVerse(p, {
      book: selectedBook, chapter: selectedChapter, verse, text,
      translation: selectedTranslation,
      reference: `${selectedBook} ${selectedChapter}:${verse} (${selectedTranslation})`,
    }))
  }

  const filteredVerses = verseSearch.trim()
    ? chapterVerses.filter(v => v.text.toLowerCase().includes(verseSearch.toLowerCase()))
    : chapterVerses

  const filteredTranslations = translationSearch.trim()
    ? translations.filter(t =>
        (t.id || '').toLowerCase().includes(translationSearch.toLowerCase()) ||
        (t.name || '').toLowerCase().includes(translationSearch.toLowerCase()) ||
        (t.language || '').toLowerCase().includes(translationSearch.toLowerCase())
      )
    : translations

  const filteredBooks = bookSearch.trim()
    ? books.filter(b => b.name.toLowerCase().includes(bookSearch.toLowerCase()))
    : books

  // Parse quick reference like "John 3:16" or "Psalm 23" or "Rom 8:28"
  const handleQuickRef = async () => {
    const raw = quickRef.trim()
    if (!raw) return
    setQuickRefError('')

    // Match patterns: "Book Chapter:Verse" or "Book Chapter"
    const match = raw.match(/^(.+?)\s+(\d+)(?::(\d+))?$/)
    if (!match) {
      setQuickRefError('Format: Book Chapter:Verse  e.g. John 3:16')
      return
    }

    const bookQuery   = match[1].toLowerCase()
    const chapNum     = parseInt(match[2])
    const verseNum    = match[3] ? parseInt(match[3]) : null

    // Find matching book
    const bookList = books.length > 0 ? books : STANDARD_BOOKS
    const found = bookList.find(b =>
      b.name.toLowerCase().startsWith(bookQuery) ||
      b.name.toLowerCase().includes(bookQuery)
    )

    if (!found) {
      setQuickRefError(`Book not found: "${match[1]}"`)
      return
    }

    setSelectedBook(found.name)
    setSelectedBookId(String(found.bookid))
    setSelectedChapter(chapNum)
    setChapterInput(String(chapNum))
    setShowBookList(false)
    setShowTranslationList(false)

    if (verseNum) {
      // Load chapter then scroll/highlight that verse
      setBibleLoading(true)
      const { fetchChapter: fc } = await import('@/utils/bibleApi')
      const ch = await fc(selectedTranslation, String(found.bookid), chapNum, found.name)
      if (ch) {
        setChapterVerses(ch.verses)
        setBibleLoading(false)
        // Auto-display the verse
        const v = ch.verses.find(v => v.verse === verseNum)
        if (v) {
          updatePresent(p => displayVerse(p, {
            book: found.name, chapter: chapNum, verse: verseNum, text: v.text,
            translation: selectedTranslation,
            reference: `${found.name} ${chapNum}:${verseNum} (${selectedTranslation})`,
          }))
        } else {
          setQuickRefError(`Verse ${verseNum} not found in ${found.name} ${chapNum}`)
        }
      } else {
        setBibleLoading(false)
        setQuickRefError('Could not load chapter')
      }
    }
    setQuickRef('')
  }

  // ── Song actions ──────────────────────────────────────────
  const saveSong = () => {
    if (!newSongTitle.trim() || !newSongLyrics.trim()) return
    const lines: SongLine[] = newSongLyrics
      .split('\n')
      .filter(l => l.trim())
      .map((text, i) => ({ id: i + 1, text: text.trim() }))
    updatePresent(p => addSong(p, { title: newSongTitle.trim(), artist: newSongArtist.trim() || undefined, lines }))
    setNewSongTitle(''); setNewSongArtist(''); setNewSongLyrics(''); setShowSongEditor(false)
  }

  const presentSong = (songId: number) => {
    updatePresent(p => {
      const s = selectSong(p, songId)
      return goToLine(s, 0)
    })
  }

  const songLine = (delta: number) => {
    updatePresent(p => goToLine(p, p.activeLineIndex + delta))
  }

  // ── Image actions ─────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const url = ev.target?.result as string
        updatePresent(p => addImage(p, { name: file.name, url }))
      }
      reader.readAsDataURL(file)
    })
  }

  // ── Notice actions ────────────────────────────────────────
  const saveNotice = () => {
    if (!newNoticeTitle.trim()) return
    updatePresent(p => addNotice(p, { title: newNoticeTitle.trim(), body: newNoticeBody.trim(), style: newNoticeStyle }))
    setNewNoticeTitle(''); setNewNoticeBody(''); setNewNoticeStyle('default'); setShowNoticeEditor(false)
  }

  // ── Blank / switch modes ──────────────────────────────────
  const goBlank = () => updatePresent(p => setMode(p, 'blank'))
  const goTimerMode = () => updatePresent(p => setMode(p, 'timer'))

  if (!timerState || !presentState) return null

  const current   = timerState.activities[timerState.currentIndex]
  const color     = getTimerColor(timerState.remaining, current.duration * 60)
  const theme     = COLOR_MAP[color]
  const pct       = Math.max(0, Math.min(100, (timerState.remaining / (current.duration * 60)) * 100))
  const totalMins = timerState.activities.reduce((s, a) => s + a.duration, 0)
  const activeSong = presentState.songs.find(s => s.id === presentState.activeSongId)

  const TAB_DEF: { id: Tab; label: string }[] = [
    { id: 'timer',   label: '⏱ Timer'    },
    { id: 'bible',   label: '✝ Bible'    },
    { id: 'songs',   label: '♪ Songs'    },
    { id: 'images',  label: '🖼 Images'  },
    { id: 'notices', label: '📢 Notices' },
  ]

  return (
    <div style={s.page}>
      {/* ── HEADER ── */}
      <header style={s.header}>
        <div>
          <p style={s.churchName}>{CHURCH_NAME}</p>
          <p style={s.subtitle}>Presentation Control Panel</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={goBlank} style={{ ...s.headerBtn, borderColor:'#555', color:'#888' }}>
            ⬛ Blank
          </button>
          <button onClick={goTimerMode} style={{ ...s.headerBtn, borderColor:'#166534', color:'#22c55e' }}>
            ↩ Show Timer
          </button>
          <button onClick={() => window.open('/screen', '_blank', `width=${screen.width},height=${screen.height},left=0,top=0`)} style={s.bigScreenBtn}>
            📺 Open Big Screen Monitor
          </button>
        </div>
      </header>

      {/* ── TABS ── */}
      <div style={s.tabBar}>
        {TAB_DEF.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            ...s.tab,
            borderBottom: activeTab === t.id ? '2px solid #22c55e' : '2px solid transparent',
            color: activeTab === t.id ? '#22c55e' : '#888',
          }}>
            {t.label}
          </button>
        ))}
        {/* Current mode badge */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10, paddingRight:16 }}>
          <span style={{ fontSize:11, color:'#555', letterSpacing:'0.1em', textTransform:'uppercase' }}>On screen:</span>
          <span style={{
            fontSize:14, fontWeight:700,
            padding:'6px 18px', borderRadius:8,
            letterSpacing:'0.12em',
            background: presentState.mode === 'timer' ? '#14532d'
              : presentState.mode === 'blank' ? '#222' : '#1e3a5f',
            color: presentState.mode === 'timer' ? '#4ade80'
              : presentState.mode === 'blank' ? '#555' : '#93c5fd',
            border: '2px solid',
            borderColor: presentState.mode === 'timer' ? '#22c55e'
              : presentState.mode === 'blank' ? '#444' : '#3b82f6',
            boxShadow: presentState.mode !== 'blank'
              ? (presentState.mode === 'timer' ? '0 0 12px rgba(34,197,94,0.3)' : '0 0 12px rgba(59,130,246,0.3)')
              : 'none',
            textTransform:'uppercase',
          }}>
            {presentState.mode === 'timer' ? '● ' : presentState.mode === 'blank' ? '' : '▶ '}
            {presentState.mode.toUpperCase()}
          </span>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={s.content}>

        {/* ════════════ TIMER TAB ════════════ */}
        {activeTab === 'timer' && (
          <div style={s.twoCol}>
            <aside style={s.left}>
              {/* Timer card */}
              <div style={{ ...s.timerCard, background: theme.bg, borderColor: theme.border }}>
                <p style={s.activityLabel}>{current.name}</p>
                <p style={{ ...s.clockDisplay, color: theme.text }}>{formatTime(timerState.remaining)}</p>
                {timerState.overtime && <p style={{ color:'#f87171', fontSize:12, textAlign:'center', marginTop:4, letterSpacing:'0.15em' }}>OVERTIME</p>}
                <p style={s.clockMeta}>Activity {timerState.currentIndex + 1} of {timerState.activities.length} · {current.duration} min</p>
                <div style={s.progressTrack}>
                  <div style={{ ...s.progressFill, width:`${pct}%`, background:theme.text }} />
                </div>
                <div style={s.legend}>
                  <span style={{ color:'#22c55e' }}>● Plenty</span>
                  <span style={{ color:'#fbbf24' }}>● Almost</span>
                  <span style={{ color:'#f87171' }}>● Up</span>
                </div>
              </div>
              <div style={s.controlRow}>
                <button onClick={goPrev} style={s.ctrlBtn}>◀ Prev</button>
                <button onClick={startPause} style={{ ...s.ctrlBtn, ...s.primaryBtn, background: timerState.running ? '#991b1b' : '#166534', borderColor: timerState.running ? '#7f1d1d' : '#14532d' }}>
                  {timerState.running ? '⏸ Pause' : '▶ Start'}
                </button>
                <button onClick={goNext} style={s.ctrlBtn}>Next ▶</button>
              </div>
              <div style={s.controlRow}>
                <button onClick={resetCurrent} style={s.ctrlBtn}>↺ Reset</button>
                <button onClick={resetAll} style={{ ...s.ctrlBtn, color:'#f87171', borderColor:'#7f1d1d' }}>⬛ Reset All</button>
              </div>
              <div style={s.summaryCard}>
                {([['Total', `${totalMins} min`], ['Activities', String(timerState.activities.length)], ['Status', timerState.running ? '● LIVE' : '● Paused']] as [string,string][]).map(([l,v]) => (
                  <div key={l} style={s.summaryRow}>
                    <span style={{ color:'#888' }}>{l}</span>
                    <span style={{ color: l==='Status' ? (timerState.running ? '#22c55e' : '#888') : '#fff' }}>{v}</span>
                  </div>
                ))}
              </div>
            </aside>

            <main style={s.right}>
              <p style={s.sectionTitle}>Programme Activities</p>
              <div style={s.activityList}>
                {timerState.activities.map((activity, index) => {
                  const isActive = index === timerState.currentIndex
                  const isPast   = index < timerState.currentIndex
                  return (
                    <div key={activity.id} role="button" tabIndex={0}
                      onClick={() => selectActivity(index)}
                      onKeyDown={e => e.key==='Enter' && selectActivity(index)}
                      style={{ ...s.activityRow, background: isActive?'#1e3a2a':isPast?'#161616':'#1e1e1e', borderColor: isActive?'#166534':'#2a2a2a', opacity: isPast?.45:1 }}>
                      <span style={{ ...s.indexBadge, background: isActive?'#22c55e':'#2a2a2a', color: isActive?'#000':'#666' }}>
                        {isPast ? '✓' : index + 1}
                      </span>
                      <span style={{ flex:1, fontSize:14, fontWeight:500, color: isActive?'#fff':'#bbb' }}>{activity.name}</span>
                      {editingId === activity.id ? (
                        <select defaultValue={activity.duration} autoFocus
                          onBlur={e => updateDuration(activity.id, Number(e.target.value))}
                          onChange={e => updateDuration(activity.id, Number(e.target.value))}
                          onClick={e => e.stopPropagation()} style={s.durationSelect}>
                          {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}m</option>)}
                        </select>
                      ) : (
                        <span style={s.durationBadge} title="Click to edit" onClick={e => { e.stopPropagation(); setEditingId(activity.id) }}>
                          {activity.duration}m
                        </span>
                      )}
                      <button onClick={e => { e.stopPropagation(); removeActivity(activity.id) }} style={s.removeBtn}>✕</button>
                    </div>
                  )
                })}
              </div>
              <div style={s.addRow}>
                <input type="text" placeholder="New activity…" value={newActName}
                  onChange={e => setNewActName(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && addActivity()} style={s.addInput} />
                <select value={newActDur} onChange={e => setNewActDur(Number(e.target.value))} style={s.addSelect}>
                  {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
                <button onClick={addActivity} style={s.addBtn}>Add</button>
              </div>
            </main>
          </div>
        )}

        {/* ════════════ BIBLE TAB ════════════ */}
        {activeTab === 'bible' && (
          <div style={s.twoCol}>
            {/* Left: controls */}
            <aside style={{ ...s.left, gap:10 }}>

              {/* ── Quick Reference ── */}
              <p style={s.sectionTitle}>Quick Reference</p>
              <div style={{ display:'flex', gap:6 }}>
                <input
                  type="text"
                  placeholder="e.g. John 3:16 or Romans 8"
                  value={quickRef}
                  onChange={e => { setQuickRef(e.target.value); setQuickRefError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleQuickRef()}
                  style={{ ...s.addInput, flex:1 }}
                />
                <button onClick={handleQuickRef} style={{ ...s.addBtn, padding:'8px 14px', flexShrink:0 }}>Go</button>
              </div>
              {quickRefError && <p style={{ fontSize:11, color:'#f87171', marginTop:-4 }}>{quickRefError}</p>}

              {/* ── Translation search ── */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={s.sectionTitle}>Translation</p>
                {translations.length <= 16 && (
                  <button
                    onClick={() => loadTranslationsData()}
                    style={{ fontSize:10, color:'#60a5fa', background:'none', border:'none', cursor:'pointer', letterSpacing:'0.05em' }}
                  >
                    Load all ↓
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Search version… (KJV, NIV, Yoruba…)"
                value={translationSearch}
                onChange={e => { setTranslationSearch(e.target.value); setShowTranslationList(true) }}
                onFocus={() => setShowTranslationList(true)}
                onBlur={() => setTimeout(() => setShowTranslationList(false), 200)}
                style={{ ...s.addInput, width:'100%' }}
              />
              {/* Selected translation badge */}
              {!showTranslationList && (
                <div style={{ fontSize:12, color:'#60a5fa', background:'#1e3a5f', border:'1px solid #1e40af', borderRadius:6, padding:'4px 10px', display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontWeight:600 }}>{selectedTranslation}</span>
                  <span style={{ color:'#93c5fd' }}>{translations.find(t => t.id === selectedTranslation)?.name ?? ''}</span>
                </div>
              )}
              {/* Inline dropdown list */}
              {showTranslationList && (
                <div style={{
                  background:'#1a1a1a', border:'1px solid #333', borderRadius:8,
                  maxHeight:180, overflowY:'auto',
                }}>
                  {filteredTranslations.slice(0, 100).map((t, i) => (
                    <div key={`${t.id}-${i}`}
                      onMouseDown={() => {
                        setSelectedTranslation(t.id)
                        setTranslationSearch('')
                        setShowTranslationList(false)
                      }}
                      style={{
                        padding:'7px 12px', cursor:'pointer', fontSize:12,
                        background: t.id === selectedTranslation ? '#1e3a2a' : 'transparent',
                        color: t.id === selectedTranslation ? '#22c55e' : '#ccc',
                        borderBottom:'1px solid #1a1a1a',
                        display:'flex', gap:8, alignItems:'center',
                      }}
                    >
                      <span style={{ fontWeight:700, minWidth:48, color: t.id === selectedTranslation ? '#22c55e' : '#fff' }}>{t.id}</span>
                      <span style={{ flex:1, color:'#888', fontSize:11 }}>{t.name}</span>
                      <span style={{ fontSize:10, color:'#555' }}>{t.language}</span>
                    </div>
                  ))}
                  {filteredTranslations.length === 0 && (
                    <p style={{ padding:'12px', fontSize:12, color:'#555', textAlign:'center' }}>No results</p>
                  )}
                </div>
              )}

              {/* ── Book search ── */}
              <p style={s.sectionTitle}>Book</p>
              <input
                type="text"
                placeholder="Search book…"
                value={bookSearch}
                onChange={e => { setBookSearch(e.target.value); setShowBookList(true) }}
                onFocus={() => setShowBookList(true)}
                onBlur={() => setTimeout(() => setShowBookList(false), 200)}
                style={{ ...s.addInput, width:'100%' }}
              />
              {/* Selected book badge */}
              {!showBookList && (
                <div style={{ fontSize:13, color:'#22c55e', background:'#1e3a2a', border:'1px solid #166534', borderRadius:6, padding:'4px 10px' }}>
                  {selectedBook}
                </div>
              )}
              {/* Inline book list */}
              {showBookList && (
                <div style={{
                  background:'#1a1a1a', border:'1px solid #333', borderRadius:8,
                  maxHeight:180, overflowY:'auto',
                }}>
                  {(filteredBooks.length > 0 ? filteredBooks : Object.entries(BOOK_ID_MAP).filter(([n]) =>
                    !bookSearch || n.toLowerCase().includes(bookSearch.toLowerCase())
                  ).map(([name, numId]) => ({ bookid: parseInt(numId), name, chapters: 0 }))).map(b => (
                    <div key={b.bookid}
                      onMouseDown={() => {
                        setSelectedBook(b.name)
                        setSelectedBookId(String(b.bookid))
                        setSelectedChapter(1)
                        setChapterInput('1')
                        setBookSearch('')
                        setShowBookList(false)
                      }}
                      style={{
                        padding:'7px 12px', cursor:'pointer', fontSize:13,
                        background: String(b.bookid) === selectedBookId ? '#1e3a2a' : 'transparent',
                        color: String(b.bookid) === selectedBookId ? '#22c55e' : '#ccc',
                        borderBottom:'1px solid #1a1a1a',
                      }}
                    >
                      {b.name}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Chapter input ── */}
              <p style={s.sectionTitle}>Chapter</p>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <button onClick={() => {
                  const n = Math.max(1, selectedChapter - 1)
                  setSelectedChapter(n); setChapterInput(String(n))
                }} style={{ ...s.ctrlBtn, flex:'none', width:40, padding:'8px 0' }}>◀</button>
                <input
                  type="number" min="1"
                  value={chapterInput}
                  onChange={e => setChapterInput(e.target.value)}
                  onBlur={() => {
                    const n = Math.max(1, parseInt(chapterInput) || 1)
                    setSelectedChapter(n); setChapterInput(String(n))
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const n = Math.max(1, parseInt(chapterInput) || 1)
                      setSelectedChapter(n); setChapterInput(String(n))
                    }
                  }}
                  style={{ ...s.addInput, flex:1, textAlign:'center', fontSize:18, fontWeight:600 }}
                />
                <button onClick={() => {
                  const n = selectedChapter + 1
                  setSelectedChapter(n); setChapterInput(String(n))
                }} style={{ ...s.ctrlBtn, flex:'none', width:40, padding:'8px 0' }}>▶</button>
              </div>

              {/* ── Verse search ── */}
              <p style={s.sectionTitle}>Search in chapter</p>
              <input type="text" placeholder="Filter verses by keyword…" value={verseSearch}
                onChange={e => setVerseSearch(e.target.value)} style={{ ...s.addInput, width:'100%' }} />

              {/* ── Active verse on screen ── */}
              {presentState.activeVerse && (
                <div style={{ background:'#1e3a5f', border:'1px solid #1e40af', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:10, color:'#60a5fa', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>On Screen</p>
                  <p style={{ fontSize:13, color:'#fff', lineHeight:1.5 }}>{presentState.activeVerse.text}</p>
                  <p style={{ fontSize:11, color:'#60a5fa', marginTop:6 }}>{presentState.activeVerse.reference}</p>
                </div>
              )}
            </aside>

            {/* Right: verse list */}
            <main style={s.right}>
              <p style={s.sectionTitle}>
                {selectedBook} {selectedChapter} — {filteredVerses.length} verse{filteredVerses.length !== 1 ? 's' : ''}
                {bibleLoading && <span style={{ color:'#555', marginLeft:8 }}>Loading…</span>}
              </p>
              <div style={{ ...s.activityList, gap:4 }}>
                {filteredVerses.map(v => {
                  const isActive = presentState.activeVerse?.verse === v.verse &&
                    presentState.activeVerse?.book === selectedBook &&
                    presentState.activeVerse?.chapter === selectedChapter
                  return (
                    <div key={v.verse} style={{
                      ...s.activityRow,
                      background:  isActive ? '#1e3a5f' : '#1e1e1e',
                      borderColor: isActive ? '#1e40af' : '#2a2a2a',
                      cursor: 'default',
                      alignItems: 'flex-start',
                    }}>
                      <span style={{ ...s.indexBadge, background: isActive?'#3b82f6':'#2a2a2a', color: isActive?'#fff':'#666', flexShrink:0, marginTop:2 }}>
                        {v.verse}
                      </span>
                      <span style={{ flex:1, fontSize:13, color: isActive?'#fff':'#ccc', lineHeight:1.6 }}>{v.text}</span>
                      <button
                        onClick={() => displayVerseOnScreen(v.verse, v.text)}
                        style={{ ...s.addBtn, padding:'6px 14px', fontSize:12, flexShrink:0, marginLeft:8 }}>
                        Display
                      </button>
                    </div>
                  )
                })}
                {!bibleLoading && filteredVerses.length === 0 && (
                  <p style={{ color:'#555', textAlign:'center', padding:40 }}>No verses found</p>
                )}
              </div>
            </main>
          </div>
        )}

        {/* ════════════ SONGS TAB ════════════ */}
        {activeTab === 'songs' && (
          <div style={s.twoCol}>
            {/* Left: song list */}
            <aside style={{ ...s.left, gap:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={s.sectionTitle}>Song Library</p>
                <button onClick={() => setShowSongEditor(v => !v)} style={{ ...s.addBtn, padding:'6px 14px', fontSize:12 }}>
                  {showSongEditor ? 'Cancel' : '+ New Song'}
                </button>
              </div>

              {/* Song editor */}
              {showSongEditor && (
                <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:10, padding:14, display:'flex', flexDirection:'column', gap:8 }}>
                  <input type="text" placeholder="Song title *" value={newSongTitle} onChange={e=>setNewSongTitle(e.target.value)} style={s.addInput} />
                  <input type="text" placeholder="Artist (optional)" value={newSongArtist} onChange={e=>setNewSongArtist(e.target.value)} style={s.addInput} />
                  <textarea placeholder="Paste lyrics here — one line per row…" value={newSongLyrics} onChange={e=>setNewSongLyrics(e.target.value)}
                    style={{ ...s.addInput, height:140, resize:'vertical' }} />
                  <button onClick={saveSong} style={s.addBtn}>Save Song</button>
                </div>
              )}

              {/* Song list */}
              <div style={s.activityList}>
                {presentState.songs.map(song => {
                  const isActive = song.id === presentState.activeSongId && presentState.mode === 'song'
                  return (
                    <div key={song.id} style={{
                      ...s.activityRow,
                      background:  isActive ? '#1e3a2a' : '#1e1e1e',
                      borderColor: isActive ? '#166534' : '#2a2a2a',
                      flexDirection: 'column',
                      alignItems:    'flex-start',
                      gap: 4,
                      cursor: 'default',
                    }}>
                      <div style={{ display:'flex', width:'100%', alignItems:'center', gap:8 }}>
                        <span style={{ flex:1, fontSize:14, fontWeight:600, color: isActive?'#22c55e':'#fff' }}>{song.title}</span>
                        <button onClick={() => presentSong(song.id)} style={{ ...s.addBtn, padding:'5px 12px', fontSize:12 }}>Present</button>
                        <button onClick={() => updatePresent(p => deleteSong(p, song.id))} style={s.removeBtn}>✕</button>
                      </div>
                      {song.artist && <p style={{ fontSize:12, color:'#666' }}>{song.artist}</p>}
                      <p style={{ fontSize:11, color:'#555' }}>{song.lines.length} lines</p>
                    </div>
                  )
                })}
              </div>
            </aside>

            {/* Right: line navigator */}
            <main style={s.right}>
              {activeSong && presentState.mode === 'song' ? (
                <>
                  <p style={s.sectionTitle}>
                    {activeSong.title} — Line {presentState.activeLineIndex + 1} of {activeSong.lines.length}
                  </p>

                  {/* Prev / Next controls */}
                  <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                    <button onClick={() => songLine(-1)} style={{ ...s.ctrlBtn, flex:1 }} disabled={presentState.activeLineIndex === 0}>◀ Prev Line</button>
                    <button onClick={() => songLine(1)} style={{ ...s.ctrlBtn, flex:1 }} disabled={presentState.activeLineIndex >= activeSong.lines.length - 1}>Next Line ▶</button>
                  </div>

                  {/* All lines */}
                  <div style={s.activityList}>
                    {activeSong.lines.map((line, idx) => {
                      const isActive = idx === presentState.activeLineIndex
                      return (
                        <div key={line.id}
                          role="button" tabIndex={0}
                          onClick={() => updatePresent(p => goToLine(p, idx))}
                          onKeyDown={e => e.key==='Enter' && updatePresent(p => goToLine(p, idx))}
                          style={{
                            ...s.activityRow,
                            background:  isActive ? '#1e3a2a' : '#1e1e1e',
                            borderColor: isActive ? '#166534' : '#2a2a2a',
                          }}>
                          <span style={{ ...s.indexBadge, background: isActive?'#22c55e':'#2a2a2a', color: isActive?'#000':'#666' }}>
                            {idx + 1}
                          </span>
                          <span style={{ flex:1, fontSize:13, color: isActive?'#fff':'#bbb' }}>{line.text}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:12, color:'#444' }}>
                  <p style={{ fontSize:32 }}>♪</p>
                  <p style={{ fontSize:14, letterSpacing:'0.05em' }}>Select a song and press Present</p>
                </div>
              )}
            </main>
          </div>
        )}

        {/* ════════════ IMAGES TAB ════════════ */}
        {activeTab === 'images' && (
          <div style={s.twoCol}>
            <aside style={{ ...s.left, gap:12 }}>
              <p style={s.sectionTitle}>Upload Images</p>
              <label style={{
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:8, padding:'28px 16px',
                border:'2px dashed #333', borderRadius:10,
                cursor:'pointer', color:'#555', fontSize:13,
                transition:'border-color 0.2s',
              }}>
                <span style={{ fontSize:28 }}>🖼</span>
                <span>Click to upload images</span>
                <span style={{ fontSize:11, color:'#444' }}>PNG, JPG, GIF supported</span>
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display:'none' }} />
              </label>

              <p style={{ fontSize:11, color:'#555', letterSpacing:'0.08em', textTransform:'uppercase', marginTop:8 }}>
                {presentState.images.length} image{presentState.images.length !== 1 ? 's' : ''} uploaded
              </p>
            </aside>

            <main style={s.right}>
              <p style={s.sectionTitle}>Image Library</p>
              {presentState.images.length === 0 ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:12, color:'#444' }}>
                  <p style={{ fontSize:32 }}>🖼</p>
                  <p style={{ fontSize:14 }}>No images uploaded yet</p>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:10, overflowY:'auto' }}>
                  {presentState.images.map(img => {
                    const isActive = img.id === presentState.activeImageId && presentState.mode === 'image'
                    return (
                      <div key={img.id} style={{
                        border: `2px solid ${isActive ? '#3b82f6' : '#2a2a2a'}`,
                        borderRadius:10, overflow:'hidden',
                        background:'#1a1a1a', position:'relative',
                        cursor:'pointer',
                      }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.name}
                          style={{ width:'100%', height:110, objectFit:'cover', display:'block' }}
                          onClick={() => updatePresent(p => displayImage(p, img.id))}
                        />
                        <div style={{ padding:'6px 8px', display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ flex:1, fontSize:11, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{img.name}</span>
                          <button onClick={() => updatePresent(p => deleteImage(p, img.id))} style={s.removeBtn}>✕</button>
                        </div>
                        {isActive && (
                          <div style={{ position:'absolute', top:6, right:6, background:'#3b82f6', color:'#fff', fontSize:9, padding:'2px 6px', borderRadius:4, fontWeight:700, letterSpacing:'0.08em' }}>LIVE</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </main>
          </div>
        )}

        {/* ════════════ NOTICES TAB ════════════ */}
        {activeTab === 'notices' && (
          <div style={s.twoCol}>
            <aside style={{ ...s.left, gap:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={s.sectionTitle}>Announcements</p>
                <button onClick={() => setShowNoticeEditor(v => !v)} style={{ ...s.addBtn, padding:'6px 14px', fontSize:12 }}>
                  {showNoticeEditor ? 'Cancel' : '+ New Notice'}
                </button>
              </div>

              {showNoticeEditor && (
                <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:10, padding:14, display:'flex', flexDirection:'column', gap:8 }}>
                  <input type="text" placeholder="Title *" value={newNoticeTitle} onChange={e=>setNewNoticeTitle(e.target.value)} style={s.addInput} />
                  <textarea placeholder="Body text…" value={newNoticeBody} onChange={e=>setNewNoticeBody(e.target.value)}
                    style={{ ...s.addInput, height:100, resize:'vertical' }} />
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
                  const styleColors: Record<Notice['style'], string> = { default:'#60a5fa', urgent:'#f87171', celebration:'#fbbf24' }
                  return (
                    <div key={notice.id} style={{
                      ...s.activityRow,
                      background:  isActive ? '#1e3a5f' : '#1e1e1e',
                      borderColor: isActive ? '#1e40af' : '#2a2a2a',
                      flexDirection:'column', alignItems:'flex-start', cursor:'default', gap:4,
                    }}>
                      <div style={{ display:'flex', width:'100%', alignItems:'center', gap:8 }}>
                        <span style={{ flex:1, fontSize:14, fontWeight:600, color: isActive ? '#fff' : '#ccc' }}>{notice.title}</span>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:4, background:'#1a1a1a', color: styleColors[notice.style], border:`1px solid ${styleColors[notice.style]}40` }}>
                          {notice.style}
                        </span>
                        <button onClick={() => updatePresent(p => displayNotice(p, notice.id))} style={{ ...s.addBtn, padding:'5px 12px', fontSize:12 }}>Display</button>
                        <button onClick={() => updatePresent(p => deleteNotice(p, notice.id))} style={s.removeBtn}>✕</button>
                      </div>
                      {notice.body && <p style={{ fontSize:12, color:'#666', lineHeight:1.4 }}>{notice.body.slice(0,80)}{notice.body.length > 80 ? '…' : ''}</p>}
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
                  <div style={{ background:'#0a0a14', border:'1px solid #1e40af', borderRadius:12, padding:32, textAlign:'center', flex:1 }}>
                    <p style={{ fontSize:28, fontWeight:700, color:'#fff', marginBottom:12 }}>{notice.title}</p>
                    <p style={{ fontSize:16, color:'#ccc', lineHeight:1.6, whiteSpace:'pre-line' }}>{notice.body}</p>
                  </div>
                )
              })() : (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:12, color:'#444' }}>
                  <p style={{ fontSize:32 }}>📢</p>
                  <p style={{ fontSize:14 }}>Select a notice and press Display</p>
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page:         { minHeight:'100vh', background:'#111', color:'#fff', fontFamily:'var(--font-inter), system-ui, sans-serif', display:'flex', flexDirection:'column' },
  header:       { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 24px', background:'#1a1a1a', borderBottom:'1px solid #2a2a2a', flexShrink:0 },
  churchName:   { fontSize:15, fontWeight:600, letterSpacing:'0.02em' },
  subtitle:     { fontSize:11, color:'#555', marginTop:2, letterSpacing:'0.08em', textTransform:'uppercase' },
  headerBtn:    { background:'transparent', border:'1px solid', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:500, cursor:'pointer' },
  bigScreenBtn: { background:'#1e3a5f', color:'#60a5fa', border:'1px solid #1e40af', padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:500, display:'inline-block' },
  tabBar:       { display:'flex', background:'#1a1a1a', borderBottom:'1px solid #2a2a2a', flexShrink:0 },
  tab:          { padding:'12px 20px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:500, letterSpacing:'0.02em', transition:'color 0.15s' },
  content:      { flex:1, display:'flex', flexDirection:'column', minHeight:0 },
  twoCol:       { display:'grid', gridTemplateColumns:'340px 1fr', flex:1, minHeight:0 },
  left:         { padding:18, borderRight:'1px solid #2a2a2a', display:'flex', flexDirection:'column', gap:14, overflowY:'auto' },
  right:        { padding:18, display:'flex', flexDirection:'column', gap:10, overflowY:'auto' },
  timerCard:    { borderRadius:12, border:'1px solid', padding:'16px 18px 12px', transition:'background 0.6s, border-color 0.6s' },
  activityLabel:{ fontSize:11, color:'#777', textAlign:'center', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:4 },
  clockDisplay: { fontFamily:'var(--font-bebas), cursive', fontSize:72, lineHeight:1, textAlign:'center', letterSpacing:'0.04em', transition:'color 0.6s' },
  clockMeta:    { fontSize:11, color:'#555', textAlign:'center', marginTop:6 },
  progressTrack:{ height:4, background:'#111', borderRadius:2, marginTop:10, overflow:'hidden' },
  progressFill: { height:'100%', borderRadius:2, transition:'width 0.9s linear, background 0.6s' },
  legend:       { display:'flex', justifyContent:'space-between', fontSize:10, marginTop:8, gap:4 },
  controlRow:   { display:'flex', gap:8 },
  ctrlBtn:      { flex:1, padding:'9px 8px', background:'#1e1e1e', color:'#ccc', border:'1px solid #333', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },
  primaryBtn:   { flex:2, color:'#fff', fontSize:14, fontWeight:600 },
  summaryCard:  { background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:10, padding:'10px 14px', display:'flex', flexDirection:'column', gap:7 },
  summaryRow:   { display:'flex', justifyContent:'space-between', fontSize:12 },
  sectionTitle: { fontSize:11, color:'#444', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600 },
  activityList: { display:'flex', flexDirection:'column', gap:5, flex:1, overflowY:'auto' },
  activityRow:  { display:'flex', alignItems:'center', gap:9, padding:'9px 11px', borderRadius:8, border:'1px solid', cursor:'pointer', transition:'background 0.15s, border-color 0.15s, opacity 0.15s' },
  indexBadge:   { width:26, height:26, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, flexShrink:0 },
  durationBadge:{ fontSize:12, color:'#666', background:'#1a1a1a', border:'1px solid #333', padding:'3px 8px', borderRadius:5, cursor:'pointer', minWidth:36, textAlign:'center', flexShrink:0 },
  durationSelect:{ fontSize:12, background:'#1a1a1a', color:'#fff', border:'1px solid #555', borderRadius:5, padding:'3px 4px', width:64, flexShrink:0 },
  removeBtn:    { background:'none', border:'none', color:'#444', fontSize:13, padding:'2px 4px', borderRadius:4, cursor:'pointer', flexShrink:0 },
  addRow:       { display:'flex', gap:8, paddingTop:10, borderTop:'1px solid #2a2a2a', marginTop:'auto' },
  addInput:     { flex:1, background:'#1a1a1a', border:'1px solid #333', borderRadius:8, padding:'8px 11px', color:'#fff', fontSize:13, outline:'none' },
  addSelect:    { background:'#1a1a1a', border:'1px solid #333', borderRadius:8, padding:'8px 7px', color:'#fff', fontSize:12 },
  fullSelect:   { width:'100%', background:'#1a1a1a', border:'1px solid #333', borderRadius:8, padding:'8px 11px', color:'#fff', fontSize:13 },
  addBtn:       { background:'#166534', color:'#fff', border:'1px solid #14532d', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:600, cursor:'pointer' },
}