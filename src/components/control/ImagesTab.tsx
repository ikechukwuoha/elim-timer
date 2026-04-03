import type { ChangeEventHandler } from 'react'
import type { PresentState } from '@/types'
import type { ControlStyles } from './controlStyles'

type ImagesTabProps = {
  styles: ControlStyles
  presentState: PresentState
  onImageUpload: ChangeEventHandler<HTMLInputElement>
  onPresentImage: (imageId: number) => void
  onDeleteImage: (imageId: number) => void
}

export default function ImagesTab({
  styles,
  presentState,
  onImageUpload,
  onPresentImage,
  onDeleteImage,
}: ImagesTabProps) {
  return (
    <div style={styles.twoCol}>
      <aside style={{ ...styles.left, gap: 12 }}>
        <p style={styles.sectionTitle}>Upload Images</p>
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '28px 16px',
            border: '2px dashed #252528',
            borderRadius: 10,
            cursor: 'pointer',
            color: '#475569',
            fontSize: 13,
            background: '#161618',
          }}
        >
          <span style={{ fontSize: 28 }}>🖼</span>
          <span style={{ color: '#94a3b8' }}>Click to upload images</span>
          <span style={{ fontSize: 11, color: '#475569' }}>PNG, JPG, GIF, WEBP supported</span>
          <input type="file" accept="image/*" multiple onChange={onImageUpload} style={{ display: 'none' }} />
        </label>
        <p style={{ fontSize: 11, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 8 }}>
          {presentState.images.length} image{presentState.images.length !== 1 ? 's' : ''} uploaded
        </p>
      </aside>

      <main style={styles.right}>
        <p style={styles.sectionTitle}>Image Library</p>
        {presentState.images.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ fontSize: 32 }}>🖼</p>
            <p style={{ fontSize: 14 }}>No images uploaded yet</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {presentState.images.map(image => {
              const isActive = image.id === presentState.activeImageId && presentState.mode === 'image'

              return (
                <div
                  key={image.id}
                  style={{
                    border: `2px solid ${isActive ? '#3b82f6' : '#252528'}`,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#1c1c1e',
                    position: 'relative',
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 2px 16px rgba(59,130,246,0.25)' : 'none',
                  }}
                >
                  <img
                    src={image.url}
                    alt={image.name}
                    style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                    onClick={() => onPresentImage(image.id)}
                  />
                  <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 11,
                        color: '#64748b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {image.name}
                    </span>
                    <button onClick={() => onDeleteImage(image.id)} style={styles.removeBtn}>✕</button>
                  </div>
                  {isActive && (
                    <div style={{ position: 'absolute', top: 6, right: 6, background: '#3b82f6', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                      LIVE
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
