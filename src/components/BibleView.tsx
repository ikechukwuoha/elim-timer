'use client'

import type { BibleVerse } from '@/types'

interface Props {
  verse: BibleVerse
  glowColor: string
  timerColor: string
}

export default function BibleView({ verse, glowColor, timerColor }: Props) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 80px',
      textAlign: 'center',
      gap: 0,
    }}>
      {/* Decorative quote mark */}
      <p style={{
        fontFamily: 'var(--font-cinzel), serif',
        fontSize: 'clamp(60px, 10vw, 120px)',
        lineHeight: 0.7,
        color: timerColor,
        opacity: 0.25,
        marginBottom: 16,
        userSelect: 'none',
      }}>
        &ldquo;
      </p>

      {/* Verse text */}
      <p style={{
        fontFamily: 'var(--font-cinzel), serif',
        fontSize: 'clamp(22px, 4vw, 52px)',
        fontWeight: 700,
        color: '#ffffff',
        lineHeight: 1.55,
        letterSpacing: '0.03em',
        textShadow: `0 0 40px ${glowColor}, 0 2px 8px rgba(0,0,0,0.8)`,
        maxWidth: '85vw',
        margin: 0,
      }}>
        {verse.text}
      </p>

      {/* Divider */}
      <div style={{
        width: 120,
        height: 2,
        margin: '32px auto 24px',
        background: `linear-gradient(to right, transparent, ${timerColor}, transparent)`,
        borderRadius: 1,
        opacity: 0.7,
      }} />

      {/* Reference */}
      <p style={{
        fontFamily: 'var(--font-cinzel), serif',
        fontSize: 'clamp(14px, 2vw, 26px)',
        fontWeight: 600,
        color: timerColor,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        textShadow: `0 0 20px ${glowColor}`,
        margin: 0,
      }}>
        {verse.reference}
      </p>
    </div>
  )
}