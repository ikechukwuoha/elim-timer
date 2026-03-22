'use client'

import type { Song } from '@/types'

interface Props {
  song: Song
  lineIndex: number
  glowColor: string
  timerColor: string
}

export default function SongView({ song, lineIndex, glowColor, timerColor }: Props) {
  const prev = lineIndex > 0 ? song.lines[lineIndex - 1] : null
  const curr = song.lines[lineIndex]
  const next = lineIndex < song.lines.length - 1 ? song.lines[lineIndex + 1] : null

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

      {/* Song title top */}
      <p style={{
        position: 'absolute',
        top: 110,
        left: 0, right: 0,
        textAlign: 'center',
        fontFamily: 'var(--font-inter), sans-serif',
        fontSize: 'clamp(11px, 1.2vw, 16px)',
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
      }}>
        {song.title}{song.artist ? ` — ${song.artist}` : ''}
      </p>

      {/* Previous line (faint, above) */}
      {prev && (
        <p style={{
          fontFamily: 'var(--font-cinzel), serif',
          fontSize: 'clamp(16px, 2.5vw, 34px)',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.3)',
          lineHeight: 1.4,
          letterSpacing: '0.04em',
          margin: '0 0 24px',
          maxWidth: '80vw',
          transition: 'all 0.5s ease',
        }}>
          {prev.text}
        </p>
      )}

      {/* Current line (bright, main) */}
      <p style={{
        fontFamily: 'var(--font-cinzel), serif',
        fontSize: 'clamp(26px, 5vw, 64px)',
        fontWeight: 600,
        color: '#ffffff',
        lineHeight: 1.3,
        letterSpacing: '0.04em',
        textShadow: `0 0 40px ${glowColor}, 0 2px 8px rgba(0,0,0,0.8)`,
        margin: 0,
        maxWidth: '85vw',
        transition: 'all 0.4s ease',
      }}>
        {curr?.text}
      </p>

      {/* Next line (faint, below) */}
      {next && (
        <p style={{
          fontFamily: 'var(--font-cinzel), serif',
          fontSize: 'clamp(16px, 2.5vw, 34px)',
          fontWeight: 400,
          color: 'rgba(255,255,255,0.3)',
          lineHeight: 1.4,
          letterSpacing: '0.04em',
          margin: '24px 0 0',
          maxWidth: '80vw',
          transition: 'all 0.5s ease',
        }}>
          {next.text}
        </p>
      )}

      {/* Line counter */}
      <div style={{
        position: 'absolute',
        bottom: 60,
        left: 0, right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: 6,
      }}>
        {song.lines.map((_, i) => (
          <div key={i} style={{
            width:        i === lineIndex ? 20 : 6,
            height:       6,
            borderRadius: 3,
            background:   i === lineIndex ? timerColor : 'rgba(255,255,255,0.2)',
            transition:   'all 0.3s ease',
          }} />
        ))}
      </div>
    </div>
  )
}