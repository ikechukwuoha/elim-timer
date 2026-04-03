import type { ScriptureSuggestion } from '@/utils/scriptureDetection'
import type { ControlStyles } from './controlStyles'

type QueuedScriptureSuggestion = ScriptureSuggestion & {
  queuedAt: number
}

type TranscriptProviderMode = 'browser' | 'openai' | 'hybrid'

type ScriptureAssistPanelProps = {
  styles: ControlStyles
  transcriptListening: boolean
  transcriptReady: boolean
  transcriptSupported: boolean
  transcriptStatusLabel: string
  transcriptStatusColor: string
  transcriptProviderMode: TranscriptProviderMode
  transcriptProviderOptions: Array<{ id: TranscriptProviderMode; label: string; available: boolean }>
  transcriptProviderLabel: string
  transcriptProviderDetail: string
  autoDisplayScriptures: boolean
  transcriptError: string
  transcriptText: string
  transcriptInterimText: string
  combinedTranscript: string
  captionSuggestionCount: number
  scriptureSuggestions: QueuedScriptureSuggestion[]
  onToggleListening: () => void
  onTranscriptProviderModeChange: (mode: TranscriptProviderMode) => void
  onDownload: () => void
  onClear: () => void
  onToggleAutoDisplay: (enabled: boolean) => void
  onOpenCaptions: () => void
  onOpenSuggestion: (suggestion: QueuedScriptureSuggestion) => void
  onDisplaySuggestion: (suggestion: QueuedScriptureSuggestion) => void
  onDismissSuggestion: (canonicalId: string) => void
}

export default function ScriptureAssistPanel({
  styles,
  transcriptListening,
  transcriptReady,
  transcriptSupported,
  transcriptStatusLabel,
  transcriptStatusColor,
  transcriptProviderMode,
  transcriptProviderOptions,
  transcriptProviderLabel,
  transcriptProviderDetail,
  autoDisplayScriptures,
  transcriptError,
  transcriptText,
  transcriptInterimText,
  combinedTranscript,
  captionSuggestionCount,
  scriptureSuggestions,
  onToggleListening,
  onTranscriptProviderModeChange,
  onDownload,
  onClear,
  onToggleAutoDisplay,
  onOpenCaptions,
  onOpenSuggestion,
  onDisplaySuggestion,
  onDismissSuggestion,
}: ScriptureAssistPanelProps) {
  return (
    <div style={styles.transcriptCard}>
      <div style={styles.transcriptHeader}>
        <div>
          <p style={styles.sectionTitle}>Live Scripture Assist</p>
          <p style={styles.transcriptMetaText}>
            The microphone stays light on the control screen, and OpenAI can quietly refine scripture and caption detection in the background when it is configured.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={onToggleListening}
            style={{
              ...styles.miniActionBtn,
              background: transcriptListening ? 'rgba(127,29,29,0.32)' : 'rgba(13,31,57,0.82)',
              borderColor: transcriptListening ? 'rgba(248,113,113,0.22)' : 'rgba(96,165,250,0.18)',
              color: transcriptListening ? '#fecaca' : '#bfdbfe',
            }}
          >
            {transcriptListening ? 'Stop Mic' : 'Start Mic'}
          </button>
          <button
            onClick={onDownload}
            disabled={!transcriptReady}
            style={{
              ...styles.transcriptGhostBtn,
              opacity: transcriptReady ? 1 : 0.5,
              cursor: transcriptReady ? 'pointer' : 'not-allowed',
            }}
          >
            Download
          </button>
          <button onClick={onClear} style={styles.transcriptGhostBtn}>Clear</button>
        </div>
      </div>

      <div style={styles.transcriptStatusRow}>
        <span
          style={{
            ...styles.transcriptStatusBadge,
            color: transcriptStatusColor,
            borderColor: `${transcriptStatusColor}30`,
            background: `${transcriptStatusColor}14`,
          }}
        >
          <span
            style={{
              ...styles.healthDot,
              background: transcriptStatusColor,
              boxShadow: `0 0 10px ${transcriptStatusColor}`,
            }}
          />
          {transcriptStatusLabel}
        </span>
        <label style={styles.transcriptToggle}>
          <input
            type="checkbox"
            checked={autoDisplayScriptures}
            onChange={event => onToggleAutoDisplay(event.target.checked)}
            disabled={!transcriptSupported}
          />
          <span>Auto-display high-confidence verses</span>
        </label>
      </div>

      <div style={styles.transcriptProviderRow}>
        <span style={styles.transcriptProviderMeta}>{transcriptProviderLabel}</span>
        <div style={styles.transcriptProviderSwitch}>
          {transcriptProviderOptions.map(option => {
            const active = option.id === transcriptProviderMode
            return (
              <button
                key={option.id}
                onClick={() => onTranscriptProviderModeChange(option.id)}
                disabled={!option.available}
                style={{
                  ...styles.transcriptProviderPill,
                  ...(active ? styles.transcriptProviderPillActive : null),
                  opacity: option.available ? 1 : 0.42,
                  cursor: option.available ? 'pointer' : 'not-allowed',
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <p style={{ ...styles.transcriptMetaText, marginTop: 0 }}>{transcriptProviderDetail}</p>

      {!transcriptSupported && (
        <p style={styles.transcriptErrorText}>
          Live transcription needs a browser with speech recognition support, such as Chrome or Edge on desktop.
        </p>
      )}
      {transcriptError && (
        <p style={styles.transcriptErrorText}>{transcriptError}</p>
      )}

      <div style={styles.transcriptBox}>
        {combinedTranscript ? (
          <p style={styles.transcriptText}>
            {transcriptText}
            {transcriptInterimText && <span style={styles.transcriptInterim}> {transcriptInterimText}</span>}
          </p>
        ) : (
          <p style={styles.transcriptPlaceholder}>
            Start the microphone and the live sermon transcript will appear here.
          </p>
        )}
      </div>

      <div style={styles.transcriptSuggestionHeader}>
        <span style={styles.transcriptSuggestionCount}>
          {captionSuggestionCount} caption cue{captionSuggestionCount === 1 ? '' : 's'}
        </span>
        <button onClick={onOpenCaptions} style={styles.linkBtn}>Open captions</button>
      </div>

      <div style={styles.transcriptSuggestionHeader}>
        <p style={styles.sectionTitle}>Detected Scriptures</p>
        <span style={styles.transcriptSuggestionCount}>{scriptureSuggestions.length} queued</span>
      </div>
      {scriptureSuggestions.length > 0 ? (
        <div style={styles.transcriptSuggestionList}>
          {scriptureSuggestions.map(suggestion => (
            <div key={suggestion.canonicalId} style={styles.transcriptSuggestionCard}>
              <div style={styles.transcriptSuggestionTopRow}>
                <div>
                  <p style={styles.transcriptSuggestionRef}>{suggestion.reference}</p>
                  <p style={styles.transcriptSuggestionSnippet}>{suggestion.snippet}</p>
                </div>
                <span
                  style={{
                    ...styles.transcriptConfidence,
                    color: suggestion.confidence === 'high' ? '#4ade80' : '#fbbf24',
                    borderColor: suggestion.confidence === 'high' ? 'rgba(74,222,128,0.28)' : 'rgba(251,191,36,0.28)',
                    background: suggestion.confidence === 'high' ? 'rgba(74,222,128,0.10)' : 'rgba(251,191,36,0.10)',
                  }}
                >
                  {suggestion.confidence}
                </span>
              </div>
              <div style={styles.transcriptSuggestionActions}>
                <button onClick={() => onOpenSuggestion(suggestion)} style={styles.transcriptGhostBtn}>
                  Open
                </button>
                {suggestion.kind === 'verse' && (
                  <button
                    onClick={() => onDisplaySuggestion(suggestion)}
                    style={{ ...styles.addBtn, padding: '7px 12px', fontSize: 11 }}
                  >
                    Display
                  </button>
                )}
                <button onClick={() => onDismissSuggestion(suggestion.canonicalId)} style={styles.removeBtn}>✕</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={styles.transcriptEmptyText}>
          No scripture references detected yet. As the message continues, likely references will appear here.
        </p>
      )}
    </div>
  )
}
