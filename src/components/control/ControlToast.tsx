import type { ControlStyles } from './controlStyles'

type ToastTone = 'success' | 'info' | 'warning' | 'danger'

type ControlToastData = {
  title: string
  detail?: string
  tone: ToastTone
  undoLabel?: string
}

type ControlToastProps = {
  styles: ControlStyles
  toast: ControlToastData
  onUndo: () => void
  onDismiss: () => void
}

function getBorderColor(tone: ToastTone) {
  if (tone === 'success') return 'rgba(74,222,128,0.24)'
  if (tone === 'warning') return 'rgba(251,191,36,0.24)'
  if (tone === 'danger') return 'rgba(251,113,133,0.24)'
  return 'rgba(96,165,250,0.24)'
}

export default function ControlToast({
  styles,
  toast,
  onUndo,
  onDismiss,
}: ControlToastProps) {
  return (
    <div style={styles.toastWrap}>
      <div style={{ ...styles.toastCard, borderColor: getBorderColor(toast.tone) }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.toastTitle}>{toast.title}</p>
          {toast.detail && <p style={styles.toastDetail}>{toast.detail}</p>}
        </div>
        {toast.undoLabel && (
          <button onClick={onUndo} style={styles.toastUndoBtn}>
            {toast.undoLabel}
          </button>
        )}
        <button onClick={onDismiss} style={styles.toastDismissBtn}>Dismiss</button>
      </div>
    </div>
  )
}
