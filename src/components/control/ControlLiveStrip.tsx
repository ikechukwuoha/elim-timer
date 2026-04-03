import type { ControlStyles } from './controlStyles'

type LiveSummary = {
  label: string
  detail: string
}

type LiveOutputPreview = {
  modeLabel: string
  title: string
  subtitle: string
  body: string
  footer: string
  accent: string
  tone: string
  visual: string
  thumbnailUrl?: string
  videoUrl?: string
}

type LiveMetric = {
  id: string
  label: string
  value: string
  meta: string
}

type HealthServiceBadge = {
  id: string
  label: string
  status: 'checking' | 'ok' | 'error'
}

type ControlLiveStripProps = {
  styles: ControlStyles
  liveSummary: LiveSummary
  liveOutputPreview: LiveOutputPreview
  metrics: LiveMetric[]
  systemStatusLabel: string
  systemStatusColor: string
  lastCheckedLabel: string
  healthServiceBadges: HealthServiceBadge[]
  onViewShortcuts: () => void
}

function getHealthStatusColor(status: HealthServiceBadge['status']) {
  if (status === 'ok') return '#4ade80'
  if (status === 'error') return '#fb7185'
  return '#fbbf24'
}

export default function ControlLiveStrip({
  styles,
  liveSummary,
  liveOutputPreview,
  metrics,
  systemStatusLabel,
  systemStatusColor,
  lastCheckedLabel,
  healthServiceBadges,
  onViewShortcuts,
}: ControlLiveStripProps) {
  return (
    <div style={styles.liveStrip}>
      <div style={styles.liveStripPrimary}>
        <div style={styles.liveStripLead}>
          <div style={styles.liveStripHeading}>
            <span style={styles.liveStripLabel}>Live Output</span>
            <p style={styles.liveStripTitle}>{liveSummary.label}</p>
            <p style={styles.liveStripMeta}>{liveSummary.detail}</p>
          </div>

          <div
            style={{
              ...styles.liveOutputCard,
              borderColor: `${liveOutputPreview.accent}30`,
              background: `linear-gradient(180deg,${liveOutputPreview.tone},rgba(8,14,24,0.94))`,
            }}
          >
            <div style={styles.liveOutputCopy}>
              <div style={styles.liveOutputBadgeRow}>
                <span
                  style={{
                    ...styles.liveOutputBadge,
                    color: liveOutputPreview.accent,
                    borderColor: `${liveOutputPreview.accent}38`,
                    background: `${liveOutputPreview.accent}12`,
                  }}
                >
                  {liveOutputPreview.modeLabel}
                </span>
                <span style={styles.liveOutputStatus}>Currently on screen</span>
              </div>
              <p style={styles.liveOutputTitle}>{liveOutputPreview.title}</p>
              <p style={styles.liveOutputSubtitle}>{liveOutputPreview.subtitle}</p>
              <p style={styles.liveOutputBody}>{liveOutputPreview.body}</p>
              <p style={styles.liveOutputFooter}>{liveOutputPreview.footer}</p>
            </div>

            {liveOutputPreview.thumbnailUrl ? (
              <div
                style={{
                  ...styles.liveOutputVisualImage,
                  backgroundImage: `url("${liveOutputPreview.thumbnailUrl}")`,
                }}
              />
            ) : liveOutputPreview.videoUrl ? (
              <div style={styles.liveOutputVisualMediaFrame}>
                <video
                  src={liveOutputPreview.videoUrl}
                  style={styles.liveOutputVideo}
                  muted
                  playsInline
                  autoPlay
                  loop
                  preload="metadata"
                />
              </div>
            ) : (
              <div
                style={{
                  ...styles.liveOutputVisual,
                  color: liveOutputPreview.accent,
                  borderColor: `${liveOutputPreview.accent}30`,
                  textShadow: `0 0 24px ${liveOutputPreview.accent}40`,
                }}
              >
                {liveOutputPreview.visual}
              </div>
            )}
          </div>
        </div>

        <div style={styles.liveStripMetrics}>
          {metrics.map(metric => (
            <div key={metric.id} style={styles.liveStripMetricCard}>
              <span style={styles.liveStripMetricLabel}>{metric.label}</span>
              <strong style={styles.liveStripMetricValue}>{metric.value}</strong>
              <span style={styles.liveStripMetricMeta}>{metric.meta}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.liveStripSidebar}>
        <div style={styles.systemStatusCard}>
          <div style={styles.systemStatusHeader}>
            <div>
              <span style={styles.liveStripLabel}>System Health</span>
              <p style={styles.liveStripTitle}>{systemStatusLabel}</p>
            </div>
            <span
              style={{
                ...styles.systemStatusBadge,
                color: systemStatusColor,
                borderColor: `${systemStatusColor}33`,
                background: `${systemStatusColor}14`,
              }}
            >
              {lastCheckedLabel}
            </span>
          </div>

          <div style={styles.healthBadgeGrid}>
            {healthServiceBadges.map(service => {
              const color = getHealthStatusColor(service.status)

              return (
                <div key={service.id} style={{ ...styles.healthBadge, borderColor: `${color}2e`, background: `${color}14` }}>
                  <span style={{ ...styles.healthDot, background: color, boxShadow: `0 0 10px ${color}` }} />
                  <span>{service.label}</span>
                </div>
              )
            })}
          </div>

          <button onClick={onViewShortcuts} style={styles.shortcutBtn}>View Shortcuts</button>
        </div>
      </div>
    </div>
  )
}
