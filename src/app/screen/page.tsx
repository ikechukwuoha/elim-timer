'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { TimerState, TimerColor, PresentState } from '@/types'
import {
  loadState, TIMER_CHANNEL_NAME,
  getTimerColor, formatTime, computeRemaining,
} from '@/utils/timerStore'
import { loadPresentState, PRESENT_CHANNEL_NAME } from '@/utils/presentStore'
import BibleView  from '@/components/BibleView'
import SongView   from '@/components/SongView'
import NoticeView from '@/components/NoticeView'
import ImageView  from '@/components/ImageView'

const CHURCH_NAME   = 'Elim Christian Garden International'
const BLINK_AT_SECS = 50

const PUSHER_KEY     = process.env.NEXT_PUBLIC_PUSHER_KEY     ?? ''
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? ''

type ColorTheme = {
  timerColor: string; glowColor: string
  bgGradient: string; labelColor: string; statusText: string
}
const COLOR_THEMES: Record<TimerColor, ColorTheme> = {
  green:  { timerColor:'#22c55e', glowColor:'rgba(34,197,94,0.5)',   bgGradient:'radial-gradient(ellipse at center,#052e16 0%,#000 75%)', labelColor:'#4ade80', statusText:'Time Remaining' },
  yellow: { timerColor:'#fbbf24', glowColor:'rgba(251,191,36,0.5)',  bgGradient:'radial-gradient(ellipse at center,#2d1f00 0%,#000 75%)', labelColor:'#fcd34d', statusText:'Time Almost Up' },
  red:    { timerColor:'#f87171', glowColor:'rgba(248,113,113,0.6)', bgGradient:'radial-gradient(ellipse at center,#2a0a0a 0%,#000 75%)', labelColor:'#fca5a5', statusText:"Time\u2019s Up!" },
}
const PRESENT_BG='radial-gradient(ellipse at center,#0a0a14 0%,#000 75%)'
const PRESENT_GLOW='rgba(96,165,250,0.45)'
const PRESENT_COLOR='#93c5fd'

export default function BigScreen() {
  const [timerState,   setTimerState]   = useState<TimerState | null>(null)
  const [presentState, setPresentState] = useState<PresentState | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [blinkVisible, setBlinkVisible] = useState(true)
  const [connected,    setConnected]    = useState(false)

  // displayRemaining is what we render — computed fresh from epoch anchor every RAF
  const [displayRemaining, setDisplayRemaining] = useState<number>(0)

  // Keep a ref to timerState so the RAF callback always sees the latest value
  const timerStateRef = useRef<TimerState | null>(null)
  const rafRef        = useRef<number | null>(null)
  const blinkRef      = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Initial load ─────────────────────────────────────────
  useEffect(() => {
    const ts = loadState()
    timerStateRef.current = ts
    setTimerState(ts)
    setDisplayRemaining(Math.floor(computeRemaining(ts)))
    setPresentState(loadPresentState())
  }, [])

  // ── RAF display loop ──────────────────────────────────────
  // Runs continuously. When running, recomputes remaining from epoch anchor
  // every frame and updates display only when the integer second changes.
  // When paused, shows the frozen remaining with no recomputation needed.
  useEffect(() => {
    let lastShown: number | null = null

    const tick = () => {
      const ts = timerStateRef.current
      if (ts) {
        const exact = computeRemaining(ts)
        const floored = Math.floor(exact)
        if (floored !== lastShown) {
          lastShown = floored
          setDisplayRemaining(floored)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, []) // runs once, reads timerStateRef on every frame

  // ── Apply incoming update (Pusher or BroadcastChannel) ───
  const applyUpdate = (incoming: Partial<TimerState>) => {
    setTimerState(prev => {
      const base = prev ?? loadState()
      const merged: TimerState = {
        ...base,
        ...incoming,
        activities: (incoming.activities && incoming.activities.length > 0)
          ? incoming.activities
          : base.activities,
      }
      // Keep ref in sync so RAF always has fresh data
      timerStateRef.current = merged
      localStorage.setItem('elim_timer_state', JSON.stringify(merged))
      return merged
    })
  }

  // ── PUSHER ────────────────────────────────────────────────
  useEffect(() => {
    if (!PUSHER_KEY || !PUSHER_CLUSTER) {
      console.warn('Pusher keys missing')
      return
    }
    let pusher: import('pusher-js').default | null = null

    import('pusher-js').then(({ default: Pusher }) => {
      pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER })
      const ch = pusher.subscribe('elim-church')

      ch.bind('pusher:subscription_succeeded', () => setConnected(true))
      ch.bind('pusher:subscription_error',     () => setConnected(false))

      ch.bind('TIMER_UPDATE',   (data: Partial<TimerState>)   => applyUpdate(data))
      ch.bind('PRESENT_UPDATE', (data: Partial<PresentState>) => {
        setPresentState(prev => {
          const base = prev ?? loadPresentState()
          const merged: PresentState = {
            ...base,
            ...data,
            images: (data.images ?? []).map(slim => {
              const local = base.images?.find(l => l.id === slim.id)
              return local ?? slim
            }),
          }
          localStorage.setItem('elim_present_state', JSON.stringify(merged))
          return merged
        })
      })
    })

    return () => { pusher?.unsubscribe('elim-church'); pusher?.disconnect(); setConnected(false) }
  }, [])

  // ── BroadcastChannel — same-device fallback ───────────────
  useEffect(() => {
    let tbc: BroadcastChannel | null = null
    let pbc: BroadcastChannel | null = null
    try {
      tbc = new BroadcastChannel(TIMER_CHANNEL_NAME)
      tbc.onmessage = (e) => {
        if (e.data?.type === 'TIMER_UPDATE') applyUpdate(e.data.state)
      }
      pbc = new BroadcastChannel(PRESENT_CHANNEL_NAME)
      pbc.onmessage = (e) => {
        if (e.data?.type === 'PRESENT_UPDATE') setPresentState(e.data.state)
      }
    } catch { /* unavailable */ }
    return () => { tbc?.close(); pbc?.close() }
  }, [])

  // ── NO localStorage poll — intentionally absent ───────────
  // On a remote device localStorage only updates when Pusher fires.
  // Polling it caused the jumpy countdown. The RAF loop + epoch anchor
  // means we never need to poll anything.

  // ── Blink at ≤ 50s ────────────────────────────────────────
  useEffect(() => {
    const should = displayRemaining <= BLINK_AT_SECS && presentState?.mode === 'timer'
    if (should) {
      if (!blinkRef.current) blinkRef.current = setInterval(() => setBlinkVisible(v => !v), 500)
    } else {
      if (blinkRef.current) { clearInterval(blinkRef.current); blinkRef.current = null }
      setBlinkVisible(true)
    }
    return () => { if (blinkRef.current) { clearInterval(blinkRef.current); blinkRef.current = null } }
  }, [displayRemaining, presentState?.mode])

  // ── Fullscreen ────────────────────────────────────────────
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  }

  // ── Guard ─────────────────────────────────────────────────
  if (!timerState || !presentState) {
    return (
      <div style={{ width:'100vw', height:'100vh', background:'#000', display:'flex',
        flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20 }}>
        <div style={{ width:48, height:48, border:'4px solid #1a1a1a', borderTopColor:'#22c55e',
          borderRadius:'50%', animation:'spin 1s linear infinite' }} />
        <p style={{ color:'#555', fontSize:14, fontFamily:'system-ui,sans-serif',
          letterSpacing:'0.1em', textTransform:'uppercase' }}>Connecting…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const mode      = presentState.mode
  const isTm      = mode === 'timer'
  const isBlank   = mode === 'blank'
  const idx       = Math.min(timerState.currentIndex, timerState.activities.length - 1)
  const current   = timerState.activities[idx]
  const color     = getTimerColor(displayRemaining, current.duration * 60)
  const theme     = COLOR_THEMES[color]
  const pct       = Math.max(0, Math.min(100, (displayRemaining / (current.duration * 60)) * 100))
  const hasNext   = idx < timerState.activities.length - 1
  const isOvertime   = displayRemaining < 0
  const statusTxt    = isOvertime ? 'OVERTIME' : theme.statusText
  const isCrit       = displayRemaining <= BLINK_AT_SECS
  const activeSong   = presentState.songs?.find(s => s.id === presentState.activeSongId)
  const activeImage  = presentState.images?.find(i => i.id === presentState.activeImageId)
  const activeNotice = presentState.notices?.find(n => n.id === presentState.activeNoticeId)
  const bg        = isTm ? theme.bgGradient : PRESENT_BG
  const glowColor = isTm ? theme.glowColor  : PRESENT_GLOW
  const mainColor = isTm ? theme.timerColor  : PRESENT_COLOR

  return (
    <>
      <style>{`
        @keyframes calm-pulse{0%,100%{text-shadow:0 0 60px rgba(34,197,94,.5),0 0 120px rgba(34,197,94,.3)}50%{text-shadow:0 0 100px rgba(34,197,94,.9),0 0 200px rgba(34,197,94,.5)}}
        @keyframes warn-pulse{0%,100%{text-shadow:0 0 60px rgba(251,191,36,.5),0 0 120px rgba(251,191,36,.3);transform:scale(1)}50%{text-shadow:0 0 120px rgba(251,191,36,1),0 0 240px rgba(251,191,36,.6);transform:scale(1.012)}}
        @keyframes crit-pulse{0%,100%{text-shadow:0 0 80px rgba(248,113,113,.6),0 0 160px rgba(248,113,113,.4);transform:scale(1)}25%{text-shadow:0 0 140px rgba(248,113,113,1),0 0 280px rgba(248,113,113,.8);transform:scale(1.02)}75%{text-shadow:0 0 100px rgba(248,113,113,.8),0 0 200px rgba(248,113,113,.5);transform:scale(.99)}}
        @keyframes bg-breathe{0%,100%{opacity:1}50%{opacity:.85}}
        @keyframes bg-warn{0%,100%{opacity:1}50%{opacity:.7}}
        @keyframes bg-flash{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes bar-p{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes lbl-p{0%,100%{opacity:.8}50%{opacity:1}}
        @keyframes fade-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .tc{animation:calm-pulse 3s ease-in-out infinite}
        .tw{animation:warn-pulse 1.6s ease-in-out infinite}
        .tx{animation:crit-pulse .7s ease-in-out infinite}
        .bg-g{animation:bg-breathe 4s ease-in-out infinite}
        .bg-y{animation:bg-warn 2s ease-in-out infinite}
        .bg-r{animation:bg-flash .7s ease-in-out infinite}
        .bp{animation:bar-p 2s ease-in-out infinite}
        .lp{animation:lbl-p 2s ease-in-out infinite}
        .fi{animation:fade-in .5s ease-out both}
      `}</style>

      <div style={{ width:'100vw', height:'100vh', background:bg, display:'flex',
        flexDirection:'column', position:'relative', overflow:'hidden',
        transition:'background 1s ease', fontFamily:'var(--font-inter),system-ui,sans-serif' }}>

        <div className={isTm?(color==='green'?'bg-g':color==='yellow'?'bg-y':'bg-r'):''}
          style={{ position:'absolute', inset:0, pointerEvents:'none',
            backgroundImage:'linear-gradient(rgba(255,255,255,0.01) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.01) 1px,transparent 1px)',
            backgroundSize:'80px 80px' }} />

        {mode==='image' && activeImage && (
          <div style={{ position:'absolute', inset:0, zIndex:0 }}><ImageView image={activeImage} /></div>
        )}

        <header style={{ flexShrink:0, display:'flex', alignItems:'center',
          justifyContent:'space-between', padding:'14px 32px',
          background:mode==='image'?'rgba(0,0,0,0.55)':'rgba(0,0,0,0.45)',
          borderBottom:`1px solid ${mainColor}30`, zIndex:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:18 }}>
            <div style={{ width:68, height:68, borderRadius:'50%', overflow:'hidden',
              border:`2.5px solid ${mainColor}`, boxShadow:`0 0 20px ${glowColor}`,
              flexShrink:0, position:'relative' }}>
              <Image src="/church-logo.jpg" alt="Logo" fill style={{ objectFit:'cover' }} priority />
            </div>
            <div>
              <p style={{ fontFamily:'var(--font-cinzel),serif', fontSize:'clamp(16px,2.2vw,28px)',
                fontWeight:600, color:'#fff', letterSpacing:'0.1em', textTransform:'uppercase',
                textShadow:`0 0 24px ${glowColor}`, lineHeight:1.1 }}>{CHURCH_NAME}</p>
              {isTm && <p style={{ fontSize:'clamp(11px,1.1vw,14px)', color:'#fff',
                letterSpacing:'0.22em', textTransform:'uppercase',
                fontWeight:400, marginTop:4, textShadow:`0 0 12px ${glowColor}` }}>
                Activity {idx+1} of {timerState.activities.length}
              </p>}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11,
              color:'rgba(255,255,255,0.4)', letterSpacing:'0.1em', textTransform:'uppercase' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', display:'inline-block',
                background:connected?'#22c55e':'#f59e0b',
                boxShadow:connected?'0 0 8px #22c55e':'0 0 8px #f59e0b' }} />
              {connected?'Online':PUSHER_KEY?'Connecting…':'Local only'}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, color:'#fff',
              letterSpacing:'0.14em', textTransform:'uppercase', textShadow:`0 0 10px ${glowColor}` }}>
              <span style={{ width:10, height:10, borderRadius:'50%', display:'inline-block',
                background:timerState.running&&isTm?'#22c55e':'#aaa',
                boxShadow:timerState.running&&isTm?'0 0 14px #22c55e':'none', transition:'background 0.4s' }} />
              {isTm?(timerState.running?'Live':'Paused'):isBlank?'Standby':mode.charAt(0).toUpperCase()+mode.slice(1)}
            </div>
          </div>
        </header>

        <main style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', padding:isTm?'0 20px 48px':'0', minHeight:0,
          position:'relative', zIndex:mode==='image'?1:'auto' }}>

          {isTm && <>
            <p className="lp" style={{ fontSize:'clamp(14px,2vw,26px)', fontWeight:500,
              color:'#fff', letterSpacing:'0.35em', textTransform:'uppercase',
              margin:'0 0 8px', textShadow:`0 0 20px ${theme.glowColor}` }}>{statusTxt}</p>
            <p className={isCrit?'tx':color==='yellow'?'tw':'tc'}
              style={{ fontFamily:'var(--font-bebas),cursive', fontSize:'min(38vw,38vh)',
                lineHeight:0.85, color:blinkVisible?theme.timerColor:'transparent',
                letterSpacing:'0.02em', transition:isCrit?'none':'color 1s ease',
                userSelect:'none', margin:0, textAlign:'center' }}>
              {formatTime(displayRemaining)}
            </p>
            <div style={{ width:180, height:2, margin:'min(2.5vw,2.5vh) 0',
              background:`linear-gradient(to right,transparent,${theme.timerColor},transparent)`,
              borderRadius:1, opacity:0.5, flexShrink:0 }} />
            <p style={{ fontFamily:'var(--font-cinzel),serif', fontSize:'min(6vw,6vh)',
              fontWeight:600, color:'#fff', letterSpacing:'0.08em', textAlign:'center',
              textShadow:`0 0 40px ${theme.glowColor},0 2px 8px rgba(0,0,0,0.9)`,
              lineHeight:1.2, maxWidth:'85vw', margin:0 }}>{current.name}</p>
            <p style={{ marginTop:'min(1.2vw,1.2vh)', fontSize:'min(1.8vw,1.8vh)', fontWeight:400,
              color:'#fff', letterSpacing:'0.22em', textTransform:'uppercase',
              textShadow:`0 0 12px ${theme.glowColor}`, opacity:0.9, textAlign:'center' }}>
              {current.duration} minutes allocated
            </p>
          </>}

          {mode==='bible'&&presentState.activeVerse&&(
            <div className="fi" style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <BibleView verse={presentState.activeVerse} glowColor={PRESENT_GLOW} timerColor={PRESENT_COLOR}/>
            </div>)}
          {mode==='song'&&activeSong&&(
            <div className="fi" style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <SongView song={activeSong} lineIndex={presentState.activeLineIndex} glowColor={PRESENT_GLOW} timerColor={PRESENT_COLOR}/>
            </div>)}
          {mode==='notice'&&activeNotice&&(
            <div className="fi" style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <NoticeView notice={activeNotice} glowColor={PRESENT_GLOW} timerColor={PRESENT_COLOR}/>
            </div>)}
          {isBlank&&<p style={{ color:'rgba(255,255,255,0.06)',fontSize:14,letterSpacing:'0.2em',textTransform:'uppercase' }}>Standby</p>}
        </main>

        {isTm&&(
          <div style={{ position:'absolute',bottom:0,left:0,right:0,height:8,background:'rgba(255,255,255,0.06)' }}>
            <div className="bp" style={{ height:'100%',width:`${pct}%`,background:theme.timerColor,
              boxShadow:`0 0 18px ${theme.glowColor}`,transition:'width 0.9s linear,background 1s ease' }}/>
          </div>)}
        {isTm&&hasNext&&(
          <p style={{ position:'absolute',bottom:22,left:0,right:0,textAlign:'center',
            fontSize:'clamp(12px,1.3vw,16px)',color:'#fff',letterSpacing:'0.16em',
            textTransform:'uppercase',textShadow:`0 0 10px ${theme.glowColor}`,opacity:0.9 }}>
            Next: {timerState.activities[idx+1].name}
          </p>)}
        <button onClick={toggleFullscreen} style={{ position:'absolute',bottom:14,right:20,
          background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',
          color:'#fff',padding:'6px 16px',borderRadius:6,fontSize:12,cursor:'pointer',zIndex:20 }}>
          {isFullscreen?'Exit Fullscreen':'Fullscreen ⛶'}
        </button>
      </div>
    </>
  )
}