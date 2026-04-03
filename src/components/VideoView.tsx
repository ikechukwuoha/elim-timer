'use client'

import { useEffect, useRef, useState } from 'react'
import type { SlideVideo } from '@/types'

interface VideoViewProps {
  video: SlideVideo
}

export default function VideoView({ video }: VideoViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const backgroundVideoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)

  const syncBackgroundVideo = (forceSeek = false) => {
    const main = videoRef.current
    const background = backgroundVideoRef.current
    if (!main || !background) return

    if (forceSeek || Math.abs(background.currentTime - main.currentTime) > 0.35) {
      try {
        background.currentTime = main.currentTime
      } catch {
        // Ignore sync seek issues while metadata is still loading.
      }
    }

    if (background.playbackRate !== main.playbackRate) {
      background.playbackRate = main.playbackRate
    }

    if (main.paused) {
      background.pause()
      return
    }

    const playPromise = background.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Ignore autoplay restrictions on the blurred background layer.
      })
    }
  }

  useEffect(() => {
    setError(false)
    const el = videoRef.current
    const bg = backgroundVideoRef.current
    if (!el) return
    el.muted = false
    el.volume = 1
    el.load()
    if (bg) {
      bg.muted = true
      bg.volume = 0
      bg.load()
    }
    const playPromise = el.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay blocked — user interaction needed; video remains paused
      })
    }
    if (bg) syncBackgroundVideo(true)
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
        ref={backgroundVideoRef}
        key={`${video.id}-bg`}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          background: '#000',
          display: 'block',
          filter: 'blur(20px) brightness(0.5) saturate(1.08)',
          transform: 'scale(1.08)',
          pointerEvents: 'none',
        }}
      >
        <source src={video.url} type={video.type || 'video/mp4'} />
      </video>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.14) 42%, rgba(0,0,0,0.36) 100%)',
          pointerEvents: 'none',
        }}
      />

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
          objectFit: 'contain',
          background: 'transparent',
          display: 'block',
        }}
        onLoadedMetadata={event => {
          event.currentTarget.volume = 1
          syncBackgroundVideo(true)
        }}
        onPlay={() => syncBackgroundVideo(true)}
        onPause={() => syncBackgroundVideo()}
        onSeeking={() => syncBackgroundVideo(true)}
        onSeeked={() => syncBackgroundVideo(true)}
        onRateChange={() => syncBackgroundVideo()}
        onTimeUpdate={() => syncBackgroundVideo()}
        onError={() => setError(true)}
      >
        <source src={video.url} type={video.type || 'video/mp4'} />
      </video>
    </div>
  )
}
