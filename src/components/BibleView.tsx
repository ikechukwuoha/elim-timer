'use client'

import { useLayoutEffect, useRef } from 'react'
import type { BibleBackground, BibleDisplayMode, BibleVerse } from '@/types'

interface Props {
  verse: BibleVerse
  secondaryVerse?: BibleVerse | null
  displayMode?: BibleDisplayMode
  glowColor: string
  timerColor: string
  background?: BibleBackground | null
  textColor?: string
  fontFamily?: string
  fontScale?: number
}

interface BiblePaneProps {
  verse: BibleVerse
  glowColor: string
  timerColor: string
  background?: BibleBackground | null
  textColor?: string
  fontFamily?: string
  fontScale?: number
  compact?: boolean
}

const MIN_SCALE = 0.5

function hexToRgba(color: string, alpha: number): string {
  const value = color.trim().replace('#', '')
  const normalized = value.length === 3
    ? value.split('').map(part => `${part}${part}`).join('')
    : value

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(255,255,255,${alpha})`

  const red = parseInt(normalized.slice(0, 2), 16)
  const green = parseInt(normalized.slice(2, 4), 16)
  const blue = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red},${green},${blue},${alpha})`
}

function isDarkHexColor(color: string): boolean {
  const value = color.trim().replace('#', '')
  const normalized = value.length === 3
    ? value.split('').map(part => `${part}${part}`).join('')
    : value

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return false

  const red = parseInt(normalized.slice(0, 2), 16)
  const green = parseInt(normalized.slice(2, 4), 16)
  const blue = parseInt(normalized.slice(4, 6), 16)
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000
  return luminance < 110
}

function scaleCssClamp(value: string, factor: number): string {
  return value.replace(/(-?\d*\.?\d+)(px|vw|vh)/g, (_, numeric, unit) => {
    const scaled = Number.parseFloat(numeric) * factor
    return `${Number(scaled.toFixed(3))}${unit}`
  })
}

function BiblePane({
  verse,
  glowColor,
  timerColor,
  background = null,
  textColor,
  fontFamily,
  fontScale = 100,
  compact = false,
}: BiblePaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const normalizedText = verse.text.replace(/\s+/g, ' ').trim()
  const wordCount = normalizedText ? normalizedText.split(' ').length : 0
  const textLength = normalizedText.length

  const compactWeight = compact ? 1.18 : 1
  const isXL = textLength > 420 / compactWeight || wordCount > 78 / compactWeight
  const isLG = !isXL && (textLength > 320 / compactWeight || wordCount > 58 / compactWeight)
  const isMD = !isXL && !isLG && (textLength > 220 / compactWeight || wordCount > 40 / compactWeight)

  const showQuote = !isXL && !isLG
  const showDivider = !isXL

  const verseFontSize = compact
    ? isXL
      ? 'clamp(21px, 2.2vw, 34px)'
      : isLG
        ? 'clamp(24px, 2.55vw, 38px)'
        : isMD
          ? 'clamp(27px, 2.95vw, 43px)'
          : 'clamp(30px, 3.35vw, 47px)'
    : isXL
      ? 'clamp(25px, 3.55vw, 42px)'
      : isLG
        ? 'clamp(29px, 4.25vw, 50px)'
        : isMD
          ? 'clamp(34px, 4.95vw, 60px)'
          : 'clamp(40px, 5.9vw, 76px)'

  const referenceFontSize = compact
    ? 'clamp(24px, 2.2vw, 34px)'
    : isXL || isLG
      ? 'clamp(26px, 2.7vw, 38px)'
      : 'clamp(30px, 3.4vw, 48px)'
  const quoteSize = compact
    ? isMD
      ? 'clamp(24px, 3vw, 42px)'
      : 'clamp(30px, 3.8vw, 52px)'
    : isMD
      ? 'clamp(34px, 5vw, 66px)'
      : 'clamp(44px, 6.5vw, 84px)'

  const lineHeight = compact
    ? isXL ? 1.28 : isLG ? 1.34 : isMD ? 1.4 : 1.46
    : isXL ? 1.34 : isLG ? 1.42 : isMD ? 1.48 : 1.56

  const elementGap = compact
    ? isXL
      ? 'clamp(7px, 1vh, 12px)'
      : 'clamp(9px, 1.2vh, 16px)'
    : isXL
      ? 'clamp(8px, 1.2vh, 14px)'
      : isLG
        ? 'clamp(10px, 1.6vh, 20px)'
        : isMD
          ? 'clamp(12px, 1.8vh, 24px)'
          : 'clamp(12px, 2vh, 28px)'

  const padV = compact
    ? 'clamp(12px, 1.8vh, 24px)'
    : isXL
      ? 'clamp(10px, 1.4vh, 20px)'
      : isLG
        ? 'clamp(12px, 2vh, 26px)'
        : 'clamp(16px, 2.6vh, 36px)'

  const padH = compact ? 'clamp(16px, 2vw, 28px)' : isXL ? 'clamp(20px, 3vw, 48px)' : 'clamp(28px, 4.5vw, 72px)'
  const fontScaleFactor = Math.max(0.85, Math.min(1.5, fontScale / 100))
  const effectiveFontFamily = fontFamily || 'var(--font-cinzel), serif'
  const scaledVerseFontSize = scaleCssClamp(verseFontSize, fontScaleFactor)
  const scaledReferenceFontSize = scaleCssClamp(referenceFontSize, fontScaleFactor)
  const scaledQuoteSize = scaleCssClamp(quoteSize, fontScaleFactor)
  const effectiveTextColor = textColor || timerColor || '#ffffff'
  const darkText = isDarkHexColor(effectiveTextColor)
  const verseGlowColor = darkText ? 'rgba(255,255,255,0.38)' : glowColor || hexToRgba(effectiveTextColor, 0.34)
  const referenceGlowColor = darkText ? 'rgba(255,255,255,0.3)' : glowColor || hexToRgba(effectiveTextColor, 0.26)
  const verseShadow = darkText
    ? '0 0 18px rgba(255,255,255,0.45), 0 2px 10px rgba(255,255,255,0.24)'
    : `0 0 54px ${verseGlowColor}, 0 3px 10px rgba(0,0,0,0.86)`
  const referenceShadow = darkText
    ? '0 0 14px rgba(255,255,255,0.42), 0 2px 8px rgba(255,255,255,0.22)'
    : `0 0 24px ${referenceGlowColor}, 0 2px 8px rgba(0,0,0,0.82)`
  const backgroundColor = background?.kind === 'solid' && background.value ? background.value : '#000000'
  const backgroundImage = background?.kind === 'image' && background.value ? `url("${background.value}")` : null
  const backgroundOverlay = backgroundImage
    ? darkText
      ? 'linear-gradient(rgba(255,255,255,0.64), rgba(255,255,255,0.46))'
      : 'linear-gradient(rgba(2,6,23,0.38), rgba(2,6,23,0.6))'
    : 'transparent'

  useLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    let frameId = 0
    let resizeObserver: ResizeObserver | null = null

    const fitContent = () => {
      frameId = window.requestAnimationFrame(() => {
        const currentContainer = containerRef.current
        const currentContent = contentRef.current
        if (!currentContainer || !currentContent) return

        currentContent.style.setProperty('--bible-scale', '1')

        const containerRect = currentContainer.getBoundingClientRect()
        const contentRect = currentContent.getBoundingClientRect()

        if (contentRect.height <= containerRect.height && contentRect.width <= containerRect.width) return

        const scaleH = containerRect.height / contentRect.height
        const scaleW = containerRect.width / contentRect.width
        const scale = Math.max(MIN_SCALE, Math.min(scaleH, scaleW) * 0.97)
        currentContent.style.setProperty('--bible-scale', scale.toFixed(3))
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
  }, [compact, fontFamily, fontScale, verse.reference, verse.text, verse.translation])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: backgroundColor,
      }}
    >
      {backgroundImage && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            transform: compact ? 'scale(1.02)' : 'scale(1.01)',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: backgroundOverlay,
        }}
      />

      <div
        ref={containerRef}
        style={{
          position: 'relative',
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
            maxWidth: compact ? 'min(100%, 860px)' : 'min(100%, 1680px)',
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
          {showQuote && (
            <p
              style={{
                fontFamily: effectiveFontFamily,
                fontSize: scaledQuoteSize,
                lineHeight: 0.7,
                color: effectiveTextColor,
                opacity: 0.22,
                margin: 0,
                userSelect: 'none',
              }}
            >
              &ldquo;
            </p>
          )}

          <p
            style={{
              fontFamily: effectiveFontFamily,
              fontSize: scaledVerseFontSize,
              fontWeight: 900,
              color: effectiveTextColor,
              lineHeight,
              letterSpacing: compact ? '0.02em' : '0.03em',
              wordSpacing: compact ? '0.04em' : '0.06em',
              textShadow: verseShadow,
              maxWidth: '100%',
              margin: 0,
              overflowWrap: 'break-word',
              WebkitTextStroke: darkText ? '0.4px rgba(255,255,255,0.16)' : undefined,
            }}
          >
            {verse.text}
          </p>

          {showDivider && (
            <div
              style={{
                width: compact ? 88 : 110,
                height: 2,
                background: `linear-gradient(to right, transparent, ${effectiveTextColor}, transparent)`,
                borderRadius: 1,
                opacity: 0.7,
                flexShrink: 0,
              }}
            />
          )}

          <p
            style={{
              fontFamily: effectiveFontFamily,
              fontSize: scaledReferenceFontSize,
              fontWeight: 900,
              color: effectiveTextColor,
              letterSpacing: compact ? '0.08em' : '0.1em',
              lineHeight: 1.1,
              textTransform: 'uppercase',
              textShadow: referenceShadow,
              margin: 0,
            }}
          >
            {verse.reference}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function BibleView({
  verse,
  secondaryVerse = null,
  displayMode = 'single',
  glowColor,
  timerColor,
  background = null,
  textColor,
  fontFamily,
  fontScale,
}: Props) {
  const showDouble = displayMode === 'double' && secondaryVerse != null

  if (!showDouble) {
    return (
      <BiblePane
        verse={verse}
        glowColor={glowColor}
        timerColor={timerColor}
        background={background}
        textColor={textColor}
        fontFamily={fontFamily}
        fontScale={fontScale}
      />
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 'clamp(12px, 1.6vw, 24px)',
        padding: 'clamp(10px, 1.4vh, 20px)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          borderRadius: 20,
          border: `1px solid ${timerColor}24`,
          background: 'linear-gradient(180deg,rgba(9,15,30,0.92),rgba(6,10,22,0.88))',
          boxShadow: `0 0 0 1px ${timerColor}12, 0 16px 44px rgba(0,0,0,0.32)`,
          overflow: 'hidden',
        }}
      >
        <BiblePane
          verse={verse}
          glowColor={glowColor}
          timerColor={timerColor}
          background={background}
          textColor={textColor}
          fontFamily={fontFamily}
          fontScale={fontScale}
          compact
        />
      </div>

      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          borderRadius: 20,
          border: `1px solid ${timerColor}24`,
          background: 'linear-gradient(180deg,rgba(9,15,30,0.92),rgba(6,10,22,0.88))',
          boxShadow: `0 0 0 1px ${timerColor}12, 0 16px 44px rgba(0,0,0,0.32)`,
          overflow: 'hidden',
        }}
      >
        <BiblePane
          verse={secondaryVerse}
          glowColor={glowColor}
          timerColor={timerColor}
          background={background}
          textColor={textColor}
          fontFamily={fontFamily}
          fontScale={fontScale}
          compact
        />
      </div>
    </div>
  )
}
