'use client'

import type { SlideImage } from '@/types'
import Image from 'next/image'

interface Props {
  image: SlideImage
}

export default function ImageView({ image }: Props) {
  if (!image.url) {
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: 'white',
      }}>
        Image not available
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: '#000',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <Image
          src={image.url}
          alt={image.name}
          fill
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
            filter: 'blur(20px) brightness(0.52) saturate(1.05)',
            transform: 'scale(1.08)',
          }}
          priority
          unoptimized={image.url?.startsWith('data:') ?? false}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.12) 38%, rgba(0,0,0,0.32) 100%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'absolute', inset: 0 }}>
        <Image
          src={image.url}
          alt={image.name}
          fill
          style={{ objectFit: 'contain', objectPosition: 'center' }}
          priority
          unoptimized={image.url?.startsWith('data:') ?? false}
        />
      </div>
    </div>
  )
}
