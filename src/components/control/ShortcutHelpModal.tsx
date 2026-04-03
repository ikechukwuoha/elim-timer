import type { ControlStyles } from './controlStyles'

type ShortcutHelpModalProps = {
  styles: ControlStyles
  shortcuts: Array<{ key: string; description: string }>
  onClose: () => void
}

export default function ShortcutHelpModal({
  styles,
  shortcuts,
  onClose,
}: ShortcutHelpModalProps) {
  return (
    <div style={styles.shortcutOverlay} onClick={onClose}>
      <div style={styles.shortcutPanel} onClick={event => event.stopPropagation()}>
        <div style={styles.shortcutPanelHeader}>
          <div>
            <span style={styles.liveStripLabel}>Keyboard Shortcuts</span>
            <p style={styles.liveStripTitle}>Faster live control</p>
            <p style={styles.liveStripMeta}>These shortcuts work when you are not typing inside an input or editor.</p>
          </div>
          <button onClick={onClose} style={styles.toastDismissBtn}>Close</button>
        </div>

        <div style={styles.shortcutList}>
          {shortcuts.map(shortcut => (
            <div key={shortcut.key} style={styles.shortcutRow}>
              <span style={styles.shortcutKey}>{shortcut.key}</span>
              <span style={styles.shortcutDesc}>{shortcut.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
