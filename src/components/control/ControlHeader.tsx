import type { ControlStyles } from './controlStyles'

type ControlHeaderProps = {
  styles: ControlStyles
  churchName: string
  systemStatusColor: string
  systemStatusLabel: string
  onBlankScreen: () => void
  onShowTimer: () => void
  onOpenBigScreen: () => void
  onLogout: () => void
}

export default function ControlHeader({
  styles,
  churchName,
  systemStatusColor,
  systemStatusLabel,
  onBlankScreen,
  onShowTimer,
  onOpenBigScreen,
  onLogout,
}: ControlHeaderProps) {
  return (
    <header style={styles.header}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={styles.logoMark}>
          <img
            src="/church-logo.jpg"
            alt="Elim Christian Garden International logo"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
        <div>
          <p style={styles.churchName}>{churchName}</p>
          <p style={styles.subtitle}>Presentation Control</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: systemStatusColor,
            letterSpacing: '0.08em',
            background: `${systemStatusColor}14`,
            border: `1px solid ${systemStatusColor}33`,
            borderRadius: 20,
            padding: '5px 12px',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              display: 'inline-block',
              background: systemStatusColor,
              boxShadow: `0 0 6px ${systemStatusColor}`,
            }}
          />
          {systemStatusLabel}
        </div>
        <button onClick={onBlankScreen} style={styles.headerBtnNeutral}>Blank Screen</button>
        <button onClick={onShowTimer} style={styles.headerBtnGreen}>Show Timer</button>
        <button onClick={onOpenBigScreen} style={styles.bigScreenBtn}>Open Big Screen</button>
        <button onClick={onLogout} style={styles.headerBtnDanger}>Logout</button>
      </div>
    </header>
  )
}
