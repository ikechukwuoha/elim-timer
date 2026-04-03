import type { PresentState, Song } from '@/types'
import type { ControlStyles } from './controlStyles'

type SongsTabProps = {
  styles: ControlStyles
  presentState: PresentState
  activeSong: Song | null
  showSongEditor: boolean
  editingSongId: number | null
  newSongTitle: string
  newSongArtist: string
  newSongLyrics: string
  newSongInterpretation: string
  onToggleSongEditor: () => void
  onSongTitleChange: (value: string) => void
  onSongArtistChange: (value: string) => void
  onSongLyricsChange: (value: string) => void
  onSongInterpretationChange: (value: string) => void
  onSaveSong: () => void
  onBeginSongEditing: (song: Song) => void
  onPresentSong: (songId: number) => void
  onDeleteSong: (songId: number) => void
  onSongLine: (delta: number) => void
  onGoToSongLine: (index: number) => void
}

export default function SongsTab({
  styles,
  presentState,
  activeSong,
  showSongEditor,
  editingSongId,
  newSongTitle,
  newSongArtist,
  newSongLyrics,
  newSongInterpretation,
  onToggleSongEditor,
  onSongTitleChange,
  onSongArtistChange,
  onSongLyricsChange,
  onSongInterpretationChange,
  onSaveSong,
  onBeginSongEditing,
  onPresentSong,
  onDeleteSong,
  onSongLine,
  onGoToSongLine,
}: SongsTabProps) {
  return (
    <div style={styles.twoCol}>
      <aside style={{ ...styles.left, gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={styles.sectionTitle}>Song Library</p>
          <button onClick={onToggleSongEditor} style={{ ...styles.addBtn, padding: '6px 14px', fontSize: 12 }}>
            {showSongEditor ? 'Cancel' : '+ New Song'}
          </button>
        </div>

        {showSongEditor && (
          <div style={styles.editorCard}>
            <p style={{ ...styles.sectionTitle, marginBottom: 2 }}>{editingSongId !== null ? 'Edit Song' : 'New Song'}</p>
            <input type="text" placeholder="Song title *" value={newSongTitle} onChange={event => onSongTitleChange(event.target.value)} style={styles.addInput} />
            <input type="text" placeholder="Artist (optional)" value={newSongArtist} onChange={event => onSongArtistChange(event.target.value)} style={styles.addInput} />
            <textarea placeholder="Paste lyrics here — one line per row…" value={newSongLyrics} onChange={event => onSongLyricsChange(event.target.value)} style={{ ...styles.addInput, height: 140, resize: 'vertical' }} />
            <textarea placeholder="Optional English interpretation — one line per row to match the lyrics…" value={newSongInterpretation} onChange={event => onSongInterpretationChange(event.target.value)} style={{ ...styles.addInput, height: 120, resize: 'vertical' }} />
            <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, margin: '-2px 0 0' }}>
              Each interpretation row matches the lyric row above it. Leave a row blank when no English meaning is needed.
            </p>
            <button onClick={onSaveSong} style={styles.addBtn}>{editingSongId !== null ? 'Update Song' : 'Save Song'}</button>
          </div>
        )}

        <div style={styles.activityList}>
          {presentState.songs.map(song => {
            const isActive = song.id === presentState.activeSongId && presentState.mode === 'song'
            const interpretationCount = song.lines.filter(line => line.interpretation).length

            return (
              <div
                key={song.id}
                style={{
                  ...styles.activityRow,
                  background: isActive ? 'linear-gradient(135deg,#1e3a2a,#172d20)' : '#1c1c1e',
                  borderColor: isActive ? '#166534' : '#252528',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  cursor: 'default',
                  boxShadow: isActive ? '0 2px 12px rgba(22,101,52,0.2)' : 'none',
                }}
              >
                <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isActive ? '#4ade80' : '#e2e8f0' }}>{song.title}</span>
                  <button onClick={() => onBeginSongEditing(song)} style={{ ...styles.ctrlBtn, padding: '5px 12px', fontSize: 12 }}>Edit</button>
                  <button onClick={() => onPresentSong(song.id)} style={{ ...styles.addBtn, padding: '5px 12px', fontSize: 12 }}>Present</button>
                  <button onClick={() => onDeleteSong(song.id)} style={styles.removeBtn}>✕</button>
                </div>
                {song.artist && <p style={{ fontSize: 12, color: '#475569' }}>{song.artist}</p>}
                <p style={{ fontSize: 11, color: '#334155' }}>
                  {song.lines.length} lines{interpretationCount > 0 ? ` · ${interpretationCount} interpretation${interpretationCount === 1 ? '' : 's'}` : ''}
                </p>
              </div>
            )
          })}
        </div>
      </aside>

      <main style={styles.right}>
        {activeSong && presentState.mode === 'song' ? (
          <>
            <p style={styles.sectionTitle}>{activeSong.title} — Line {presentState.activeLineIndex + 1} of {activeSong.lines.length}</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => onSongLine(-1)} style={{ ...styles.ctrlBtn, flex: 1 }} disabled={presentState.activeLineIndex === 0}>◀ Prev Line</button>
              <button onClick={() => onSongLine(1)} style={{ ...styles.ctrlBtn, flex: 1 }} disabled={presentState.activeLineIndex >= activeSong.lines.length - 1}>Next Line ▶</button>
            </div>
            <div style={styles.activityList}>
              {activeSong.lines.map((line, index) => {
                const isActive = index === presentState.activeLineIndex

                return (
                  <div
                    key={line.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onGoToSongLine(index)}
                    onKeyDown={event => event.key === 'Enter' && onGoToSongLine(index)}
                    style={{
                      ...styles.activityRow,
                      background: isActive ? 'linear-gradient(135deg,#1e3a2a,#172d20)' : '#1c1c1e',
                      borderColor: isActive ? '#166534' : '#252528',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ ...styles.indexBadge, background: isActive ? '#22c55e' : '#252528', color: isActive ? '#000' : '#4a4a55' }}>{index + 1}</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 13, color: isActive ? '#fff' : '#94a3b8', lineHeight: 1.5 }}>{line.text}</span>
                      {line.interpretation && (
                        <span style={{ fontSize: 12, color: isActive ? '#dcfce7' : '#64748b', lineHeight: 1.5 }}>
                          {line.interpretation}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={styles.emptyState}>
            <p style={{ fontSize: 32 }}>♪</p>
            <p style={{ fontSize: 14 }}>Select a song and press Present</p>
          </div>
        )}
      </main>
    </div>
  )
}
