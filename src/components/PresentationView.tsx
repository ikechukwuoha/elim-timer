'use client'

import type { SlidePresentation } from '@/types'

interface PresentationViewProps {
  presentation: SlidePresentation
}

function buildPdfViewerUrl(url: string): string {
  if (!url) return ''
  const hash = 'toolbar=0&navpanes=0&scrollbar=0&view=FitH'
  return url.includes('#') ? `${url}&${hash}` : `${url}#${hash}`
}

export default function PresentationView({ presentation }: PresentationViewProps) {
  const isGoogleSlides = presentation.type === 'google-slides'
  const isPdf = presentation.type === 'application/pdf' || presentation.url.startsWith('data:application/pdf')
  const displayUrl = isPdf ? buildPdfViewerUrl(presentation.url) : (presentation.embedUrl || presentation.url)

  if (!presentation.url && !presentation.embedUrl) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'rgba(255,255,255,0.55)',
        background: '#000',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 42, margin: 0 }}>Presentation unavailable</p>
        <p style={{ fontSize: 14, margin: 0, color: 'rgba(255,255,255,0.35)' }}>{presentation.name}</p>
      </div>
    )
  }

  if (!isGoogleSlides && !isPdf) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: '#fff',
        background: '#000',
        textAlign: 'center',
        padding: '32px',
        boxSizing: 'border-box',
      }}>
        <p style={{ fontSize: 44, margin: 0 }}>This presentation cannot be previewed here yet</p>
        <p style={{ fontSize: 15, margin: 0, color: 'rgba(255,255,255,0.6)', maxWidth: 680 }}>
          Upload as PDF or use a published Google Slides link for big-screen playback.
        </p>
        <p style={{ fontSize: 13, margin: 0, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {presentation.name}
        </p>
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'stretch',
      justifyContent: 'stretch',
      background: '#000',
    }}>
      <iframe
        key={presentation.id}
        src={displayUrl}
        title={presentation.name}
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          background: '#000',
        }}
        allow="autoplay; fullscreen"
      />

      <p style={{
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        margin: 0,
        textAlign: 'center',
        fontSize: 13,
        color: 'rgba(255,255,255,0.38)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-inter),sans-serif',
        pointerEvents: 'none',
      }}>
        {presentation.name}
      </p>
    </div>
  )
}
