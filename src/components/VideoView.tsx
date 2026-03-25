'use client'

import { useEffect, useRef, useState } from 'react'
import type { SlideVideo } from '@/types'

interface VideoViewProps {
  video: SlideVideo
}

export default function VideoView({ video }: VideoViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setError(false)
    const el = videoRef.current
    if (!el) return
    el.muted = false
    el.volume = 1
    el.load()
    const playPromise = el.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay blocked — user interaction needed; video remains paused
      })
    }
  }, [video.url, video.id])

  if (error) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.4)',
        gap: 12,
      }}>
        <span style={{ fontSize: 48 }}>🎬</span>
        <p style={{ fontSize: 16, letterSpacing: '0.1em' }}>Video unavailable</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', maxWidth: 300, textAlign: 'center' }}>
          {video.name}
        </p>
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      background: '#000',
      overflow: 'hidden',
    }}>
      <video
        ref={videoRef}
        key={video.id}
        controls
        autoPlay
        playsInline
        preload="auto"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          background: '#000',
          display: 'block',
        }}
        onLoadedMetadata={event => {
          event.currentTarget.volume = 1
        }}
        onError={() => setError(true)}
      >
        <source src={video.url} type={video.type || 'video/mp4'} />
      </video>
    </div>
  )
}