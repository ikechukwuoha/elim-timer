import type { ControlStyles } from './controlStyles'

type ControlTabBarProps = {
  styles: ControlStyles
  tabs: Array<{ id: string; label: string }>
  activeTab: string
  presentMode: string
  onSelectTab: (tabId: string) => void
}

function getPresentModePill(presentMode: string) {
  if (presentMode === 'timer') {
    return {
      label: 'Live Timer',
      background: 'rgba(34,197,94,0.12)',
      color: '#86efac',
      border: 'rgba(34,197,94,0.24)',
    }
  }

  if (presentMode === 'blank') {
    return {
      label: 'Blank',
      background: 'rgba(100,116,139,0.12)',
      color: '#94a3b8',
      border: 'rgba(148,163,184,0.18)',
    }
  }

  return {
    label: presentMode.toUpperCase(),
    background: 'rgba(56,189,248,0.12)',
    color: '#7dd3fc',
    border: 'rgba(56,189,248,0.24)',
  }
}

export default function ControlTabBar({
  styles,
  tabs,
  activeTab,
  presentMode,
  onSelectTab,
}: ControlTabBarProps) {
  const presentModePill = getPresentModePill(presentMode)

  return (
    <div style={styles.tabBar}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onSelectTab(tab.id)}
          style={{
            ...styles.tab,
            color: activeTab === tab.id ? '#f8fafc' : '#8da2bd',
            background:
              activeTab === tab.id
                ? 'linear-gradient(180deg,rgba(14,165,233,0.18),rgba(13,148,136,0.12))'
                : 'rgba(255,255,255,0.02)',
            borderColor: activeTab === tab.id ? 'rgba(103,232,249,0.35)' : 'rgba(148,163,184,0.08)',
            boxShadow:
              activeTab === tab.id
                ? '0 12px 24px rgba(6,182,212,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
                : 'none',
          }}
        >
          {tab.label}
        </button>
      ))}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, paddingRight: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 10,
            color: '#7c8aa3',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          On Screen
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '8px 14px',
            borderRadius: 999,
            letterSpacing: '0.16em',
            background: presentModePill.background,
            color: presentModePill.color,
            border: `1px solid ${presentModePill.border}`,
            textTransform: 'uppercase',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {presentModePill.label}
        </span>
      </div>
    </div>
  )
}
