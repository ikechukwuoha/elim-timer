'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { TimerState, TimerColor, PresentState } from '@/types'
import {
  loadState,
  TIMER_CHANNEL_NAME,
  DEFAULT_STATE,
  getTimerColor,
  formatTime,
  computeRemaining,
  setServerTimeOffset,
} from '@/utils/timerStore'
import {
  loadPresentState,
  PRESENT_CHANNEL_NAME,
  DEFAULT_PRESENT_STATE,
} from '@/utils/presentStore'
import {
  clampBibleFontScale,
  mergeBibleBackgrounds,
  resolveBibleBackground,
  resolveBibleFontFamily,
} from '@/utils/bibleDisplay'
import BibleView from '@/components/BibleView'
import SongView from '@/components/SongView'
import NoticeView from '@/components/NoticeView'
import ImageView from '@/components/ImageView'
import VideoView from '@/components/VideoView'
import PresentationView from '@/components/PresentationView'
import CaptionView from '@/components/CaptionView'

const CHURCH_NAME = 'Elim Christian Garden International'
const BLINK_AT_SECS = 50

type ColorTheme = {
  timerColor: string
  glowColor: string
  bgGradient: string
  labelColor: string
  statusText: string
}

const COLOR_THEMES: Record<TimerColor, ColorTheme> = {
  green: {
    timerColor: '#22c55e',
    glowColor: 'rgba(34,197,94,0.22)',
    bgGradient: 'radial-gradient(ellipse at center,#052e16 0%,#000 75%)',
    labelColor: '#4ade80',
    statusText: 'Time Remaining',
  },
  yellow: {
    timerColor: '#fbbf24',
    glowColor: 'rgba(251,191,36,0.22)',
    bgGradient: 'radial-gradient(ellipse at center,#2d1f00 0%,#000 75%)',
    labelColor: '#fcd34d',
    statusText: 'Time Almost Up',
  },
  red: {
    timerColor: '#f87171',
    glowColor: 'rgba(248,113,113,0.25)',
    bgGradient: 'radial-gradient(ellipse at center,#2a0a0a 0%,#000 75%)',
    labelColor: '#fca5a5',
    statusText: "Time's Up!",
  },
}

const PRESENT_BG = 'radial-gradient(ellipse at center,#0a0a14 0%,#000 75%)'
const PRESENT_GLOW = 'rgba(96,165,250,0.45)'
const PRESENT_COLOR = '#93c5fd'

function useViewportWidth() {
  const [width, setWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

export default function BigScreen() {
  const [mounted, setMounted] = useState(false)
  const [timerState, setTimerState] = useState<TimerState>(DEFAULT_STATE)
  const [presentState, setPresentState] = useState<PresentState>(DEFAULT_PRESENT_STATE)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [blinkVisible, setBlinkVisible] = useState(true)
  const [displayRemaining, setDisplayRemaining] = useState<number>(0)

  const timerStateRef = useRef<TimerState>(DEFAULT_STATE)
  const rafRef = useRef<number | null>(null)
  const blinkRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const vw = useViewportWidth()
  const isMobile = vw < 640
  const isTablet = vw >= 640 && vw < 1024

  const SAFE_X = isMobile ? '12px' : isTablet ? 'clamp(16px,2.4vw,40px)' : 'clamp(20px, 3.2vw, 64px)'
  const SAFE_Y = isMobile ? '10px' : 'clamp(16px, 2.2vh, 32px)'

  useEffect(() => {
    setMounted(true)
    const ts = loadState()
    const ps = loadPresentState()
    timerStateRef.current = ts
    setTimerState(ts)
    setDisplayRemaining(Math.floor(computeRemaining(ts)))
    setPresentState(ps)
  }, [])

  useEffect(() => {
    if (!mounted) return
    let lastShown: number | null = null
    const tick = () => {
      const floored = Math.floor(computeRemaining(timerStateRef.current))
      if (floored !== lastShown) {
        lastShown = floored
        setDisplayRemaining(floored)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [mounted])

  const applyTimerUpdate = useCallback((incoming: Partial<TimerState>) => {
    setTimerState(prev => {
      const base = prev ?? DEFAULT_STATE
      const merged: TimerState = {
        ...base,
        ...incoming,
        activities: incoming.activities?.length ? incoming.activities : base.activities,
      }
      timerStateRef.current = merged
      setDisplayRemaining(Math.floor(computeRemaining(merged)))
      try { localStorage.setItem('elim_timer_state', JSON.stringify(merged)) } catch {}
      return merged
    })
  }, [])

  const applyPresentUpdate = useCallback((incoming: Partial<PresentState>) => {
    setPresentState(prev => {
      const base = prev ?? DEFAULT_PRESENT_STATE
      const mergedImages =
        incoming.images && incoming.images.length > 0
          ? incoming.images.map(slim => {
              const local = base.images?.find(l => l.id === slim.id)
              return local ?? slim
            })
          : base.images ?? []
      const mergedBibleBackgrounds =
        incoming.bibleBackgrounds && incoming.bibleBackgrounds.length > 0
          ? mergeBibleBackgrounds(
              incoming.bibleBackgrounds.map(background => {
                if (background.kind === 'image' && !background.value) {
                  const local = base.bibleBackgrounds?.find(item => item.id === background.id)
                  return local ?? background
                }
                return background
              })
            )
          : mergeBibleBackgrounds(base.bibleBackgrounds ?? [])
      const merged: PresentState = {
        ...base,
        ...incoming,
        images: mergedImages,
        bibleBackgrounds: mergedBibleBackgrounds,
        activeBibleBackgroundId: incoming.activeBibleBackgroundId ?? base.activeBibleBackgroundId,
        bibleTextColor: incoming.bibleTextColor ?? base.bibleTextColor,
        bibleFontFamilyId: incoming.bibleFontFamilyId ?? base.bibleFontFamilyId,
        bibleFontScale: clampBibleFontScale(incoming.bibleFontScale ?? base.bibleFontScale),
      }
      try { localStorage.setItem('elim_present_state', JSON.stringify(merged)) } catch {}
      return merged
    })
  }, [])

  useEffect(() => {
    if (!mounted) return
    let tbc: BroadcastChannel | null = null
    let pbc: BroadcastChannel | null = null
    try {
      tbc = new BroadcastChannel(TIMER_CHANNEL_NAME)
      tbc.onmessage = e => { if (e.data?.type === 'TIMER_UPDATE') applyTimerUpdate(e.data.state) }
      pbc = new BroadcastChannel(PRESENT_CHANNEL_NAME)
      pbc.onmessage = e => { if (e.data?.type === 'PRESENT_UPDATE') applyPresentUpdate(e.data.state) }
    } catch {}
    return () => { tbc?.close(); pbc?.close() }
  }, [mounted, applyTimerUpdate, applyPresentUpdate])

  useEffect(() => {
    if (!mounted) return
    const shouldBlink =
      displayRemaining <= BLINK_AT_SECS &&
      ['timer', 'bible', 'song'].includes(presentState?.mode ?? '')
    if (shouldBlink) {
      if (!blinkRef.current) {
        blinkRef.current = setInterval(() => setBlinkVisible(v => !v), 500)
      }
    } else {
      if (blinkRef.current) { clearInterval(blinkRef.current); blinkRef.current = null }
      setBlinkVisible(true)
    }
    return () => { if (blinkRef.current) { clearInterval(blinkRef.current); blinkRef.current = null } }
  }, [mounted, displayRemaining, presentState?.mode])

  useEffect(() => {
    if (!mounted) return
    const h = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [mounted])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen()
    else void document.exitFullscreen()
  }

  const mode = presentState.mode
  const isTimerOnly = mode === 'timer'
  const isBibleMode = mode === 'bible'
  const isSongMode = mode === 'song'
  const isCaptionMode = mode === 'caption'
  const isImageMode = mode === 'image'
  const isVideoMode = mode === 'video'
  const isPresentationMode = mode === 'presentation'
  const isNoticeMode = mode === 'notice'
  const isBlank = mode === 'blank'
  const isImmersiveMediaMode = isImageMode || isVideoMode || isPresentationMode
  const showWithContent = isBibleMode || isSongMode

  const safeActivities = timerState.activities?.length
    ? timerState.activities
    : [{ id: 0, name: 'No Activity', duration: 0 }]
  const idx = Math.min(timerState.currentIndex, safeActivities.length - 1)
  const current = safeActivities[idx]
  const currentBaseSeconds = Math.max(0, current.duration * 60)
  const currentTotalSeconds = Math.max(1, currentBaseSeconds + (timerState.additionalSeconds ?? 0))
  const currentTotalMinutes = currentTotalSeconds / 60
  const additionalMinutes = (timerState.additionalSeconds ?? 0) / 60
  const color = getTimerColor(displayRemaining, currentTotalSeconds)
  const theme = COLOR_THEMES[color]
  const pct = Math.max(0, Math.min(100, currentTotalSeconds > 0 ? (displayRemaining / currentTotalSeconds) * 100 : 0))
  const hasNext = idx < safeActivities.length - 1
  const isOvertime = displayRemaining < 0
  const activeBibleBackground = resolveBibleBackground(presentState.bibleBackgrounds, presentState.activeBibleBackgroundId)
  const bibleTextColor = presentState.bibleTextColor || '#ffffff'
  const bibleFontFamily = resolveBibleFontFamily(presentState.bibleFontFamilyId)
  const bibleFontScale = clampBibleFontScale(presentState.bibleFontScale)
  const statusTxt = isOvertime ? 'OVERTIME' : theme.statusText
  const isCrit = displayRemaining <= BLINK_AT_SECS
  const showTimerPanel = isTimerOnly || showWithContent

  const activeSong = presentState.songs?.find(s => s.id === presentState.activeSongId)
  const activeSecondaryVerse = presentState.activeSecondaryVerse
  const activeCaption = presentState.activeCaption
  const activeImage = presentState.images?.find(i => i.id === presentState.activeImageId)
  const activeVideo = presentState.videos?.find(v => v.id === presentState.activeVideoId)
  const activePresentation = presentState.presentations?.find(
    p => p.id === presentState.activePresentationId
  )
  const activeNotice = presentState.notices?.find(n => n.id === presentState.activeNoticeId)

  const bg = showTimerPanel ? theme.bgGradient : PRESENT_BG
  const glowColor = showTimerPanel ? theme.glowColor : PRESENT_GLOW
  const mainColor = showTimerPanel ? theme.timerColor : PRESENT_COLOR

  if (!mounted) {
    return (
      <div style={{
        width: '100dvw', height: '100dvh',
        background: COLOR_THEMES.green.bgGradient,
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
        fontFamily: 'var(--font-inter),system-ui,sans-serif',
      }} />
    )
  }

  return (
    <>
      <style>{`
        @keyframes calm-pulse{0%,100%{text-shadow:0 0 24px rgba(34,197,94,.3),0 0 48px rgba(34,197,94,.15)}50%{text-shadow:0 0 40px rgba(34,197,94,.45),0 0 80px rgba(34,197,94,.22)}}
        @keyframes warn-pulse{0%,100%{text-shadow:0 0 20px rgba(251,191,36,.25),0 0 40px rgba(251,191,36,.12);transform:scale(1)}50%{text-shadow:0 0 36px rgba(251,191,36,.4),0 0 70px rgba(251,191,36,.2);transform:scale(1.012)}}
        @keyframes crit-pulse{0%,100%{text-shadow:0 0 24px rgba(248,113,113,.3),0 0 48px rgba(248,113,113,.15);transform:scale(1)}25%{text-shadow:0 0 40px rgba(248,113,113,.45),0 0 80px rgba(248,113,113,.22);transform:scale(1.02)}75%{text-shadow:0 0 30px rgba(248,113,113,.35),0 0 60px rgba(248,113,113,.18);transform:scale(.99)}}
        @keyframes bg-breathe{0%,100%{opacity:1}50%{opacity:.85}}
        @keyframes bg-warn{0%,100%{opacity:1}50%{opacity:.7}}
        @keyframes bg-flash{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes bar-pulse{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes lbl-pulse{0%,100%{opacity:.75}50%{opacity:1}}
        @keyframes fade-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slide-up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slide-right{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes scale-in{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
        @keyframes next-glow{0%,100%{box-shadow:0 0 16px rgba(251,191,36,0.3),0 0 32px rgba(251,191,36,0.15)}50%{box-shadow:0 0 28px rgba(251,191,36,0.55),0 0 56px rgba(251,191,36,0.28)}}
        @keyframes scroll-alert{0%{transform:translateX(0)}100%{transform:translateX(-100%)}}
        .tc{animation:calm-pulse 3s ease-in-out infinite}
        .tw{animation:warn-pulse 1.6s ease-in-out infinite}
        .tx{animation:crit-pulse .7s ease-in-out infinite}
        .bg-g{animation:bg-breathe 4s ease-in-out infinite}
        .bg-y{animation:bg-warn 2s ease-in-out infinite}
        .bg-r{animation:bg-flash .7s ease-in-out infinite}
        .bar-p{animation:bar-pulse 2s ease-in-out infinite}
        .lbl-p{animation:lbl-pulse 2s ease-in-out infinite}
        .fi{animation:fade-in .55s ease-out both}
        .su{animation:slide-up .5s ease-out both}
        .sr{animation:slide-right .5s ease-out both}
        .sc{animation:scale-in .45s ease-out both}
        .next-pill{animation:next-glow 2s ease-in-out infinite}
      `}</style>

      <div
        style={{
          width: '100dvw',
          height: '100dvh',
          background: bg,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          transition: 'background 1s ease',
          fontFamily: 'var(--font-inter),system-ui,sans-serif',
          boxSizing: 'border-box',
        }}
      >
        {/* Grid overlay */}
        <div
          className={showTimerPanel ? (color === 'green' ? 'bg-g' : color === 'yellow' ? 'bg-y' : 'bg-r') : ''}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />

        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,0.55) 100%)',
          zIndex: 1,
        }} />

        {/* ─── Main layout container ─── */}
        <div
          style={{
            position: 'absolute',
            inset: isImmersiveMediaMode ? '0' : `${SAFE_Y} ${SAFE_X} ${SAFE_Y} ${SAFE_X}`,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            minHeight: 0,
            zIndex: 10,
            boxSizing: 'border-box',
            gap: isImmersiveMediaMode ? '0' : (isMobile ? '8px' : 'clamp(10px, 1.6vh, 18px)'),
          }}
        >
          {/* ─── Header ─── */}
          {!isImmersiveMediaMode && (
            <header
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: isMobile ? 8 : 20,
                padding: isMobile ? '8px 10px' : '12px 18px',
                background: isImageMode || isVideoMode || isPresentationMode
                  ? 'linear-gradient(180deg,rgba(0,0,0,0.7) 0%,transparent 100%)'
                  : 'linear-gradient(180deg,rgba(0,0,0,0.5) 0%,transparent 100%)',
                borderBottom: `1px solid ${mainColor}22`,
                transition: 'border-color .6s ease',
                borderRadius: isMobile ? 12 : 18,
                minWidth: 0,
                boxSizing: 'border-box',
              }}
            >
              {/* Left: logo + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: isMobile ? 32 : 'clamp(44px, 4vw, 60px)',
                    height: isMobile ? 32 : 'clamp(44px, 4vw, 60px)',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: `2px solid ${mainColor}80`,
                    boxShadow: `0 0 0 1px ${mainColor}30, 0 0 24px ${glowColor}`,
                    flexShrink: 0,
                    transition: 'border-color .6s, box-shadow .6s',
                  }}
                >
                  <img
                    src="/church-logo.jpg"
                    alt="Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-cinzel),serif',
                      fontSize: isMobile ? '11px' : 'clamp(13px,1.6vw,22px)',
                      fontWeight: 700,
                      color: '#fff',
                      letterSpacing: isMobile ? '0.06em' : '0.12em',
                      textTransform: 'uppercase',
                      textShadow: `0 0 28px ${glowColor}, 0 2px 4px rgba(0,0,0,0.8)`,
                      lineHeight: 1.1,
                      margin: 0,
                      transition: 'text-shadow .6s',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: isMobile ? 'nowrap' : 'normal',
                      overflowWrap: isMobile ? 'unset' : 'break-word',
                      maxWidth: isMobile ? '100%' : 'min(52vw, 680px)',
                    }}
                  >
                    {isMobile ? 'Elim C.G. Int\'l' : CHURCH_NAME}
                  </p>

                  {showTimerPanel && (
                    <p
                      style={{
                        fontSize: isMobile ? '8px' : 'clamp(9px,0.95vw,12px)',
                        color: 'rgba(255,255,255,0.55)',
                        letterSpacing: '0.24em',
                        textTransform: 'uppercase',
                        fontWeight: 400,
                        marginTop: isMobile ? 2 : 5,
                        textShadow: `0 0 12px ${glowColor}`,
                      }}
                    >
                      {isMobile
                        ? `${idx + 1}/${safeActivities.length}`
                        : `Activity ${idx + 1} of ${safeActivities.length}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: timer + status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 20, flexShrink: 0 }}>

                {/* Timer digits in header (only when bible/song mode) */}
                {showWithContent && (
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    gap: isMobile ? 8 : 16,
                    padding: isMobile ? '6px 12px' : '8px 22px',
                    background: 'linear-gradient(135deg,rgba(0,0,0,0.65) 0%,rgba(0,0,0,0.45) 100%)',
                    border: `1.5px solid ${theme.timerColor}55`,
                    borderRadius: isMobile ? 12 : 16,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: `0 0 0 1px ${theme.timerColor}20, 0 6px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 32px ${theme.glowColor}`,
                  }}>

                    {/* Status label — hidden on mobile */}
                    {!isMobile && (
                      <p className="lbl-p" style={{
                        fontSize: 'clamp(9px,0.85vw,13px)',
                        fontWeight: 800, color: theme.timerColor,
                        letterSpacing: '0.32em', textTransform: 'uppercase',
                        margin: 0,
                        textShadow: `0 0 16px ${theme.glowColor}, 0 0 32px ${theme.glowColor}`,
                      }}>
                        {statusTxt}
                      </p>
                    )}

                    {!isMobile && (
                      <div style={{ width: 1, height: 28, background: `${theme.timerColor}40`, flexShrink: 0 }} />
                    )}

                    {/* BIG digits */}
                    <p
                      className={isCrit ? 'tx' : color === 'yellow' ? 'tw' : 'tc'}
                      style={{
                        fontFamily: 'var(--font-bebas),cursive',
                        fontSize: isMobile ? 'clamp(28px,7.5vw,40px)' : 'clamp(36px,4.2vw,62px)',
                        lineHeight: 1,
                        color: blinkVisible ? theme.timerColor : 'transparent',
                        letterSpacing: '0.04em',
                        transition: isCrit ? 'none' : 'color 1s ease',
                        userSelect: 'none',
                        margin: 0,
                        textShadow: `0 0 24px ${theme.glowColor}, 0 0 48px ${theme.glowColor}`,
                      }}
                    >
                      {formatTime(displayRemaining)}
                    </p>

                    {!isMobile && (
                      <div style={{ width: 1, height: 28, background: `${theme.timerColor}40`, flexShrink: 0 }} />
                    )}

                    {/* Activity name + duration — hidden on mobile */}
                    {!isMobile && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <p style={{
                          fontFamily: 'var(--font-cinzel),serif',
                          fontSize: 'clamp(10px,1vw,15px)',
                          fontWeight: 700, color: 'rgba(255,255,255,0.95)',
                          letterSpacing: '0.06em', margin: 0, lineHeight: 1.2,
                          maxWidth: 'clamp(90px,11vw,180px)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textShadow: `0 0 14px ${theme.glowColor}`,
                        }}>
                          {current.name}
                        </p>
                        <p style={{
                          fontSize: 'clamp(9px,0.75vw,11px)',
                          fontWeight: 700, color: 'rgba(255,255,255,0.55)',
                          letterSpacing: '0.24em', textTransform: 'uppercase', margin: 0,
                        }}>
                          {currentTotalMinutes} min
                        </p>
                        {additionalMinutes > 0 && (
                          <p style={{
                            fontSize: 'clamp(9px,0.75vw,11px)',
                            fontWeight: 700,
                            color: '#fcd34d',
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            margin: 0,
                          }}>
                            +{additionalMinutes} min added
                          </p>
                        )}
                      </div>
                    )}

                    {/* Vertical progress pip */}
                    <div style={{
                      width: 4,
                      height: isMobile ? 28 : 42,
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 2, overflow: 'hidden', flexShrink: 0,
                    }}>
                      <div className="bar-p" style={{
                        width: '100%',
                        height: `${pct}%`,
                        background: `linear-gradient(180deg,${theme.timerColor}88,${theme.timerColor})`,
                        borderRadius: 2,
                        transition: 'height 0.9s linear, background 1s ease',
                        boxShadow: `0 0 8px ${theme.glowColor}`,
                        position: 'relative',
                        top: `${100 - pct}%`,
                        transform: 'translateY(-100%)',
                      }} />
                    </div>

                    {/* Next up — desktop only */}
                    {hasNext && !isTablet && !isMobile && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 5,
                        minWidth: 'clamp(150px, 14vw, 220px)',
                        padding: '7px 16px',
                        background: 'rgba(251,191,36,0.09)',
                        border: '1px solid rgba(251,191,36,0.4)',
                        borderRadius: 12,
                      }}>
                        <p style={{
                          fontSize: 'clamp(8px,0.72vw,10px)',
                          color: '#fbbf24', letterSpacing: '0.3em',
                          textTransform: 'uppercase', margin: 0,
                          fontWeight: 700, textShadow: '0 0 10px rgba(251,191,36,0.7)',
                        }}>
                          ▶ Up Next
                        </p>
                        <p style={{
                          fontSize: 'clamp(10px,0.95vw,14px)',
                          color: '#fff', fontWeight: 700,
                          letterSpacing: '0.05em', margin: 0,
                          maxWidth: 'clamp(120px,12vw,190px)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textShadow: '0 0 12px rgba(251,191,36,0.35)',
                        }}>
                          {safeActivities[idx + 1].name}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Live/Paused dot + mode label */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 9,
                  fontSize: isMobile ? 9 : 13,
                  color: 'rgba(255,255,255,0.75)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  textShadow: `0 0 10px ${glowColor}`,
                }}>
                  <span style={{
                    width: isMobile ? 8 : 10,
                    height: isMobile ? 8 : 10,
                    borderRadius: '50%',
                    display: 'inline-block',
                    background: timerState.running && showTimerPanel ? '#22c55e' : 'rgba(255,255,255,0.2)',
                    boxShadow: timerState.running && showTimerPanel ? '0 0 14px #22c55e, 0 0 4px #22c55e' : 'none',
                    transition: 'background 0.4s, box-shadow 0.4s',
                  }} />
                  {isBlank ? 'Standby'
                    : isCaptionMode ? 'Caption'
                    : isImageMode ? 'Image'
                    : isVideoMode ? 'Video'
                    : isPresentationMode ? 'Presentation'
                    : isNoticeMode ? 'Notice'
                    : showWithContent
                      ? (isMobile
                          ? mode.charAt(0).toUpperCase() + mode.slice(1)
                          : `${mode.charAt(0).toUpperCase() + mode.slice(1)} + Timer`)
                      : timerState.running ? 'Live' : 'Paused'}
                </div>
              </div>
            </header>
          )}

          {/* ─── Alert Scroller ─── */}
          {presentState.alertActive && presentState.alertMinisters.length > 0 && (
            <div style={{
              position: 'absolute',
              [presentState.alertPosition]: 0,
              left: 0,
              right: 0,
              zIndex: 20,
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.65)',
              borderBottom: presentState.alertPosition === 'top' ? '1px solid rgba(255,255,255,0.3)' : 'none',
              borderTop: presentState.alertPosition === 'bottom' ? '1px solid rgba(255,255,255,0.3)' : 'none',
              padding: '6px 0',
            }}>
              <div style={{
                display: 'inline-block',
                whiteSpace: 'nowrap',
                color: '#fff',
                fontSize: 'clamp(12px, 1.1vw, 20px)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 700,
                paddingLeft: '100%',
                animation: `scroll-alert ${Math.max(8, (presentState.alertIntervalMs || 2500) / 1000 * (presentState.alertMinisters.length || 1))}s linear ${presentState.alertRepeats > 0 ? presentState.alertRepeats : 'infinite'}`,
              }}>
                {presentState.alertMinisters.join('  •  ')}
                {'   •   '}
                {presentState.alertMinisters.join('  •  ')}
              </div>
            </div>
          )}

          {/* ─── Main Content ─── */}
          <main
            style={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              position: 'relative',
              zIndex: isImageMode ? 1 : 2,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'center',
              padding: isImmersiveMediaMode
                ? '0'
                : isTimerOnly
                  ? (isMobile ? '4px 2px 8px' : '8px 6px 18px')
                  : showWithContent
                    ? (isMobile ? '2px 0 8px' : '6px 2px 18px')
                    : '0',
              boxSizing: 'border-box',
            }}
          >
            {/* ── Timer-only mode ── */}
            {isTimerOnly && (
              <div
                className="sc"
                style={{
                  width: '100%', height: '100%',
                  maxWidth: 'min(100%, 1600px)',
                  margin: '0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0,
                  padding: isMobile ? '0 8px' : '0 12px',
                  boxSizing: 'border-box',
                }}
              >
                {/* ── STATUS TEXT (OVERTIME / Time Remaining etc.) ── */}
                <p
                  className="lbl-p"
                  style={{
                    fontSize: isMobile ? '14px' : 'clamp(18px,2.6vw,38px)',
                    fontWeight: 800,
                    color: theme.timerColor,
                    letterSpacing: isMobile ? '0.3em' : '0.5em',
                    textTransform: 'uppercase',
                    margin: isMobile ? '0 0 4px' : '0 0 10px',
                    textShadow: `0 0 32px ${theme.glowColor}, 0 0 60px ${theme.glowColor}, 0 2px 8px rgba(0,0,0,0.9)`,
                    textAlign: 'center',
                  }}
                >
                  {statusTxt}
                </p>

                {/* ── BIG TIMER DIGITS ── */}
                <p
                  className={isCrit ? 'tx' : color === 'yellow' ? 'tw' : 'tc'}
                  style={{
                    fontFamily: 'var(--font-bebas),cursive',
                    fontSize: isMobile ? 'min(38vw, 30vh)' : 'min(42vw,42vh)',
                    lineHeight: 0.85,
                    color: blinkVisible ? theme.timerColor : 'transparent',
                    letterSpacing: '0.03em',
                    transition: isCrit ? 'none' : 'color 1s ease',
                    userSelect: 'none',
                    margin: 0,
                    textAlign: 'center',
                  }}
                >
                  {formatTime(displayRemaining)}
                </p>

                {/* Divider line */}
                <div style={{
                  width: isMobile ? 'min(140px, 38vw)' : 'min(220px, 28vw)',
                  height: 2,
                  margin: isMobile ? '10px 0' : 'clamp(12px,2vw,28px) 0',
                  background: `linear-gradient(to right,transparent,${theme.timerColor},transparent)`,
                  borderRadius: 1, opacity: 0.6, flexShrink: 0,
                }} />

                {/* ── ACTIVITY NAME ── */}
                <p
                  style={{
                    fontFamily: 'var(--font-cinzel),serif',
                    fontSize: isMobile ? 'min(5vw, 4.5vh)' : 'min(6.2vw,6.2vh)',
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: isMobile ? '0.06em' : '0.1em',
                    textAlign: 'center',
                    textShadow: `0 0 50px ${theme.glowColor}, 0 2px 12px rgba(0,0,0,0.9)`,
                    lineHeight: 1.15,
                    maxWidth: isMobile ? '90vw' : 'min(78vw, 1200px)',
                    padding: '0 8px',
                    boxSizing: 'border-box',
                    margin: 0,
                  }}
                >
                  {current.name}
                </p>

                {/* ── MINUTES ALLOCATED ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                  <p style={{
                    marginTop: isMobile ? '6px' : 'clamp(8px,1vw,16px)',
                    fontSize: isMobile ? '12px' : 'min(2.8vw,2.8vh)',
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.92)',
                    letterSpacing: '0.32em',
                    textTransform: 'uppercase',
                    textShadow: '0 0 20px rgba(255,255,255,0.3), 0 2px 6px rgba(0,0,0,0.8)',
                    textAlign: 'center',
                    marginBottom: 0,
                  }}>
                    {currentTotalMinutes} minutes allocated
                  </p>
                  {additionalMinutes > 0 && (
                    <p style={{
                      margin: 0,
                      fontSize: isMobile ? '11px' : 'min(2vw,2vh)',
                      fontWeight: 700,
                      color: '#fcd34d',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      textShadow: '0 0 16px rgba(251,191,36,0.4)',
                      textAlign: 'center',
                    }}>
                      Additional time: +{additionalMinutes} minutes
                    </p>
                  )}
                </div>

                {/* ── NEXT ACTIVITY PILL ── */}
                {hasNext && (
                  <div
                    className="next-pill"
                    style={{
                      marginTop: isMobile ? '12px' : 'clamp(14px,2vw,30px)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: isMobile ? 10 : 18,
                      minWidth: isMobile ? 'min(240px, 84vw)' : 'clamp(320px, 34vw, 500px)',
                      padding: isMobile ? '10px 22px' : 'clamp(12px,1.5vh,20px) clamp(28px,3vw,54px)',
                      background: 'rgba(251,191,36,0.10)',
                      border: '2px solid rgba(251,191,36,0.55)',
                      borderRadius: 999,
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Arrow icon */}
                    <span style={{
                      fontSize: isMobile ? '16px' : 'clamp(18px,1.9vw,28px)',
                      color: '#fbbf24',
                      lineHeight: 1,
                      flexShrink: 0,
                    }}>
                      ▶
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, minWidth: 0 }}>
                      <span style={{
                        fontSize: isMobile ? '10px' : 'clamp(12px,1.15vw,16px)',
                        fontWeight: 700,
                        color: '#fbbf24',
                        letterSpacing: '0.35em',
                        textTransform: 'uppercase',
                        textShadow: '0 0 16px rgba(251,191,36,0.7)',
                        lineHeight: 1,
                      }}>
                        Up Next
                      </span>
                      <span style={{
                        fontSize: isMobile ? '16px' : 'clamp(18px,2.2vw,30px)',
                        fontWeight: 700,
                        color: '#fff',
                        letterSpacing: isMobile ? '0.06em' : '0.1em',
                        textShadow: '0 0 24px rgba(251,191,36,0.4), 0 2px 6px rgba(0,0,0,0.8)',
                        lineHeight: 1.15,
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-cinzel),serif',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}>
                        {safeActivities[idx + 1].name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Bible / Song mode ── */}
            {showWithContent && (
              <div
                className="fi"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: isMobile ? 14 : 20,
                  border: `1px solid ${PRESENT_COLOR}30`,
                  background: 'rgba(4,8,20,0.6)',
                  boxShadow: `0 0 0 1px ${PRESENT_COLOR}15, 0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)`,
                  overflow: 'hidden',
                  backdropFilter: 'blur(12px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isBibleMode && presentState.activeVerse && (
                  <BibleView
                    verse={presentState.activeVerse}
                    secondaryVerse={activeSecondaryVerse}
                    displayMode={presentState.bibleDisplayMode}
                    glowColor={PRESENT_GLOW}
                    timerColor={PRESENT_COLOR}
                    background={activeBibleBackground}
                    textColor={bibleTextColor}
                    fontFamily={bibleFontFamily}
                    fontScale={bibleFontScale}
                  />
                )}
                {isSongMode && activeSong && (
                  <SongView
                    song={activeSong}
                    lineIndex={presentState.activeLineIndex}
                    glowColor={PRESENT_GLOW}
                    timerColor={PRESENT_COLOR}
                  />
                )}
              </div>
            )}
            {/* ── Notice mode ── */}
            {isNoticeMode && activeNotice && (
              <div className="sc" style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <NoticeView
                  notice={activeNotice}
                  glowColor={PRESENT_GLOW}
                  timerColor={PRESENT_COLOR}
                />
              </div>
            )}

            {/* ── Caption mode ── */}
            {isCaptionMode && activeCaption && (
              <div className="sc" style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CaptionView
                  caption={activeCaption}
                  glowColor={PRESENT_GLOW}
                  timerColor={PRESENT_COLOR}
                />
              </div>
            )}

            {/* ── Image mode ── */}
            {isImageMode && activeImage && (
              <div className="sc" style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ImageView image={activeImage} />
              </div>
            )}

            {/* ── Video mode ── */}
            {isVideoMode && activeVideo && (
              <div className="sc" style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
              }}>
                <VideoView video={activeVideo} />
              </div>
            )}

            {/* ── Presentation mode ── */}
            {isPresentationMode && activePresentation && (
              <div className="sc" style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <PresentationView presentation={activePresentation} />
              </div>
            )}

            {/* ── Blank mode ── */}
            {isBlank && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <p style={{
                  color: 'rgba(255,255,255,0.04)',
                  fontSize: 13, letterSpacing: '0.3em', textTransform: 'uppercase',
                }}>
                  Standby
                </p>
              </div>
            )}
          </main>
        </div>

        {/* ─── Bottom progress bar ─── */}
        {showTimerPanel && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: isMobile ? 4 : 6,
            background: 'rgba(255,255,255,0.04)', zIndex: 10,
          }}>
            <div className="bar-p" style={{
              height: '100%', width: `${pct}%`,
              background: `linear-gradient(90deg,${theme.timerColor}88,${theme.timerColor})`,
              boxShadow: `0 0 16px ${theme.glowColor}`,
              transition: 'width 0.9s linear, background 1s ease',
            }} />
          </div>
        )}

        {/* ─── Fullscreen button ─── */}
        <button
          onClick={toggleFullscreen}
          style={{
            position: 'absolute',
            bottom: isMobile ? 14 : 24,
            right: isMobile ? 14 : 24,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.4)',
            padding: isMobile ? '4px 10px' : '6px 16px',
            borderRadius: 8,
            fontSize: isMobile ? 9 : 11,
            cursor: 'pointer',
            zIndex: 20,
            letterSpacing: '0.06em',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {isFullscreen ? '↙ Exit' : '⛶'}
        </button>
      </div>
    </>
  )
}
