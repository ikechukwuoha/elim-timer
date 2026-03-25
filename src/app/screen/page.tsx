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
import BibleView from '@/components/BibleView'
import SongView from '@/components/SongView'
import NoticeView from '@/components/NoticeView'
import ImageView from '@/components/ImageView'
import VideoView from '@/components/VideoView'
import PresentationView from '@/components/PresentationView'

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
      const merged: PresentState = { ...base, ...incoming, images: mergedImages }
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
  const isImageMode = mode === 'image'
  const isVideoMode = mode === 'video'
  const isPresentationMode = mode === 'presentation'
  const isNoticeMode = mode === 'notice'
  const isBlank = mode === 'blank'
  const isImmersiveMediaMode = isVideoMode || isPresentationMode
  const showWithContent = isBibleMode || isSongMode

  const safeActivities = timerState.activities?.length
    ? timerState.activities
    : [{ id: 0, name: 'No Activity', duration: 0 }]
  const idx = Math.min(timerState.currentIndex, safeActivities.length - 1)
  const current = safeActivities[idx]
  const color = getTimerColor(displayRemaining, current.duration * 60)
  const theme = COLOR_THEMES[color]
  const pct = Math.max(0, Math.min(100, current.duration > 0 ? (displayRemaining / (current.duration * 60)) * 100 : 0))
  const hasNext = idx < safeActivities.length - 1
  const isOvertime = displayRemaining < 0
  const statusTxt = isOvertime ? 'OVERTIME' : theme.statusText
  const isCrit = displayRemaining <= BLINK_AT_SECS
  const showTimerPanel = isTimerOnly || showWithContent

  const activeSong = presentState.songs?.find(s => s.id === presentState.activeSongId)
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

              {/* Right: status indicators */}
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, flexShrink: 0 }}>
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
                <p style={{
                  marginTop: isMobile ? '6px' : 'clamp(8px,1vw,16px)',
                  fontSize: isMobile ? '12px' : 'min(2.8vw,2.8vh)',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.92)',
                  letterSpacing: '0.32em',
                  textTransform: 'uppercase',
                  textShadow: '0 0 20px rgba(255,255,255,0.3), 0 2px 6px rgba(0,0,0,0.8)',
                  textAlign: 'center',
                }}>
                  {current.duration} minutes allocated
                </p>

                {/* ── NEXT ACTIVITY PILL ── */}
                {hasNext && (
                  <div
                    className="next-pill"
                    style={{
                      marginTop: isMobile ? '12px' : 'clamp(14px,2vw,30px)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: isMobile ? 8 : 14,
                      padding: isMobile ? '8px 18px' : 'clamp(10px,1.2vh,16px) clamp(20px,2.4vw,40px)',
                      background: 'rgba(251,191,36,0.10)',
                      border: '2px solid rgba(251,191,36,0.55)',
                      borderRadius: 999,
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Arrow icon */}
                    <span style={{
                      fontSize: isMobile ? '13px' : 'clamp(14px,1.6vw,22px)',
                      color: '#fbbf24',
                      lineHeight: 1,
                      flexShrink: 0,
                    }}>
                      ▶
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                      <span style={{
                        fontSize: isMobile ? '9px' : 'clamp(10px,1vw,14px)',
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
                        fontSize: isMobile ? '13px' : 'clamp(14px,1.8vw,26px)',
                        fontWeight: 700,
                        color: '#fff',
                        letterSpacing: isMobile ? '0.06em' : '0.1em',
                        textShadow: '0 0 24px rgba(251,191,36,0.4), 0 2px 6px rgba(0,0,0,0.8)',
                        lineHeight: 1.2,
                        textTransform: 'uppercase',
                        fontFamily: 'var(--font-cinzel),serif',
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
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'grid',
                  gridTemplateColumns: isMobile
                    ? '1fr'
                    : isTablet
                      ? 'minmax(0,1fr) clamp(140px,14vw,180px)'
                      : 'minmax(0,1fr) clamp(160px, 16vw, 220px)',
                  gridTemplateRows: isMobile ? '1fr auto' : '1fr',
                  gap: isMobile ? '8px' : 'clamp(10px, 1.4vw, 18px)',
                  alignItems: 'stretch',
                }}
              >
                {/* Content panel */}
                <div
                  className="fi"
                  style={{
                    minWidth: 0,
                    minHeight: 0,
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
                      glowColor={PRESENT_GLOW}
                      timerColor={PRESENT_COLOR}
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

                {/* Timer sidebar */}
                {isMobile ? (
                  <div
                    className="su"
                    style={{
                      minWidth: 0,
                      border: `1px solid ${theme.timerColor}28`,
                      background: 'rgba(0,0,0,0.5)',
                      borderRadius: 14,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      backdropFilter: 'blur(10px)',
                      boxSizing: 'border-box',
                      flexShrink: 0,
                    }}
                  >
                    <p
                      className={isCrit ? 'tx' : color === 'yellow' ? 'tw' : 'tc'}
                      style={{
                        fontFamily: 'var(--font-bebas),cursive',
                        fontSize: 'clamp(32px, 11vw, 52px)',
                        lineHeight: 1,
                        color: blinkVisible ? theme.timerColor : 'transparent',
                        letterSpacing: '0.03em',
                        transition: isCrit ? 'none' : 'color 1s ease',
                        userSelect: 'none',
                        margin: 0,
                        flexShrink: 0,
                      }}
                    >
                      {formatTime(displayRemaining)}
                    </p>

                    <div style={{ width: 1, alignSelf: 'stretch', background: `${theme.timerColor}30`, flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="lbl-p" style={{
                        fontSize: '9px', fontWeight: 800,
                        color: theme.timerColor, letterSpacing: '0.28em',
                        textTransform: 'uppercase', margin: '0 0 2px',
                        textShadow: `0 0 10px ${theme.glowColor}`,
                      }}>
                        {statusTxt}
                      </p>
                      <p style={{
                        fontFamily: 'var(--font-cinzel),serif',
                        fontSize: '10px', fontWeight: 600,
                        color: 'rgba(255,255,255,0.85)',
                        margin: 0, lineHeight: 1.3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {current.name}
                      </p>
                      <p style={{
                        fontSize: '8px', color: 'rgba(255,255,255,0.55)',
                        letterSpacing: '0.22em', textTransform: 'uppercase', margin: '2px 0 0',
                        fontWeight: 600,
                      }}>
                        {current.duration} min
                      </p>
                    </div>

                    <div style={{
                      width: 4, height: '100%', minHeight: 36,
                      background: 'rgba(255,255,255,0.06)',
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
                  </div>
                ) : (
                  <div
                    className="sr"
                    style={{
                      minWidth: 0,
                      border: `1px solid ${theme.timerColor}28`,
                      background: 'rgba(0,0,0,0.45)',
                      borderRadius: 20,
                      boxShadow: `0 0 0 1px ${theme.timerColor}12, 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)`,
                      padding: isTablet ? '14px 10px 12px' : '18px 12px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backdropFilter: 'blur(10px)',
                      gap: isTablet ? 6 : 8,
                      transition: 'border-color .5s, box-shadow .5s',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{
                      width: '60%', height: 2, borderRadius: 1,
                      background: `linear-gradient(to right,transparent,${theme.timerColor},transparent)`,
                      opacity: 0.5, marginBottom: 4,
                    }} />

                    {/* Sidebar status text */}
                    <p className="lbl-p" style={{
                      fontSize: isTablet ? 'clamp(8px,0.75vw,11px)' : 'clamp(9px,0.85vw,13px)',
                      fontWeight: 800, color: theme.timerColor,
                      letterSpacing: '0.3em', textTransform: 'uppercase',
                      margin: 0, textAlign: 'center',
                      textShadow: `0 0 14px ${theme.glowColor}, 0 0 28px ${theme.glowColor}`,
                    }}>
                      {statusTxt}
                    </p>

                    <p
                      className={isCrit ? 'tx' : color === 'yellow' ? 'tw' : 'tc'}
                      style={{
                        fontFamily: 'var(--font-bebas),cursive',
                        fontSize: isTablet ? 'clamp(34px,6.5vw,60px)' : 'clamp(42px,8.5vw,80px)',
                        lineHeight: 1,
                        color: blinkVisible ? theme.timerColor : 'transparent',
                        letterSpacing: '0.03em',
                        transition: isCrit ? 'none' : 'color 1s ease',
                        userSelect: 'none',
                        margin: 0, textAlign: 'center',
                      }}
                    >
                      {formatTime(displayRemaining)}
                    </p>

                    <div style={{
                      width: '75%', height: 1, borderRadius: 1,
                      background: `linear-gradient(to right,transparent,${theme.timerColor}60,transparent)`,
                      opacity: 0.6,
                    }} />

                    <p style={{
                      fontFamily: 'var(--font-cinzel),serif',
                      fontSize: isTablet ? 'clamp(9px,0.85vw,12px)' : 'clamp(10px,1vw,13px)',
                      fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                      letterSpacing: '0.06em', textAlign: 'center',
                      textShadow: `0 0 14px ${theme.glowColor}`,
                      lineHeight: 1.35, margin: 0,
                    }}>
                      {current.name}
                    </p>

                    {/* Sidebar minutes allocated */}
                    <p style={{
                      fontSize: isTablet ? 'clamp(8px,0.75vw,10px)' : 'clamp(9px,0.85vw,11px)',
                      fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                      letterSpacing: '0.22em', textTransform: 'uppercase',
                      textAlign: 'center', margin: 0,
                    }}>
                      {current.duration} min
                    </p>

                    <div style={{
                      width: '88%', height: 3,
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 2, overflow: 'hidden', flexShrink: 0,
                    }}>
                      <div className="bar-p" style={{
                        height: '100%', width: `${pct}%`,
                        background: `linear-gradient(90deg,${theme.timerColor}88,${theme.timerColor})`,
                        borderRadius: 2,
                        transition: 'width 0.9s linear, background 1s ease',
                        boxShadow: `0 0 8px ${theme.glowColor}`,
                      }} />
                    </div>

                    {/* Sidebar next activity */}
                    {hasNext && (
                      <div style={{
                        marginTop: 6, textAlign: 'center',
                        padding: isTablet ? '7px 10px' : '10px 12px',
                        background: 'rgba(251,191,36,0.08)',
                        border: '1px solid rgba(251,191,36,0.45)',
                        borderRadius: 10, width: '100%', boxSizing: 'border-box',
                      }}>
                        <p style={{
                          fontSize: 'clamp(7px,0.65vw,9px)',
                          color: '#fbbf24',
                          letterSpacing: '0.28em', textTransform: 'uppercase',
                          margin: '0 0 4px', fontWeight: 700,
                          textShadow: '0 0 10px rgba(251,191,36,0.6)',
                        }}>
                          ▶ Up Next
                        </p>
                        <p style={{
                          fontSize: isTablet ? 'clamp(8px,0.75vw,10px)' : 'clamp(9px,0.9vw,12px)',
                          color: '#fff',
                          fontWeight: 700,
                          letterSpacing: '0.06em', lineHeight: 1.3, margin: 0,
                          textShadow: '0 0 12px rgba(251,191,36,0.3)',
                        }}>
                          {safeActivities[idx + 1].name}
                        </p>
                      </div>
                    )}

                    <div style={{
                      width: '60%', height: 2, borderRadius: 1,
                      background: `linear-gradient(to right,transparent,${theme.timerColor},transparent)`,
                      opacity: 0.3, marginTop: 4,
                    }} />
                  </div>
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