import type { ReportPeriod, TimerReportRow, TimerReportSession, TimerReportSummary } from './controlConfig'
import type { ControlStyles } from './controlStyles'

const formatSeconds = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes > 0) return `${minutes}m ${String(secs).padStart(2, '0')}s`
  return `${secs}s`
}

const formatDateTime = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatExitReason = (value: string) => {
  if (!value) return '—'
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

type OperatorToolsPanelProps = {
  styles: ControlStyles
  operatorNotes: string
  onOperatorNotesChange: (value: string) => void
  onOperatorNotesBlur: () => void
  onAppendQuickCue: (note: string) => void
  onClearOperatorNotes: () => void
  alertMinistersInput: string
  onAlertMinistersInputChange: (value: string) => void
  alertPosition: 'top' | 'bottom'
  onAlertPositionChange: (value: 'top' | 'bottom') => void
  alertRepeats: number
  onAlertRepeatsChange: (value: number) => void
  alertActive: boolean
  onApplyAlert: () => void
  onToggleAlert: () => void
  reportPeriod: ReportPeriod
  onReportPeriodChange: (value: ReportPeriod) => void
  reportYear: number
  onReportYearChange: (value: number) => void
  reportMonth: number
  onReportMonthChange: (value: number) => void
  reportWeekStart: string
  onReportWeekStartChange: (value: string) => void
  onFetchReport: () => void
  onDownloadReportPdf: () => void
  reportLabel: string
  reportLoading: boolean
  reportError: string
  reportSummary: TimerReportSummary
  reportRows: TimerReportRow[]
  reportSessions: TimerReportSession[]
}

const QUICK_CUES: Array<[label: string, note: string]> = [
  ['🎵 Music Cue', 'Music cue →'],
  ['🎤 Mic Check', 'Mic check needed'],
  ['⏩ Speed Up', 'Speed up — running long'],
  ['🔇 Mute', 'Mute now'],
  ['💡 Lights', 'Adjust lighting'],
  ['📢 Announcement', 'Announcement coming up'],
]

export default function OperatorToolsPanel({
  styles,
  operatorNotes,
  onOperatorNotesChange,
  onOperatorNotesBlur,
  onAppendQuickCue,
  onClearOperatorNotes,
  alertMinistersInput,
  onAlertMinistersInputChange,
  alertPosition,
  onAlertPositionChange,
  alertRepeats,
  onAlertRepeatsChange,
  alertActive,
  onApplyAlert,
  onToggleAlert,
  reportPeriod,
  onReportPeriodChange,
  reportYear,
  onReportYearChange,
  reportMonth,
  onReportMonthChange,
  reportWeekStart,
  onReportWeekStartChange,
  onFetchReport,
  onDownloadReportPdf,
  reportLabel,
  reportLoading,
  reportError,
  reportSummary,
  reportRows,
  reportSessions,
}: OperatorToolsPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={styles.sectionTitle}>Operator Notes</p>
        <span
          style={{
            fontSize: 10,
            color: '#22c55e',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: 10,
            padding: '2px 8px',
          }}
        >
          Local only
        </span>
      </div>

      <textarea
        value={operatorNotes}
        onChange={event => onOperatorNotesChange(event.target.value)}
        onBlur={onOperatorNotesBlur}
        placeholder={'Jot cues, timing notes, or last-minute changes here…\n\nThis is only visible to you — not broadcast to the screen.'}
        style={{
          flex: 1,
          background: '#161618',
          border: '1px solid #252528',
          borderRadius: 10,
          padding: '11px 13px',
          color: '#e2e8f0',
          fontSize: 13,
          fontFamily: 'inherit',
          lineHeight: 1.7,
          outline: 'none',
          resize: 'none',
          minHeight: 160,
        }}
      />

      <p style={{ ...styles.sectionTitle, marginTop: 4 }}>Quick Cues</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {QUICK_CUES.map(([label, note]) => (
          <button
            key={label}
            onClick={() => onAppendQuickCue(note)}
            style={{
              background: '#1c1c1e',
              border: '1px solid #252528',
              borderRadius: 8,
              padding: '7px 8px',
              fontSize: 11,
              color: '#64748b',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={onClearOperatorNotes}
        style={{
          background: 'rgba(153,27,27,0.08)',
          border: '1px solid #7f1d1d',
          borderRadius: 8,
          padding: '6px 0',
          fontSize: 11,
          color: '#f87171',
          cursor: 'pointer',
        }}
      >
        Clear notes
      </button>

      <div style={{ borderTop: '1px solid #1e1e24', paddingTop: 10, marginTop: 10 }}>
        <p style={styles.sectionTitle}>Alert Scroller</p>
        <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4, marginTop: 6 }}>
          Minister names (comma/line-separated)
        </label>
        <textarea
          value={alertMinistersInput}
          onChange={event => onAlertMinistersInputChange(event.target.value)}
          placeholder="Pastor A, Deacon B, Sister C"
          style={{
            width: '100%',
            minHeight: 60,
            background: '#161618',
            border: '1px solid #252528',
            borderRadius: 8,
            padding: '8px',
            color: '#e2e8f0',
            fontSize: 12,
            boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <select
            value={alertPosition}
            onChange={event => onAlertPositionChange(event.target.value as 'top' | 'bottom')}
            style={styles.fullSelect}
          >
            <option value="top">Position: Top</option>
            <option value="bottom">Position: Bottom</option>
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number"
              min={1}
              value={alertRepeats}
              onChange={event => onAlertRepeatsChange(Number(event.target.value))}
              style={{ ...styles.addInput, width: 76 }}
            />
            <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>repeats</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={onApplyAlert} style={{ ...styles.addBtn, flex: 1, fontSize: 12, padding: '6px 0' }}>Apply Alert</button>
          <button onClick={onToggleAlert} style={{ ...styles.ctrlBtn, fontSize: 12, padding: '6px 0' }}>
            {alertActive ? 'Disable Alert' : 'Enable Alert'}
          </button>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #1e1e24', paddingTop: 10, marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <p style={styles.sectionTitle}>Timing Report</p>
          {reportLabel && (
            <span style={{ fontSize: 10, color: '#93c5fd', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {reportLabel}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
          <select
            value={reportPeriod}
            onChange={event => onReportPeriodChange(event.target.value as ReportPeriod)}
            style={styles.fullSelect}
          >
            <option value="monthly">Monthly report</option>
            <option value="weekly">Weekly report</option>
          </select>

          {reportPeriod === 'monthly' ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                min={2020}
                max={2099}
                value={reportYear}
                onChange={event => onReportYearChange(Number(event.target.value))}
                style={{ ...styles.addInput, width: 86 }}
              />
              <input
                type="number"
                min={1}
                max={12}
                value={reportMonth}
                onChange={event => onReportMonthChange(Number(event.target.value))}
                style={{ ...styles.addInput, width: 56 }}
              />
            </div>
          ) : (
            <input
              type="date"
              value={reportWeekStart}
              onChange={event => onReportWeekStartChange(event.target.value)}
              style={styles.addInput}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button onClick={onFetchReport} style={{ ...styles.addBtn, flex: 1, fontSize: 12, padding: '6px 0' }}>
            {reportLoading ? 'Loading…' : 'Generate'}
          </button>
          <button onClick={onDownloadReportPdf} style={{ ...styles.ctrlBtn, fontSize: 12, padding: '6px 10px' }}>
            Download PDF
          </button>
        </div>

        {reportError && <p style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>{reportError}</p>}

        {(reportRows.length > 0 || reportSummary.sessions > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 8 }}>
            {([
              ['Sessions', String(reportSummary.sessions)],
              ['Programme', formatSeconds(reportSummary.total_programme_seconds)],
              ['Additional', formatSeconds(reportSummary.total_additional_seconds)],
              ['Allotted', formatSeconds(reportSummary.total_allotted_seconds)],
              ['Used', formatSeconds(reportSummary.total_used_seconds)],
              ['Overtime', formatSeconds(reportSummary.total_excess_seconds)],
              ['Unused', formatSeconds(reportSummary.total_unused_seconds)],
              ['Unfinished', formatSeconds(reportSummary.total_unfinished_seconds)],
              ['Overtime Sessions', String(reportSummary.overtime_sessions)],
              ['Addl. Sessions', String(reportSummary.additional_time_sessions)],
              ['Early Finish', String(reportSummary.early_finish_sessions)],
              ['Interrupted', String(reportSummary.interrupted_sessions)],
              ['Avg Used', formatSeconds(reportSummary.average_used_seconds)],
              ['Avg Overtime', formatSeconds(reportSummary.average_excess_seconds)],
              ['Longest Run', formatSeconds(reportSummary.longest_session_seconds)],
              ['Longest Overtime', formatSeconds(reportSummary.longest_excess_seconds)],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{ background: '#0f1116', border: '1px solid #1e1e24', borderRadius: 8, padding: '8px 10px' }}>
                <p style={{ margin: 0, fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {reportRows.length > 0 && (
          <div
            style={{
              marginTop: 8,
              maxHeight: 240,
              overflow: 'auto',
              border: '1px solid #1e1e24',
              borderRadius: 8,
              padding: 8,
              background: '#0f1116',
            }}
          >
            <div style={{ minWidth: 760 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr repeat(8, 1fr)',
                  gap: 8,
                  paddingBottom: 6,
                  borderBottom: '1px solid #1e1e24',
                  marginBottom: 6,
                  fontSize: 10,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                <span>Programme</span>
                <span>Sessions</span>
                <span>Programme</span>
                <span>Additional</span>
                <span>Allotted</span>
                <span>Used</span>
                <span>Overtime</span>
                <span>Unused</span>
                <span>Unfinished</span>
              </div>

              {reportRows.map((row, index) => (
                <div
                  key={`${row.service}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr repeat(8, 1fr)',
                    gap: 8,
                    padding: '6px 0',
                    borderBottom: index + 1 < reportRows.length ? '1px solid #16161d' : 'none',
                    fontSize: 11,
                    color: '#cbd5e1',
                  }}
                >
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{row.service}</span>
                  <span>{row.sessions}</span>
                  <span>{formatSeconds(row.total_programme_seconds)}</span>
                  <span>{formatSeconds(row.total_additional_seconds)}</span>
                  <span>{formatSeconds(row.total_allotted_seconds)}</span>
                  <span>{formatSeconds(row.total_used_seconds)}</span>
                  <span>{formatSeconds(row.total_excess_seconds)}</span>
                  <span>{formatSeconds(row.total_unused_seconds)}</span>
                  <span>{formatSeconds(row.total_unfinished_seconds)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {reportSessions.length > 0 && (
          <div
            style={{
              marginTop: 10,
              maxHeight: 280,
              overflow: 'auto',
              border: '1px solid #1e1e24',
              borderRadius: 8,
              padding: 8,
              background: '#0f1116',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ ...styles.sectionTitle, margin: 0 }}>Session Details</p>
              <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {reportSessions.length} log{reportSessions.length === 1 ? '' : 's'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reportSessions.map(session => (
                <div
                  key={session.id}
                  style={{
                    border: '1px solid #1e1e24',
                    borderRadius: 10,
                    padding: '10px 11px',
                    background: 'linear-gradient(180deg,rgba(15,23,42,0.72),rgba(7,10,18,0.78))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{session.service}</span>
                    <span style={{ fontSize: 10, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {formatExitReason(session.exit_reason)}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
                    {([
                      ['Main', formatSeconds(session.programme_seconds)],
                      ['Additional', formatSeconds(session.additional_seconds)],
                      ['Allotted', formatSeconds(session.total_allotted_seconds)],
                      ['Used', formatSeconds(session.used_seconds)],
                      ['Overtime', formatSeconds(session.excess_seconds)],
                      ['Unused', formatSeconds(session.unused_seconds)],
                      ['Unfinished', formatSeconds(session.unfinished_seconds)],
                      ['Operator', session.user || '—'],
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={`${session.id}-${label}`} style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#dbeafe', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 8 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Started</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#cbd5e1' }}>{formatDateTime(session.started_at)}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ended</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#cbd5e1' }}>{formatDateTime(session.ended_at)}</p>
                    </div>
                  </div>

                  {session.notes && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ margin: 0, fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Notes</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{session.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
