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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
    }}>
      <Image
        src={image.url}
        alt={image.name}
        fill
        style={{ objectFit: 'contain' }}
        priority
        unoptimized={image.url?.startsWith('data:') ?? false}
      />
      {/* Image name bottom */}
      <p style={{
        position: 'absolute',
        bottom: 28,
        left: 0, right: 0,
        textAlign: 'center',
        fontSize: 13,
        color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-inter), sans-serif',
      }}>
        {image.name}
      </p>
    </div>
  )
}