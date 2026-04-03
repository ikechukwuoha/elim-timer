import type { Activity } from '@/types'
import type { ControlStyles } from './controlStyles'

type ProgrammePanelProps = {
  styles: ControlStyles
  currentName: string
  currentAdditionalMinutes: number
  activities: Activity[]
  currentIndex: number
  themeText: string
  themeGlow: string
  additionalTimeOptions: number[]
  additionalTimeMinutes: number
  durationOptions: number[]
  onAddAdditionalTime: () => void
  onAdditionalTimeMinutesChange: (value: number) => void
  newActivityName: string
  newActivityDuration: number
  editingNameId: number | null
  editingNameValue: string
  editingDurationId: number | null
  draggedActivityId: number | null
  dragOverActivityId: number | null
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
}

export default function ProgrammePanel({
  styles,
  currentName,
  currentAdditionalMinutes,
  activities,
  currentIndex,
  themeText,
  themeGlow,
  additionalTimeOptions,
  additionalTimeMinutes,
  durationOptions,
  onAddAdditionalTime,
  onAdditionalTimeMinutesChange,
  newActivityName,
  newActivityDuration,
  editingNameId,
  editingNameValue,
  editingDurationId,
  draggedActivityId,
  dragOverActivityId,
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
}: ProgrammePanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 14,
          border: '1px solid rgba(251,191,36,0.18)',
          background: 'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(15,23,42,0.82))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <p style={{ ...styles.sectionTitle, marginBottom: 4, color: '#fcd34d' }}>Additional Time</p>
            <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>
              Add more time to <strong>{currentName}</strong> without restarting the timer.
            </p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: currentAdditionalMinutes > 0 ? '#fcd34d' : '#94a3b8' }}>
            {currentAdditionalMinutes > 0 ? `+${currentAdditionalMinutes} min active` : 'No extra time yet'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <select
            value={additionalTimeMinutes}
            onChange={event => onAdditionalTimeMinutesChange(Number(event.target.value))}
            style={{ ...styles.addSelect, width: 116 }}
          >
            {additionalTimeOptions.map(duration => (
              <option key={duration} value={duration}>+{duration} min</option>
            ))}
          </select>
          <button
            onClick={onAddAdditionalTime}
            style={{
              ...styles.addBtn,
              padding: '10px 16px',
              background: 'linear-gradient(135deg,#f59e0b,#d97706)',
              borderColor: '#f59e0b',
              color: '#111827',
            }}
          >
            Add Extra Time
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <p style={styles.sectionTitle}>Programme</p>
        <span style={{ fontSize: 10, color: '#475569' }}>Drag to reorder. Edit names and durations anytime.</span>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="New activity name…"
          value={newActivityName}
          onChange={event => onNewActivityNameChange(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && onAddActivity()}
          style={{ ...styles.addInput, flex: 1, minWidth: 0 }}
        />
        <select
          value={newActivityDuration}
          onChange={event => onNewActivityDurationChange(Number(event.target.value))}
          style={{ ...styles.addSelect, flexShrink: 0, width: 68 }}
        >
          {durationOptions.map(duration => (
            <option key={duration} value={duration}>{duration}m</option>
          ))}
        </select>
        <button onClick={onAddActivity} style={{ ...styles.addBtn, flexShrink: 0, padding: '10px 14px' }}>Add</button>
      </div>

      <div style={{ ...styles.activityList, flex: 1, overflowY: 'auto' }}>
        {activities.map((activity, index) => {
          const isActive = index === currentIndex
          const isPast = index < currentIndex
          const isDragTarget = dragOverActivityId === activity.id && draggedActivityId !== activity.id
          const isDragging = draggedActivityId === activity.id

          return (
            <div
              key={activity.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectActivity(index)}
              onKeyDown={event => event.key === 'Enter' && onSelectActivity(index)}
              onDragOver={event => {
                event.preventDefault()
                if (draggedActivityId !== activity.id) onActivityDragOver(activity.id)
              }}
              onDrop={event => {
                event.preventDefault()
                event.stopPropagation()
                onActivityDrop(activity.id)
              }}
              style={{
                ...styles.activityRow,
                background: isDragTarget
                  ? 'linear-gradient(135deg,rgba(21,128,61,0.22),rgba(15,23,42,0.96))'
                  : isActive
                    ? 'linear-gradient(135deg,#1e3a2a,#172d20)'
                    : isPast
                      ? '#141414'
                      : '#1c1c1e',
                borderColor: isDragTarget ? '#22c55e' : isActive ? '#166534' : '#252528',
                opacity: isDragging ? 0.55 : isPast ? 0.45 : 1,
                boxShadow: isDragTarget
                  ? '0 0 0 1px rgba(34,197,94,0.2), 0 8px 20px rgba(34,197,94,0.12)'
                  : isActive
                    ? `0 2px 12px ${themeGlow}`
                    : 'none',
                transform: isDragTarget ? 'translateY(-1px)' : 'none',
              }}
            >
              <span
                style={{
                  ...styles.indexBadge,
                  background: isActive ? themeText : isPast ? 'transparent' : '#252528',
                  color: isActive ? '#000' : isPast ? '#334155' : '#4a4a55',
                }}
              >
                {isPast ? '✓' : isActive ? '▶' : index + 1}
              </span>

              <button
                draggable
                onClick={event => event.stopPropagation()}
                onDragStart={event => {
                  event.stopPropagation()
                  onActivityDragStart(activity.id)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', String(activity.id))
                }}
                onDragEnd={onActivityDragEnd}
                title="Drag to reorder"
                style={styles.dragHandle}
              >
                ::
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                {editingNameId === activity.id ? (
                  <input
                    type="text"
                    value={editingNameValue}
                    autoFocus
                    onChange={event => onEditingNameValueChange(event.target.value)}
                    onClick={event => event.stopPropagation()}
                    onBlur={() => onCommitRenameActivity(activity.id)}
                    onKeyDown={event => {
                      event.stopPropagation()
                      if (event.key === 'Enter') onCommitRenameActivity(activity.id)
                      if (event.key === 'Escape') onCancelRenameActivity()
                    }}
                    style={{
                      ...styles.activityNameInput,
                      color: isActive ? '#fff' : '#e2e8f0',
                    }}
                  />
                ) : (
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: isActive ? '#fff' : '#a1a1aa',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      margin: 0,
                    }}
                  >
                    {activity.name}
                  </p>
                )}
              </div>

              {editingNameId !== activity.id && (
                <button
                  onClick={event => {
                    event.stopPropagation()
                    onBeginRenameActivity(activity)
                  }}
                  style={styles.inlineActionBtn}
                >
                  Edit
                </button>
              )}

              {editingDurationId === activity.id ? (
                <select
                  defaultValue={activity.duration}
                  autoFocus
                  onBlur={event => onUpdateDuration(activity.id, Number(event.target.value))}
                  onChange={event => onUpdateDuration(activity.id, Number(event.target.value))}
                  onClick={event => event.stopPropagation()}
                  style={styles.durationSelect}
                >
                  {durationOptions.map(duration => (
                    <option key={duration} value={duration}>{duration}m</option>
                  ))}
                </select>
              ) : (
                <span
                  style={styles.durationBadge}
                  title="Click to edit"
                  onClick={event => {
                    event.stopPropagation()
                    onBeginDurationEdit(activity.id)
                  }}
                >
                  {activity.duration}m
                </span>
              )}

              <button
                onClick={event => {
                  event.stopPropagation()
                  onRemoveActivity(activity.id)
                }}
                style={styles.removeBtn}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
