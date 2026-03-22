'use client'

import type { Notice } from '@/types'

interface Props {
  notice: Notice
  glowColor: string
  timerColor: string
}

const STYLE_CONFIG = {
  default:     { icon: '✦',  accent: '#60a5fa' },
  urgent:      { icon: '⚠',  accent: '#f87171' },
  celebration: { icon: '✦',  accent: '#fbbf24' },
}

export default function NoticeView({ notice, glowColor, timerColor }: Props) {
  const cfg = STYLE_CONFIG[notice.style] ?? STYLE_CONFIG.default
  const color = notice.style === 'default' ? timerColor : cfg.accent

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 100px',
      textAlign: 'center',
    }}>

      {/* Icon */}
      <p style={{
        fontSize: 'clamp(32px, 5vw, 64px)',
        color,
        textShadow: `0 0 30px ${glowColor}`,
        marginBottom: 20,
        lineHeight: 1,
      }}>
        {cfg.icon}
      </p>

      {/* Title */}
      <p style={{
        fontFamily: 'var(--font-cinzel), serif',
        fontSize: 'clamp(28px, 5vw, 64px)',
        fontWeight: 700,
        color: '#ffffff',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        textShadow: `0 0 30px ${glowColor}, 0 2px 8px rgba(0,0,0,0.8)`,
        lineHeight: 1.2,
        marginBottom: 24,
      }}>
        {notice.title}
      </p>

      {/* Divider */}
      <div style={{
        width: 100,
        height: 2,
        background: `linear-gradient(to right, transparent, ${color}, transparent)`,
        marginBottom: 28,
        opacity: 0.8,
      }} />

      {/* Body */}
      <p style={{
        fontFamily: 'var(--font-inter), sans-serif',
        fontSize: 'clamp(16px, 2.8vw, 38px)',
        fontWeight: 300,
        color: 'rgba(255,255,255,0.9)',
        lineHeight: 1.65,
        letterSpacing: '0.02em',
        whiteSpace: 'pre-line',
        maxWidth: '75vw',
        textShadow: '0 2px 8px rgba(0,0,0,0.6)',
      }}>
        {notice.body}
      </p>
    </div>
  )
}