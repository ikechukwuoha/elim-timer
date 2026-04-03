import type { BibleDisplayMode, BibleVerse } from '@/types'
import type { ControlStyles } from './controlStyles'

type OnScreenScripturePanelProps = {
  styles: ControlStyles
  activeVerse: BibleVerse | null
  activeSecondaryVerse: BibleVerse | null
  bibleDisplayMode: BibleDisplayMode
}

export default function OnScreenScripturePanel({
  styles,
  activeVerse,
  activeSecondaryVerse,
  bibleDisplayMode,
}: OnScreenScripturePanelProps) {
  const showDouble = bibleDisplayMode === 'double' && activeVerse && activeSecondaryVerse

  return (
    <div style={styles.livePanel}>
      <div style={styles.livePanelHeader}>
        <span style={styles.livePanelTag}>Live Scripture</span>
        <span style={{ ...styles.transcriptSuggestionCount, color: '#93c5fd' }}>
          {showDouble ? 'Double View' : 'Single View'}
        </span>
      </div>
      {showDouble ? (
        <>
          <p style={styles.livePanelRef}>{activeVerse.reference} + {activeSecondaryVerse.translation}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <p style={{ ...styles.livePanelRef, marginBottom: 6 }}>{activeVerse.translation}</p>
              <p style={styles.livePanelText}>{activeVerse.text}</p>
            </div>
            <div>
              <p style={{ ...styles.livePanelRef, marginBottom: 6 }}>{activeSecondaryVerse.translation}</p>
              <p style={styles.livePanelText}>{activeSecondaryVerse.text}</p>
            </div>
          </div>
        </>
      ) : activeVerse ? (
        <>
          <p style={styles.livePanelRef}>{activeVerse.reference}</p>
          <p style={styles.livePanelText}>{activeVerse.text}</p>
        </>
      ) : (
        <p style={styles.livePanelEmpty}>No scripture is currently live on the screen.</p>
      )}
    </div>
  )
}
