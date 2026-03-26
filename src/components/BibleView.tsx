'use client'

import { useLayoutEffect, useRef } from 'react'
import type { BibleVerse } from '@/types'

interface Props {
  verse: BibleVerse
  glowColor: string
  timerColor: string
}

const MIN_SCALE = 0.55

export default function BibleView({ verse, glowColor, timerColor }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const normalizedText = verse.text.replace(/\s+/g, ' ').trim()
  const wordCount = normalizedText ? normalizedText.split(' ').length : 0
  const textLength = normalizedText.length

  // ── Tier helpers ──────────────────────────────────────────────
  // Four tiers: XS (short) → XL (very long)
  const isXL = textLength > 420 || wordCount > 78
  const isLG = !isXL && (textLength > 320 || wordCount > 58)
  const isMD = !isXL && !isLG && (textLength > 220 || wordCount > 40)
  // else: SM (short verse)

  const showQuote   = !isXL && !isLG   // only for short verses
  const showDivider = !isXL            // hide divider on very long verses

  // Font sizes — smaller on long verses so they fit naturally
  const verseFontSize = isXL
    ? 'clamp(20px, 3vw, 36px)'
    : isLG
      ? 'clamp(23px, 3.6vw, 44px)'
      : isMD
        ? 'clamp(27px, 4.2vw, 52px)'
        : 'clamp(32px, 5vw, 64px)'

  const referenceFontSize = isXL || isLG
    ? 'clamp(12px, 1.2vw, 16px)'
    : 'clamp(13px, 1.5vw, 20px)'

  const quoteSize = isMD
    ? 'clamp(34px, 5vw, 66px)'
    : 'clamp(44px, 6.5vw, 84px)'

  // Line-height — tighter across the board to reduce vertical footprint
  const lineHeight = isXL ? 1.42 : isLG ? 1.48 : isMD ? 1.55 : 1.62

  // Gap between elements — reduced across all tiers
  const elementGap = isXL
    ? 'clamp(8px, 1.2vh, 14px)'
    : isLG
      ? 'clamp(10px, 1.6vh, 20px)'
      : isMD
        ? 'clamp(12px, 1.8vh, 24px)'
        : 'clamp(12px, 2vh, 28px)'

  // Container padding — tighter vertically across all tiers
  const padV = isXL
    ? 'clamp(10px, 1.4vh, 20px)'
    : isLG
      ? 'clamp(12px, 2vh, 26px)'
      : 'clamp(16px, 2.6vh, 36px)'
  const padH = isXL
    ? 'clamp(20px, 3vw, 48px)'
    : 'clamp(28px, 4.5vw, 72px)'

  // ── Auto-fit: calculate exact scale to fill container ─────────
  useLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    let frameId = 0
    let resizeObserver: ResizeObserver | null = null

    const fitContent = () => {
      frameId = window.requestAnimationFrame(() => {
        const c  = containerRef.current
        const ct = contentRef.current
        if (!c || !ct) return

        // Reset to natural size first
        ct.style.setProperty('--bible-scale', '1')

        const cRect  = c.getBoundingClientRect()
        const ctRect = ct.getBoundingClientRect()

        if (ctRect.height <= cRect.height && ctRect.width <= cRect.width) return

        // Compute exact ratio needed to fit both axes, with a tiny safety margin
        const scaleH = cRect.height / ctRect.height
        const scaleW = cRect.width  / ctRect.width
        const scale  = Math.max(MIN_SCALE, Math.min(scaleH, scaleW) * 0.97)
        ct.style.setProperty('--bible-scale', scale.toFixed(3))
      })
    }

    fitContent()

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (frameId) window.cancelAnimationFrame(frameId)
        fitContent()
      })
      resizeObserver.observe(container)
    } else {
      window.addEventListener('resize', fitContent)
    }

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', fitContent)
    }
  }, [verse.reference, verse.text])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${padV} ${padH}`,
        textAlign: 'center',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        ref={contentRef}
        style={{
          width: '100%',
          maxWidth: 'min(100%, 1680px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: elementGap,
          transform: 'scale(var(--bible-scale, 1))',
          transformOrigin: 'center center',
          transition: 'transform 160ms ease-out',
          willChange: 'transform',
        }}
      >
        {/* Opening quote — short verses only */}
        {showQuote && (
          <p
            style={{
              fontFamily: 'var(--font-cinzel), serif',
              fontSize: quoteSize,
              lineHeight: 0.7,
              color: timerColor,
              opacity: 0.22,
              margin: 0,
              userSelect: 'none',
            }}
          >
            &ldquo;
          </p>
        )}

        {/* Verse text */}
        <p
          style={{
            fontFamily: 'var(--font-cinzel), serif',
            fontSize: verseFontSize,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight,
            letterSpacing: '0.04em',
            wordSpacing: '0.06em',
            textShadow: `0 0 40px ${glowColor}, 0 2px 8px rgba(0,0,0,0.8)`,
            maxWidth: '100%',
            margin: 0,
            overflowWrap: 'break-word',
          }}
        >
          {verse.text}
        </p>

        {/* Divider */}
        {showDivider && (
          <div
            style={{
              width: 110,
              height: 2,
              background: `linear-gradient(to right, transparent, ${timerColor}, transparent)`,
              borderRadius: 1,
              opacity: 0.7,
              flexShrink: 0,
            }}
          />
        )}

        {/* Reference */}
        <p
          style={{
            fontFamily: 'var(--font-cinzel), serif',
            fontSize: referenceFontSize,
            fontWeight: 600,
            color: timerColor,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            textShadow: `0 0 20px ${glowColor}`,
            margin: 0,
          }}
        >
          {verse.reference}
        </p>
      </div>
    </div>
  )
}