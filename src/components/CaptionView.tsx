'use client'

import type { CaptionCue } from '@/types'

interface Props {
  caption: CaptionCue
  glowColor: string
  timerColor: string
}

export default function CaptionView({ caption, glowColor, timerColor }: Props) {
  const kindLabel = caption.kind === 'quote' ? 'Live Quote' : 'Key Point'

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(24px, 4vw, 84px)',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 'min(100%, 1200px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(18px, 2vw, 26px)',
        padding: 'clamp(28px, 3.8vw, 52px)',
        borderRadius: 28,
        border: `1px solid ${timerColor}30`,
        background: 'linear-gradient(180deg,rgba(7,12,24,0.92),rgba(3,8,18,0.96))',
        boxShadow: `0 0 0 1px ${timerColor}14, 0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 14px',
            borderRadius: 999,
            border: `1px solid ${timerColor}36`,
            background: `${timerColor}14`,
            color: timerColor,
            fontSize: 'clamp(11px, 1.1vw, 15px)',
            fontWeight: 800,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}>
            {kindLabel}
          </span>
          <span style={{
            color: 'rgba(255,255,255,0.42)',
            fontSize: 'clamp(12px, 1vw, 14px)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}>
            Sermon Caption
          </span>
        </div>

        <div style={{
          display: 'flex',
          gap: 'clamp(12px, 2vw, 20px)',
          alignItems: 'flex-start',
        }}>
          <span style={{
            color: timerColor,
            fontFamily: 'var(--font-cinzel), serif',
            fontSize: 'clamp(54px, 7vw, 110px)',
            lineHeight: 0.9,
            textShadow: `0 0 24px ${glowColor}`,
            flexShrink: 0,
          }}>
            &ldquo;
          </span>
          <p style={{
            margin: 0,
            color: '#f8fafc',
            fontFamily: 'var(--font-cinzel), serif',
            fontSize: 'clamp(26px, 4.2vw, 64px)',
            lineHeight: 1.22,
            letterSpacing: '0.02em',
            textShadow: `0 0 28px ${glowColor}, 0 2px 10px rgba(0,0,0,0.75)`,
          }}>
            {caption.text}
          </p>
        </div>

        {caption.sourceText && caption.sourceText !== caption.text ? (
          <p style={{
            margin: 0,
            color: 'rgba(226,232,240,0.76)',
            fontSize: 'clamp(13px, 1.2vw, 18px)',
            lineHeight: 1.7,
            letterSpacing: '0.03em',
          }}>
            Source: {caption.sourceText}
          </p>
        ) : null}
      </div>
    </div>
  )
}
