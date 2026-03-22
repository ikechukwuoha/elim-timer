'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { TimerState, TimerColor, PresentState } from '@/types'
import { loadState, TIMER_CHANNEL_NAME, getTimerColor, formatTime } from '@/utils/timerStore'
import { loadPresentState, PRESENT_CHANNEL_NAME } from '@/utils/presentStore'
import BibleView  from '@/components/BibleView'
import SongView   from '@/components/SongView'
import NoticeView from '@/components/NoticeView'
import ImageView  from '@/components/ImageView'

const CHURCH_NAME   = 'Elim Christian Garden International'
const BLINK_AT_SECS = 50

type ColorTheme = {
  timerColor: string
  glowColor:  string
  bgGradient: string
  labelColor: string
  statusText: string
}

const COLOR_THEMES: Record<TimerColor, ColorTheme> = {
  green: {
    timerColor: '#22c55e', glowColor: 'rgba(34,197,94,0.5)',
    bgGradient: 'radial-gradient(ellipse at center, #052e16 0%, #000 75%)',
    labelColor: '#4ade80', statusText: 'Time Remaining',
  },
  yellow: {
    timerColor: '#fbbf24', glowColor: 'rgba(251,191,36,0.5)',
    bgGradient: 'radial-gradient(ellipse at center, #2d1f00 0%, #000 75%)',
    labelColor: '#fcd34d', statusText: 'Time Almost Up',
  },
  red: {
    timerColor: '#f87171', glowColor: 'rgba(248,113,113,0.6)',
    bgGradient: 'radial-gradient(ellipse at center, #2a0a0a 0%, #000 75%)',
    labelColor: '#fca5a5', statusText: "Time\u2019s Up!",
  },
}

// Non-timer views use a neutral dark background
const PRESENT_BG = 'radial-gradient(ellipse at center, #0a0a14 0%, #000 75%)'
const PRESENT_GLOW  = 'rgba(96,165,250,0.45)'
const PRESENT_COLOR = '#93c5fd'

export default function BigScreen() {
  const [timerState,   setTimerState]   = useState<TimerState | null>(null)
  const [presentState, setPresentState] = useState<PresentState | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [blinkVisible, setBlinkVisible] = useState(true)
  const blinkRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initial load
  useEffect(() => {
    setTimerState(loadState())
    setPresentState(loadPresentState())
  }, [])

  // BroadcastChannel — live sync from control panel
  useEffect(() => {
    let timerBc:   BroadcastChannel | null = null
    let presentBc: BroadcastChannel | null = null
    try {
      timerBc = new BroadcastChannel(TIMER_CHANNEL_NAME)
      timerBc.onmessage = (e) => {
        if (e.data?.type === 'TIMER_UPDATE') setTimerState(e.data.state)
      }
      presentBc = new BroadcastChannel(PRESENT_CHANNEL_NAME)
      presentBc.onmessage = (e) => {
        if (e.data?.type === 'PRESENT_UPDATE') setPresentState(e.data.state)
      }
    } catch { /* unavailable */ }
    return () => { timerBc?.close(); presentBc?.close() }
  }, [])

  // Fallback poll
  useEffect(() => {
    const id = setInterval(() => {
      setTimerState(loadState())
      setPresentState(loadPresentState())
    }, 500)
    return () => clearInterval(id)
  }, [])

  // Blink at ≤ 50 seconds (timer mode only)
  useEffect(() => {
    const shouldBlink = timerState
      ? timerState.remaining <= BLINK_AT_SECS && presentState?.mode === 'timer'
      : false
    if (shouldBlink) {
      if (!blinkRef.current) {
        blinkRef.current = setInterval(() => setBlinkVisible(v => !v), 500)
      }
    } else {
      if (blinkRef.current) { clearInterval(blinkRef.current); blinkRef.current = null }
      setBlinkVisible(true)
    }
    return () => { if (blinkRef.current) { clearInterval(blinkRef.current); blinkRef.current = null } }
  }, [timerState?.remaining, presentState?.mode])

  // Fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Auto-fullscreen on load (for monitor mode)
  useEffect(() => {
    if (timerState && presentState && !document.fullscreenElement) {
      setTimeout(() => {
        document.documentElement.requestFullscreen().catch(() => {
          // Ignore if not allowed
        })
      }, 500) // Small delay to ensure render
    }
  }, [timerState, presentState])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  }

  if (!timerState || !presentState) return (
    <div style={{ width: '100vw', height: '100vh', background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#555', fontSize: 24, fontFamily: 'system-ui, sans-serif' }}>
      Waiting for timer…
    </div>
  )

  const mode         = presentState.mode
  const isTimerMode  = mode === 'timer'
  const isBlankMode  = mode === 'blank'

  // Timer-specific values
  const current      = timerState.activities[timerState.currentIndex]
  const color        = getTimerColor(timerState.remaining, current.duration * 60)
  const theme        = COLOR_THEMES[color]
  const pct          = Math.max(0, Math.min(100, (timerState.remaining / (current.duration * 60)) * 100))
  const hasNext      = timerState.currentIndex < timerState.activities.length - 1
  const statusText   = timerState.overtime ? 'OVERTIME' : theme.statusText
  const isCritical   = timerState.remaining <= BLINK_AT_SECS

  // Present-mode values
  const activeSong   = presentState.songs.find(s => s.id === presentState.activeSongId)
  const activeImage  = presentState.images.find(i => i.id === presentState.activeImageId)
  const activeNotice = presentState.notices.find(n => n.id === presentState.activeNoticeId)

  // Background + glow based on mode
  const bg        = isTimerMode ? theme.bgGradient : PRESENT_BG
  const glowColor = isTimerMode ? theme.glowColor  : PRESENT_GLOW
  const mainColor = isTimerMode ? theme.timerColor  : PRESENT_COLOR

  return (
    <>
      <style>{`
        @keyframes calm-pulse {
          0%,100% { text-shadow:0 0 60px rgba(34,197,94,.5),0 0 120px rgba(34,197,94,.3); }
          50%      { text-shadow:0 0 100px rgba(34,197,94,.9),0 0 200px rgba(34,197,94,.5); }
        }
        @keyframes warning-pulse {
          0%,100% { text-shadow:0 0 60px rgba(251,191,36,.5),0 0 120px rgba(251,191,36,.3);transform:scale(1); }
          50%     { text-shadow:0 0 120px rgba(251,191,36,1),0 0 240px rgba(251,191,36,.6);transform:scale(1.012); }
        }
        @keyframes critical-pulse {
          0%,100% { text-shadow:0 0 80px rgba(248,113,113,.6),0 0 160px rgba(248,113,113,.4);transform:scale(1); }
          25%     { text-shadow:0 0 140px rgba(248,113,113,1),0 0 280px rgba(248,113,113,.8);transform:scale(1.02); }
          75%     { text-shadow:0 0 100px rgba(248,113,113,.8),0 0 200px rgba(248,113,113,.5);transform:scale(.99); }
        }
        @keyframes bg-breathe { 0%,100%{opacity:1}50%{opacity:.85} }
        @keyframes bg-warn    { 0%,100%{opacity:1}50%{opacity:.7}  }
        @keyframes bg-flash   { 0%,100%{opacity:1}50%{opacity:.5}  }
        @keyframes bar-pulse  { 0%,100%{opacity:.7}50%{opacity:1}  }
        @keyframes label-fade { 0%,100%{opacity:.8}50%{opacity:1}  }
        @keyframes fade-in    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

        .timer-calm     { animation:calm-pulse     3s   ease-in-out infinite; }
        .timer-warning  { animation:warning-pulse  1.6s ease-in-out infinite; }
        .timer-critical { animation:critical-pulse .7s  ease-in-out infinite; }
        .bg-green  { animation:bg-breathe 4s  ease-in-out infinite; }
        .bg-yellow { animation:bg-warn    2s  ease-in-out infinite; }
        .bg-red    { animation:bg-flash   .7s ease-in-out infinite; }
        .bar-anim  { animation:bar-pulse  2s  ease-in-out infinite; }
        .label-anim{ animation:label-fade 2s  ease-in-out infinite; }
        .fade-in   { animation:fade-in    .5s ease-out both; }
      `}</style>

      <div style={{
        width: '100vw', height: '100vh',
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 1s ease',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}>
        {/* Grid overlay */}
        <div
          className={isTimerMode
            ? (color==='green'?'bg-green':color==='yellow'?'bg-yellow':'bg-red')
            : ''}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: [
              'linear-gradient(rgba(255,255,255,0.01) 1px,transparent 1px)',
              'linear-gradient(90deg,rgba(255,255,255,0.01) 1px,transparent 1px)',
            ].join(','),
            backgroundSize: '80px 80px',
          }}
        />

        {/* ── IMAGE MODE: fills whole screen behind header ── */}
        {mode === 'image' && activeImage && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <ImageView image={activeImage} />
          </div>
        )}

        {/* ── HEADER ── */}
        <header style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 32px',
          background: mode === 'image' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.45)',
          borderBottom: `1px solid ${mainColor}30`,
          zIndex: 10,
        }}>
          {/* Logo + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%', overflow: 'hidden',
              border: `2.5px solid ${mainColor}`,
              boxShadow: `0 0 20px ${glowColor}`,
              flexShrink: 0, position: 'relative',
            }}>
              <Image src="/church-logo.jpg" alt="Church Logo" fill
                style={{ objectFit: 'cover' }} priority />
            </div>
            <div>
              <p style={{
                fontFamily: 'var(--font-cinzel), serif',
                fontSize: 'clamp(16px, 2.2vw, 28px)', fontWeight: 600,
                color: '#ffffff', letterSpacing: '0.1em', textTransform: 'uppercase',
                textShadow: `0 0 24px ${glowColor}`, lineHeight: 1.1,
              }}>{CHURCH_NAME}</p>
              {isTimerMode && (
                <p style={{
                  fontSize: 'clamp(11px, 1.1vw, 14px)', color: '#fff',
                  letterSpacing: '0.22em', textTransform: 'uppercase',
                  fontWeight: 400, marginTop: 4, textShadow: `0 0 12px ${glowColor}`,
                }}>
                  Activity {timerState.currentIndex + 1} of {timerState.activities.length}
                </p>
              )}
            </div>
          </div>

          {/* Live/Paused top right */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 14, color: '#fff',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            textShadow: `0 0 10px ${glowColor}`,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
              background: timerState.running && isTimerMode ? '#22c55e' : '#aaa',
              boxShadow: timerState.running && isTimerMode ? '0 0 14px #22c55e' : 'none',
              transition: 'background 0.4s',
            }} />
            {isTimerMode
              ? (timerState.running ? 'Live' : 'Paused')
              : mode === 'blank' ? 'Standby'
              : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </div>
        </header>

        {/* ── MAIN CONTENT AREA ── */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isTimerMode ? '0 20px 48px' : '0',
          minHeight: 0,
          position: 'relative',
          zIndex: mode === 'image' ? 1 : 'auto',
        }}>

          {/* ── TIMER MODE ── */}
          {isTimerMode && (
            <>
              <p className="label-anim" style={{
                fontSize: 'clamp(14px, 2vw, 26px)', fontWeight: 500,
                color: '#fff', letterSpacing: '0.35em',
                textTransform: 'uppercase', margin: '0 0 8px',
                textShadow: `0 0 20px ${theme.glowColor}`,
              }}>
                {statusText}
              </p>

              <p
                className={
                  isCritical ? 'timer-critical'
                  : color === 'yellow' ? 'timer-warning'
                  : 'timer-calm'
                }
                style={{
                  fontFamily: 'var(--font-bebas), cursive',
                  fontSize: 'min(38vw, 38vh)',
                  lineHeight: 0.85,
                  color: blinkVisible ? theme.timerColor : 'transparent',
                  letterSpacing: '0.02em',
                  transition: isCritical ? 'none' : 'color 1s ease',
                  userSelect: 'none',
                  margin: 0,
                  textAlign: 'center',
                }}
              >
                {formatTime(timerState.remaining)}
              </p>

              <div style={{
                width: 180, height: 2,
                margin: 'min(2.5vw,2.5vh) 0',
                background: `linear-gradient(to right,transparent,${theme.timerColor},transparent)`,
                borderRadius: 1, opacity: 0.5, flexShrink: 0,
              }} />

              <p style={{
                fontFamily: 'var(--font-cinzel), serif',
                fontSize: 'min(6vw,6vh)', fontWeight: 600,
                color: '#fff', letterSpacing: '0.08em',
                textAlign: 'center',
                textShadow: `0 0 40px ${theme.glowColor}, 0 2px 8px rgba(0,0,0,0.9)`,
                lineHeight: 1.2, maxWidth: '85vw', margin: 0,
              }}>
                {current.name}
              </p>

              <p style={{
                marginTop: 'min(1.2vw,1.2vh)',
                fontSize: 'min(1.8vw,1.8vh)', fontWeight: 400,
                color: '#fff', letterSpacing: '0.22em',
                textTransform: 'uppercase', textAlign: 'center',
                textShadow: `0 0 12px ${theme.glowColor}`, opacity: 0.9,
              }}>
                {current.duration} minutes allocated
              </p>
            </>
          )}

          {/* ── BIBLE MODE ── */}
          {mode === 'bible' && presentState.activeVerse && (
            <div className="fade-in" style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <BibleView
                verse={presentState.activeVerse}
                glowColor={PRESENT_GLOW}
                timerColor={PRESENT_COLOR}
              />
            </div>
          )}

          {/* ── SONG MODE ── */}
          {mode === 'song' && activeSong && (
            <div className="fade-in" style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <SongView
                song={activeSong}
                lineIndex={presentState.activeLineIndex}
                glowColor={PRESENT_GLOW}
                timerColor={PRESENT_COLOR}
              />
            </div>
          )}

          {/* ── IMAGE MODE — overlay text if needed ── */}
          {mode === 'image' && activeImage && (
            <div className="fade-in" style={{ opacity: 0 }} />
          )}

          {/* ── NOTICE MODE ── */}
          {mode === 'notice' && activeNotice && (
            <div className="fade-in" style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <NoticeView
                notice={activeNotice}
                glowColor={PRESENT_GLOW}
                timerColor={PRESENT_COLOR}
              />
            </div>
          )}

          {/* ── BLANK MODE ── */}
          {isBlankMode && (
            <p style={{ color:'rgba(255,255,255,0.08)', fontSize:14, letterSpacing:'0.2em', textTransform:'uppercase' }}>
              Standby
            </p>
          )}
        </main>

        {/* ── TIMER: bottom progress bar ── */}
        {isTimerMode && (
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:8, background:'rgba(255,255,255,0.06)' }}>
            <div
              className="bar-anim"
              style={{
                height:'100%', width:`${pct}%`,
                background: theme.timerColor,
                boxShadow: `0 0 18px ${theme.glowColor}`,
                transition: 'width 0.9s linear, background 1s ease',
              }}
            />
          </div>
        )}

        {/* ── TIMER: next up ── */}
        {isTimerMode && hasNext && (
          <p style={{
            position:'absolute', bottom:22, left:0, right:0, textAlign:'center',
            fontSize:'clamp(12px,1.3vw,16px)', color:'#fff',
            letterSpacing:'0.16em', textTransform:'uppercase',
            textShadow:`0 0 10px ${theme.glowColor}`, opacity:0.9,
          }}>
            Next: {timerState.activities[timerState.currentIndex + 1].name}
          </p>
        )}

        {/* ── Fullscreen button ── */}
        <button onClick={toggleFullscreen} style={{
          position:'absolute', bottom:14, right:20,
          background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
          color:'#fff', padding:'6px 16px', borderRadius:6,
          fontSize:12, letterSpacing:'0.05em', cursor:'pointer', zIndex:20,
        }}>
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen ⛶'}
        </button>
      </div>
    </>
  )
}