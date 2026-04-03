import type { Activity } from '@/types'
import { formatTime } from '@/utils/timerStore'
import OperatorToolsPanel from './OperatorToolsPanel'
import ProgrammePanel from './ProgrammePanel'
import type { ReportPeriod, TimerReportRow, TimerReportSession, TimerReportSummary } from './controlConfig'
import type { ControlStyles } from './controlStyles'

type TimerTheme = {
  bg: string
  text: string
  border: string
  glow: string
}

type TimerSidebarPanelProps = {
  styles: ControlStyles
  theme: TimerTheme
  currentName: string
  displayRemaining: number
  currentDuration: number
  currentIndex: number
  activityCount: number
  progressPercent: number
  running: boolean
  totalMinutes: number
  autoNextBufferSeconds: number
  onPrevious: () => void
  onToggleRunning: () => void
  onNext: () => void
  onResetCurrent: () => void
  onResetAll: () => void
}

type TimerHeroPanelProps = {
  currentName: string
  displayRemaining: number
  progressPercent: number
  themeText: string
  running: boolean
  currentDuration: number
  currentIndex: number
  activityCount: number
  currentAdditionalMinutes: number
}

type SessionOverviewPanelProps = {
  styles: ControlStyles
  elapsedMinutes: number
  remainingMinutes: number
  completedItems: number
  activityCount: number
  totalMinutes: number
  activities: Activity[]
  currentIndex: number
  accentColor: string
}

type TimerTabProps = {
  styles: ControlStyles
  theme: TimerTheme
  current: {
    name: string
    duration: number
  }
  displayRemaining: number
  progressPercent: number
  running: boolean
  currentIndex: number
  activities: Activity[]
  totalMinutes: number
  elapsedMinutes: number
  remainingMinutes: number
  currentAdditionalMinutes: number
  autoNextBufferSeconds: number
  additionalTimeOptions: number[]
  additionalTimeMinutes: number
  durationOptions: number[]
  newActivityName: string
  newActivityDuration: number
  editingNameId: number | null
  editingNameValue: string
  editingDurationId: number | null
  draggedActivityId: number | null
  dragOverActivityId: number | null
  onPrevious: () => void
  onToggleRunning: () => void
  onNext: () => void
  onResetCurrent: () => void
  onResetAll: () => void
  onAddAdditionalTime: () => void
  onAdditionalTimeMinutesChange: (value: number) => void
  onNewActivityNameChange: (value: string) => void
  onNewActivityDurationChange: (value: number) => void
  onAddActivity: () => void
  onSelectActivity: (index: number) => void
  onActivityDragOver: (activityId: number) => void
  onActivityDrop: (activityId: number) => void
  onActivityDragStart: (activityId: number) => void
  onActivityDragEnd: () => void
  onEditingNameValueChange: (value: string) => void
  onBeginRenameActivity: (activity: Activity) => void
  onCommitRenameActivity: (activityId: number) => void
  onCancelRenameActivity: () => void
  onBeginDurationEdit: (activityId: number) => void
  onUpdateDuration: (activityId: number, duration: number) => void
  onRemoveActivity: (activityId: number) => void
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

function TimerSidebarPanel({
  styles,
  theme,
  currentName,
  displayRemaining,
  currentDuration,
  currentIndex,
  activityCount,
  progressPercent,
  running,
  totalMinutes,
  autoNextBufferSeconds,
  onPrevious,
  onToggleRunning,
  onNext,
  onResetCurrent,
  onResetAll,
}: TimerSidebarPanelProps) {
  return (
    <>
      <div style={{ ...styles.timerCard, background: theme.bg, borderColor: theme.border, boxShadow: `0 0 24px ${theme.glow}` }}>
        <p style={styles.activityLabel}>{currentName}</p>
        <p style={{ ...styles.clockDisplay, color: theme.text }}>{formatTime(displayRemaining)}</p>
        {displayRemaining < 0 && (
          <p
            style={{
              color: '#f87171',
              fontSize: 11,
              textAlign: 'center',
              marginTop: 4,
              letterSpacing: '0.2em',
              fontWeight: 700,
            }}
          >
            OVERTIME
          </p>
        )}
        <p style={styles.clockMeta}>Activity {currentIndex + 1} of {activityCount} · {currentDuration} min</p>
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progressPercent}%`,
              background: `linear-gradient(90deg, ${theme.text}99, ${theme.text})`,
            }}
          />
        </div>
        <div style={styles.legend}>
          <span style={{ color: '#22c55e' }}>● Plenty</span>
          <span style={{ color: '#fbbf24' }}>● Almost</span>
          <span style={{ color: '#f87171' }}>● Up</span>
        </div>
      </div>

      <div style={styles.controlRow}>
        <button onClick={onPrevious} style={styles.ctrlBtn}>◀ Prev</button>
        <button
          onClick={onToggleRunning}
          style={{
            ...styles.ctrlBtn,
            ...styles.primaryBtn,
            background: running ? 'linear-gradient(135deg,#991b1b,#7f1d1d)' : 'linear-gradient(135deg,#166534,#14532d)',
            borderColor: running ? '#7f1d1d' : '#14532d',
            boxShadow: running ? '0 2px 12px rgba(153,27,27,0.3)' : '0 2px 12px rgba(22,101,52,0.3)',
          }}
        >
          {running ? '⏸ Pause' : '▶ Start'}
        </button>
        <button onClick={onNext} style={styles.ctrlBtn}>Next ▶</button>
      </div>

      <div style={styles.controlRow}>
        <button onClick={onResetCurrent} style={styles.ctrlBtn}>↺ Reset</button>
        <button
          onClick={onResetAll}
          style={{
            ...styles.ctrlBtn,
            color: '#f87171',
            borderColor: '#7f1d1d',
            background: 'rgba(153,27,27,0.1)',
          }}
        >
          ⬛ Reset All
        </button>
      </div>

      <div style={styles.summaryCard}>
        {([
          ['Total', `${totalMinutes} min`],
          ['Activities', String(activityCount)],
          ['Status', running ? `● LIVE · Auto-next ${autoNextBufferSeconds}s` : '● Paused'],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} style={styles.summaryRow}>
            <span style={{ color: '#64748b' }}>{label}</span>
            <span style={{ color: label === 'Status' ? (running ? '#4ade80' : '#64748b') : '#e2e8f0' }}>{value}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function TimerHeroPanel({
  currentName,
  displayRemaining,
  progressPercent,
  themeText,
  running,
  currentDuration,
  currentIndex,
  activityCount,
  currentAdditionalMinutes,
}: TimerHeroPanelProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        background: 'linear-gradient(135deg,rgba(16,24,39,0.96),rgba(11,18,32,0.92))',
        border: '1px solid rgba(148,163,184,0.10)',
        borderRadius: 22,
        padding: 22,
        flexShrink: 0,
        boxShadow: '0 18px 36px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ position: 'relative', width: 118, height: 118, flexShrink: 0 }}>
        <svg width="118" height="118" viewBox="0 0 118 118" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="59" cy="59" r="50" fill="none" strokeWidth="7" stroke="rgba(255,255,255,0.05)" />
          <circle
            cx="59"
            cy="59"
            r="50"
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            stroke={themeText}
            strokeDasharray="314"
            strokeDashoffset={String((314 * (1 - progressPercent / 100)).toFixed(1))}
            style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.6s' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--font-bebas), cursive',
              fontSize: 28,
              color: themeText,
              lineHeight: 1,
              letterSpacing: '0.04em',
              transition: 'color 0.6s',
            }}
          >
            {formatTime(displayRemaining)}
          </span>
          <span style={{ fontSize: 9, color: '#475569', letterSpacing: '0.18em', marginTop: 3, textTransform: 'uppercase' }}>
            remaining
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, marginBottom: 5 }}>
          Now Playing
        </p>
        <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 10 }}>
          {currentName}
        </p>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            padding: '4px 12px',
            borderRadius: 20,
            fontWeight: 600,
            letterSpacing: '0.06em',
            background: running ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
            color: running ? '#4ade80' : '#64748b',
            border: `1px solid ${running ? 'rgba(34,197,94,0.25)' : 'rgba(100,116,139,0.2)'}`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: running ? '#4ade80' : '#475569',
              display: 'inline-block',
            }}
          />
          {running ? 'Live' : 'Paused'}
        </span>
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', marginTop: 12, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              borderRadius: 2,
              width: `${progressPercent}%`,
              background: `linear-gradient(90deg,${themeText}70,${themeText})`,
              transition: 'width 0.9s linear, background 0.6s',
            }}
          />
        </div>
        <p style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>
          {currentDuration + currentAdditionalMinutes} min allocated · item {currentIndex + 1} of {activityCount}
        </p>
        {currentAdditionalMinutes > 0 && (
          <p style={{ fontSize: 11, color: '#fcd34d', marginTop: 6 }}>
            Additional time added: +{currentAdditionalMinutes} min
          </p>
        )}
      </div>
    </div>
  )
}

function SessionOverviewPanel({
  styles,
  elapsedMinutes,
  remainingMinutes,
  completedItems,
  activityCount,
  totalMinutes,
  activities,
  currentIndex,
  accentColor,
}: SessionOverviewPanelProps) {
  return (
    <div
      style={{
        background: 'linear-gradient(180deg,rgba(13,19,31,0.94),rgba(8,12,21,0.92))',
        border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: 18,
        padding: '18px 20px',
        flexShrink: 0,
        boxShadow: '0 16px 32px rgba(0,0,0,0.18)',
      }}
    >
      <p style={{ ...styles.sectionTitle, marginBottom: 12 }}>Session Overview</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        {([
          ['Elapsed', `${elapsedMinutes}m`, '#64748b'],
          ['Remaining', `${remainingMinutes}m`, '#e2e8f0'],
          ['Items Done', `${completedItems} / ${activityCount}`, '#94a3b8'],
          ['Total', `${totalMinutes}m`, '#475569'],
        ] as [string, string, string][]).map(([label, value, color]) => (
          <div key={label} style={{ background: '#0f0f11', border: '1px solid #1e1e24', borderRadius: 9, padding: '10px 12px' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: 10, color: '#334155', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 2, height: 5, borderRadius: 3, overflow: 'hidden' }}>
        {activities.map((activity, index) => (
          <div
            key={activity.id}
            style={{
              flex: activity.duration,
              borderRadius: 2,
              background:
                index < currentIndex
                  ? 'rgba(34,197,94,0.35)'
                  : index === currentIndex
                    ? accentColor
                    : 'rgba(255,255,255,0.05)',
              transition: 'background 0.5s',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: '#334155' }}>Start</span>
        <span style={{ fontSize: 10, color: '#334155' }}>{totalMinutes} min</span>
      </div>
    </div>
  )
}

export default function TimerTab({
  styles,
  theme,
  current,
  displayRemaining,
  progressPercent,
  running,
  currentIndex,
  activities,
  totalMinutes,
  elapsedMinutes,
  remainingMinutes,
  currentAdditionalMinutes,
  autoNextBufferSeconds,
  additionalTimeOptions,
  additionalTimeMinutes,
  durationOptions,
  newActivityName,
  newActivityDuration,
  editingNameId,
  editingNameValue,
  editingDurationId,
  draggedActivityId,
  dragOverActivityId,
  onPrevious,
  onToggleRunning,
  onNext,
  onResetCurrent,
  onResetAll,
  onAddAdditionalTime,
  onAdditionalTimeMinutesChange,
  onNewActivityNameChange,
  onNewActivityDurationChange,
  onAddActivity,
  onSelectActivity,
  onActivityDragOver,
  onActivityDrop,
  onActivityDragStart,
  onActivityDragEnd,
  onEditingNameValueChange,
  onBeginRenameActivity,
  onCommitRenameActivity,
  onCancelRenameActivity,
  onBeginDurationEdit,
  onUpdateDuration,
  onRemoveActivity,
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
}: TimerTabProps) {
  return (
    <div style={styles.twoCol}>
      <aside style={styles.left}>
        <TimerSidebarPanel
          styles={styles}
          theme={theme}
          currentName={current.name}
          displayRemaining={displayRemaining}
          currentDuration={current.duration}
          currentIndex={currentIndex}
          activityCount={activities.length}
          progressPercent={progressPercent}
          running={running}
          totalMinutes={totalMinutes}
          autoNextBufferSeconds={autoNextBufferSeconds}
          onPrevious={onPrevious}
          onToggleRunning={onToggleRunning}
          onNext={onNext}
          onResetCurrent={onResetCurrent}
          onResetAll={onResetAll}
        />
      </aside>

      <main style={{ ...styles.right, gap: 14 }}>
        <TimerHeroPanel
          currentName={current.name}
          displayRemaining={displayRemaining}
          progressPercent={progressPercent}
          themeText={theme.text}
          running={running}
          currentDuration={current.duration}
          currentIndex={currentIndex}
          activityCount={activities.length}
          currentAdditionalMinutes={currentAdditionalMinutes}
        />

        <SessionOverviewPanel
          styles={styles}
          elapsedMinutes={elapsedMinutes}
          remainingMinutes={remainingMinutes}
          completedItems={currentIndex}
          activityCount={activities.length}
          totalMinutes={totalMinutes}
          activities={activities}
          currentIndex={currentIndex}
          accentColor={theme.text}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1, minHeight: 0 }}>
          <ProgrammePanel
            styles={styles}
            currentName={current.name}
            currentAdditionalMinutes={currentAdditionalMinutes}
            activities={activities}
            currentIndex={currentIndex}
            themeText={theme.text}
            themeGlow={theme.glow}
            additionalTimeOptions={additionalTimeOptions}
            additionalTimeMinutes={additionalTimeMinutes}
            durationOptions={durationOptions}
            onAddAdditionalTime={onAddAdditionalTime}
            onAdditionalTimeMinutesChange={onAdditionalTimeMinutesChange}
            newActivityName={newActivityName}
            newActivityDuration={newActivityDuration}
            editingNameId={editingNameId}
            editingNameValue={editingNameValue}
            editingDurationId={editingDurationId}
            draggedActivityId={draggedActivityId}
            dragOverActivityId={dragOverActivityId}
            onNewActivityNameChange={onNewActivityNameChange}
            onNewActivityDurationChange={onNewActivityDurationChange}
            onAddActivity={onAddActivity}
            onSelectActivity={onSelectActivity}
            onActivityDragOver={onActivityDragOver}
            onActivityDrop={onActivityDrop}
            onActivityDragStart={onActivityDragStart}
            onActivityDragEnd={onActivityDragEnd}
            onEditingNameValueChange={onEditingNameValueChange}
            onBeginRenameActivity={onBeginRenameActivity}
            onCommitRenameActivity={onCommitRenameActivity}
            onCancelRenameActivity={onCancelRenameActivity}
            onBeginDurationEdit={onBeginDurationEdit}
            onUpdateDuration={onUpdateDuration}
            onRemoveActivity={onRemoveActivity}
          />

          <OperatorToolsPanel
            styles={styles}
            operatorNotes={operatorNotes}
            onOperatorNotesChange={onOperatorNotesChange}
            onOperatorNotesBlur={onOperatorNotesBlur}
            onAppendQuickCue={onAppendQuickCue}
            onClearOperatorNotes={onClearOperatorNotes}
            alertMinistersInput={alertMinistersInput}
            onAlertMinistersInputChange={onAlertMinistersInputChange}
            alertPosition={alertPosition}
            onAlertPositionChange={onAlertPositionChange}
            alertRepeats={alertRepeats}
            onAlertRepeatsChange={onAlertRepeatsChange}
            alertActive={alertActive}
            onApplyAlert={onApplyAlert}
            onToggleAlert={onToggleAlert}
            reportPeriod={reportPeriod}
            onReportPeriodChange={onReportPeriodChange}
            reportYear={reportYear}
            onReportYearChange={onReportYearChange}
            reportMonth={reportMonth}
            onReportMonthChange={onReportMonthChange}
            reportWeekStart={reportWeekStart}
            onReportWeekStartChange={onReportWeekStartChange}
            onFetchReport={onFetchReport}
            onDownloadReportPdf={onDownloadReportPdf}
            reportLabel={reportLabel}
            reportLoading={reportLoading}
            reportError={reportError}
            reportSummary={reportSummary}
            reportRows={reportRows}
            reportSessions={reportSessions}
          />
        </div>
      </main>
    </div>
  )
}
