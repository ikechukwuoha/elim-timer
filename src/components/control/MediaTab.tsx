import type { ChangeEventHandler } from 'react'
import type { PresentState } from '@/types'
import type { ControlStyles } from './controlStyles'

type MediaTabProps = {
  styles: ControlStyles
  presentState: PresentState
  videoAccept: string
  presentationAccept: string
  mediaUploadProgress: string
  googleSlidesUrl: string
  googleSlidesError: string
  onGoogleSlidesUrlChange: (value: string) => void
  onAddGoogleSlides: () => void
  onVideoUpload: ChangeEventHandler<HTMLInputElement>
  onPresentationUpload: ChangeEventHandler<HTMLInputElement>
  onPresentVideo: (videoId: number) => void
  onDeleteVideo: (videoId: number) => void
  onPresentPresentation: (presentationId: number) => void
  onDeletePresentation: (presentationId: number) => void
}

export default function MediaTab({
  styles,
  presentState,
  videoAccept,
  presentationAccept,
  mediaUploadProgress,
  googleSlidesUrl,
  googleSlidesError,
  onGoogleSlidesUrlChange,
  onAddGoogleSlides,
  onVideoUpload,
  onPresentationUpload,
  onPresentVideo,
  onDeleteVideo,
  onPresentPresentation,
  onDeletePresentation,
}: MediaTabProps) {
  return (
    <div style={styles.twoCol}>
      <aside style={{ ...styles.left, gap: 14 }}>
        <p style={styles.sectionTitle}>Upload Video</p>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 16px', border: '2px dashed #252528', borderRadius: 10, cursor: 'pointer', background: '#161618' }}>
          <span style={{ fontSize: 28 }}>🎬</span>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Click to upload video</span>
          <span style={{ fontSize: 11, color: '#475569' }}>MP4, WebM, MOV, AVI supported</span>
          <input type="file" accept={videoAccept} multiple onChange={onVideoUpload} style={{ display: 'none' }} />
        </label>

        <p style={{ ...styles.sectionTitle, marginTop: 4 }}>Upload Presentation</p>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 16px', border: '2px dashed #252528', borderRadius: 10, cursor: 'pointer', background: '#161618' }}>
          <span style={{ fontSize: 28 }}>📊</span>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Click to upload presentation</span>
          <span style={{ fontSize: 11, color: '#475569' }}>PDF (native) · PPTX/PPT/ODP (converted server-side)</span>
          <input type="file" accept={presentationAccept} multiple onChange={onPresentationUpload} style={{ display: 'none' }} />
        </label>

        {mediaUploadProgress && (
          <p style={{ fontSize: 12, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
            {mediaUploadProgress}
          </p>
        )}

        <div style={{ borderTop: '1px solid #1e1e24', paddingTop: 14 }}>
          <p style={styles.sectionTitle}>Google Slides</p>
          <p style={{ fontSize: 11, color: '#475569', marginTop: 4, marginBottom: 8, lineHeight: 1.5 }}>
            Paste a Google Slides share or publish link. Make sure sharing is set to <em style={{ color: '#94a3b8' }}>Anyone with the link</em>.
          </p>
          <input
            type="text"
            placeholder="https://docs.google.com/presentation/d/…"
            value={googleSlidesUrl}
            onChange={event => onGoogleSlidesUrlChange(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && onAddGoogleSlides()}
            style={{ ...styles.addInput, width: '100%', boxSizing: 'border-box', marginBottom: 6 }}
          />
          {googleSlidesError && <p style={{ fontSize: 11, color: '#f87171', marginBottom: 6 }}>{googleSlidesError}</p>}
          <button onClick={onAddGoogleSlides} style={{ ...styles.addBtn, width: '100%', boxSizing: 'border-box' }}>Add Google Slides</button>
        </div>

        <div style={{ fontSize: 11, color: '#334155', background: '#141418', border: '1px solid #1e1e24', borderRadius: 10, padding: '10px 12px', lineHeight: 1.7 }}>
          <p style={{ color: '#475569', fontWeight: 600, marginBottom: 4 }}>Format support</p>
          <p>✅ PDF — renders page by page, no conversion needed</p>
          <p>✅ MP4 / WebM / MOV — native video playback</p>
          <p>✅ Google Slides — live embed via iframe</p>
          <p>⚠️ PPTX — requires LibreOffice on server to convert to PDF</p>
        </div>
      </aside>

      <main style={styles.right}>
        <p style={styles.sectionTitle}>Videos ({presentState.videos?.length ?? 0})</p>
        {(!presentState.videos || presentState.videos.length === 0) ? (
          <div style={{ ...styles.emptyState, flex: 'none', padding: '28px 0', minHeight: 100 }}>
            <p style={{ fontSize: 24 }}>🎬</p>
            <p style={{ fontSize: 13 }}>No videos uploaded yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {presentState.videos.map(video => {
              const isActive = video.id === presentState.activeVideoId && presentState.mode === 'video'

              return (
                <div key={video.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: isActive ? 'linear-gradient(135deg,#1e3a5f,#162d4a)' : '#1c1c1e', border: `1px solid ${isActive ? '#1e40af' : '#252528'}`, borderRadius: 10, boxShadow: isActive ? '0 2px 12px rgba(30,64,175,0.2)' : 'none' }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>🎬</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#93c5fd' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.name}</p>
                    <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{video.type}</p>
                  </div>
                  {isActive && <span style={{ fontSize: 10, background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>LIVE</span>}
                  <button onClick={() => onPresentVideo(video.id)} style={{ ...styles.addBtn, padding: '6px 14px', fontSize: 12, flexShrink: 0 }}>Play</button>
                  <button onClick={() => onDeleteVideo(video.id)} style={styles.removeBtn}>✕</button>
                </div>
              )
            })}
          </div>
        )}

        <p style={styles.sectionTitle}>Presentations ({presentState.presentations?.length ?? 0})</p>
        {(!presentState.presentations || presentState.presentations.length === 0) ? (
          <div style={{ ...styles.emptyState, flex: 'none', padding: '28px 0', minHeight: 100 }}>
            <p style={{ fontSize: 24 }}>📊</p>
            <p style={{ fontSize: 13 }}>No presentations added yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {presentState.presentations.map(presentation => {
              const isActive = presentation.id === presentState.activePresentationId && presentState.mode === 'presentation'
              const icon = presentation.type === 'google-slides' ? '🖥' : presentation.type === 'application/pdf' ? '📄' : '📊'
              const label = presentation.type === 'google-slides' ? 'Google Slides' : presentation.type === 'application/pdf' ? 'PDF' : 'PPTX'

              return (
                <div key={presentation.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: isActive ? 'linear-gradient(135deg,#1e3a5f,#162d4a)' : '#1c1c1e', border: `1px solid ${isActive ? '#1e40af' : '#252528'}`, borderRadius: 10, boxShadow: isActive ? '0 2px 12px rgba(30,64,175,0.2)' : 'none' }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#93c5fd' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{presentation.name}</p>
                    <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{label}{presentation.pageCount ? ` · ${presentation.pageCount} pages` : ''}</p>
                  </div>
                  {isActive && <span style={{ fontSize: 10, background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>LIVE</span>}
                  <button onClick={() => onPresentPresentation(presentation.id)} style={{ ...styles.addBtn, padding: '6px 14px', fontSize: 12, flexShrink: 0 }}>Present</button>
                  <button onClick={() => onDeletePresentation(presentation.id)} style={styles.removeBtn}>✕</button>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
