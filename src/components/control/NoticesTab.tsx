import type { Notice, PresentState } from '@/types'
import type { ControlStyles } from './controlStyles'

type NoticesTabProps = {
  styles: ControlStyles
  presentState: PresentState
  showNoticeEditor: boolean
  newNoticeTitle: string
  newNoticeBody: string
  newNoticeStyle: Notice['style']
  onToggleNoticeEditor: () => void
  onNoticeTitleChange: (value: string) => void
  onNoticeBodyChange: (value: string) => void
  onNoticeStyleChange: (value: Notice['style']) => void
  onSaveNotice: () => void
  onPresentNotice: (noticeId: number) => void
  onDeleteNotice: (noticeId: number) => void
}

export default function NoticesTab({
  styles,
  presentState,
  showNoticeEditor,
  newNoticeTitle,
  newNoticeBody,
  newNoticeStyle,
  onToggleNoticeEditor,
  onNoticeTitleChange,
  onNoticeBodyChange,
  onNoticeStyleChange,
  onSaveNotice,
  onPresentNotice,
  onDeleteNotice,
}: NoticesTabProps) {
  const styleColors: Record<Notice['style'], string> = {
    default: '#60a5fa',
    urgent: '#f87171',
    celebration: '#fbbf24',
  }

  const activeNotice =
    presentState.activeNoticeId && presentState.mode === 'notice'
      ? presentState.notices.find(notice => notice.id === presentState.activeNoticeId) ?? null
      : null

  return (
    <div style={styles.twoCol}>
      <aside style={{ ...styles.left, gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={styles.sectionTitle}>Announcements</p>
          <button onClick={onToggleNoticeEditor} style={{ ...styles.addBtn, padding: '6px 14px', fontSize: 12 }}>
            {showNoticeEditor ? 'Cancel' : '+ New Notice'}
          </button>
        </div>

        {showNoticeEditor && (
          <div style={styles.editorCard}>
            <input type="text" placeholder="Title *" value={newNoticeTitle} onChange={event => onNoticeTitleChange(event.target.value)} style={styles.addInput} />
            <textarea placeholder="Body text…" value={newNoticeBody} onChange={event => onNoticeBodyChange(event.target.value)} style={{ ...styles.addInput, height: 100, resize: 'vertical' }} />
            <select value={newNoticeStyle} onChange={event => onNoticeStyleChange(event.target.value as Notice['style'])} style={styles.fullSelect}>
              <option value="default">Default</option>
              <option value="urgent">Urgent</option>
              <option value="celebration">Celebration</option>
            </select>
            <button onClick={onSaveNotice} style={styles.addBtn}>Save Notice</button>
          </div>
        )}

        <div style={styles.activityList}>
          {presentState.notices.map(notice => {
            const isActive = notice.id === presentState.activeNoticeId && presentState.mode === 'notice'

            return (
              <div key={notice.id} style={{ ...styles.activityRow, background: isActive ? 'linear-gradient(135deg,#1e3a5f,#162d4a)' : '#1c1c1e', borderColor: isActive ? '#1e40af' : '#252528', flexDirection: 'column', alignItems: 'flex-start', cursor: 'default', gap: 4 }}>
                <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isActive ? '#fff' : '#e2e8f0' }}>{notice.title}</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, color: styleColors[notice.style], border: `1px solid ${styleColors[notice.style]}40` }}>{notice.style}</span>
                  <button onClick={() => onPresentNotice(notice.id)} style={{ ...styles.addBtn, padding: '5px 12px', fontSize: 12 }}>Display</button>
                  <button onClick={() => onDeleteNotice(notice.id)} style={styles.removeBtn}>✕</button>
                </div>
                {notice.body && <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>{notice.body.slice(0, 80)}{notice.body.length > 80 ? '…' : ''}</p>}
              </div>
            )
          })}
        </div>
      </aside>

      <main style={styles.right}>
        <p style={styles.sectionTitle}>Preview</p>
        {activeNotice ? (
          <div style={{ background: 'linear-gradient(145deg,#0a0a14,#0d0d1f)', border: '1px solid #1e40af', borderRadius: 12, padding: 32, textAlign: 'center', flex: 1, boxShadow: '0 4px 24px rgba(30,64,175,0.15)' }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 12 }}>{activeNotice.title}</p>
            <p style={{ fontSize: 16, color: '#cbd5e1', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{activeNotice.body}</p>
          </div>
        ) : (
          <div style={styles.emptyState}>
            <p style={{ fontSize: 32 }}>📢</p>
            <p style={{ fontSize: 14 }}>Select a notice and press Display</p>
          </div>
        )}
      </main>
    </div>
  )
}
