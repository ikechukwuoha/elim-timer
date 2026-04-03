import type { CaptionCue } from '@/types'
import type { ControlStyles } from './controlStyles'

type TranscriptProviderMode = 'browser' | 'openai' | 'hybrid'

type CaptionsTabProps = {
  styles: ControlStyles
  isCaptionLive: boolean
  activeCaption: CaptionCue | null
  onShowTimer: () => void
  transcriptListening: boolean
  transcriptReady: boolean
  transcriptStatusLabel: string
  transcriptStatusColor: string
  transcriptProviderMode: TranscriptProviderMode
  transcriptProviderOptions: Array<{ id: TranscriptProviderMode; label: string; available: boolean }>
  transcriptProviderLabel: string
  captionsEnabled: boolean
  onCaptionsEnabledChange: (enabled: boolean) => void
  transcriptError: string
  combinedTranscript: string
  transcriptText: string
  transcriptInterimText: string
  captionSuggestions: CaptionCue[]
  captionDraft: CaptionCue | null
  captionDraftText: string
  onCaptionDraftTextChange: (value: string) => void
  onToggleListening: () => void
  onTranscriptProviderModeChange: (mode: TranscriptProviderMode) => void
  onRefreshSuggestions: () => void
  onDownloadTranscript: () => void
  onDeleteDraft: () => void
  onSaveDraft: () => void
  onSendEditedLive: () => void
  onBeginCaptionEditing: (caption: CaptionCue) => void
  onDismissCaptionSuggestion: (captionId: string) => void
  onClearCaptionCues: () => void
}

export default function CaptionsTab({
  styles,
  isCaptionLive,
  activeCaption,
  onShowTimer,
  transcriptListening,
  transcriptReady,
  transcriptStatusLabel,
  transcriptStatusColor,
  transcriptProviderMode,
  transcriptProviderOptions,
  transcriptProviderLabel,
  captionsEnabled,
  onCaptionsEnabledChange,
  transcriptError,
  combinedTranscript,
  transcriptText,
  transcriptInterimText,
  captionSuggestions,
  captionDraft,
  captionDraftText,
  onCaptionDraftTextChange,
  onToggleListening,
  onTranscriptProviderModeChange,
  onRefreshSuggestions,
  onDownloadTranscript,
  onDeleteDraft,
  onSaveDraft,
  onSendEditedLive,
  onBeginCaptionEditing,
  onDismissCaptionSuggestion,
  onClearCaptionCues,
}: CaptionsTabProps) {
  return (
    <div style={styles.twoCol}>
      <aside style={{ ...styles.left, gap: 12 }}>
        <div style={styles.livePanel}>
          <div style={styles.livePanelHeader}>
            <span style={styles.livePanelTag}>On Screen</span>
            <button onClick={onShowTimer} style={styles.miniActionBtn}>Show Timer</button>
          </div>
          {isCaptionLive && activeCaption ? (
            <>
              <p style={styles.livePanelRef}>{activeCaption.kind === 'quote' ? 'Live Quote' : 'Key Point'}</p>
              <p style={styles.livePanelText}>{activeCaption.text}</p>
            </>
          ) : (
            <p style={styles.livePanelEmpty}>No caption is currently live on the big screen.</p>
          )}
        </div>

        <div style={styles.transcriptCard}>
          <div style={styles.transcriptHeader}>
            <div>
              <p style={styles.sectionTitle}>Caption Engine</p>
              <p style={styles.transcriptMetaText}>Use the sermon transcript to surface quotable moments and key points you can send live.</p>
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
                onClick={onRefreshSuggestions}
                disabled={!transcriptReady}
                style={{ ...styles.transcriptGhostBtn, opacity: transcriptReady ? 1 : 0.5, cursor: transcriptReady ? 'pointer' : 'not-allowed' }}
              >
                Refresh
              </button>
              <button
                onClick={onDownloadTranscript}
                disabled={!transcriptReady}
                style={{ ...styles.transcriptGhostBtn, opacity: transcriptReady ? 1 : 0.5, cursor: transcriptReady ? 'pointer' : 'not-allowed' }}
              >
                Download
              </button>
            </div>
          </div>

          <div style={styles.transcriptStatusRow}>
            <span style={{ ...styles.transcriptStatusBadge, color: transcriptStatusColor, borderColor: `${transcriptStatusColor}30`, background: `${transcriptStatusColor}14` }}>
              <span style={{ ...styles.healthDot, background: transcriptStatusColor, boxShadow: `0 0 10px ${transcriptStatusColor}` }} />
              {transcriptStatusLabel}
            </span>
            <span style={styles.transcriptProviderMeta}>{transcriptProviderLabel}</span>
          </div>

          <div style={styles.transcriptProviderRow}>
            <span style={styles.transcriptProviderMeta}>Select Engine</span>
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

          <label style={styles.transcriptToggle}>
            <input type="checkbox" checked={captionsEnabled} onChange={event => onCaptionsEnabledChange(event.target.checked)} />
            <span>Generate caption cues from the live transcript</span>
          </label>

          {!captionsEnabled && <p style={styles.transcriptErrorText}>Turn on caption generation to start pulling quotable lines and key points from the transcript.</p>}
          {captionsEnabled && <p style={styles.transcriptMetaText}>Detected cues stay in draft until you edit them and press send.</p>}
          {transcriptError && <p style={styles.transcriptErrorText}>{transcriptError}</p>}

          <div style={styles.transcriptBox}>
            {combinedTranscript ? (
              <p style={styles.transcriptText}>
                {transcriptText}
                {transcriptInterimText && <span style={styles.transcriptInterim}> {transcriptInterimText}</span>}
              </p>
            ) : (
              <p style={styles.transcriptPlaceholder}>Start the microphone to build captions from the live sermon transcript.</p>
            )}
          </div>

          <div style={styles.captionStatGrid}>
            <div style={styles.captionStatCard}>
              <span style={styles.captionStatLabel}>Transcript</span>
              <strong style={styles.captionStatValue}>{transcriptReady ? `${transcriptText.length} chars` : 'Waiting'}</strong>
            </div>
            <div style={styles.captionStatCard}>
              <span style={styles.captionStatLabel}>Caption Cues</span>
              <strong style={styles.captionStatValue}>{captionSuggestions.length}</strong>
            </div>
            <div style={styles.captionStatCard}>
              <span style={styles.captionStatLabel}>Draft</span>
              <strong style={styles.captionStatValue}>{captionDraft ? 'Ready' : 'Select cue'}</strong>
            </div>
          </div>
        </div>
      </aside>

      <main style={{ ...styles.right, gap: 14 }}>
        <div style={styles.captionBoardCard}>
          <div style={styles.captionBoardHeader}>
            <div>
              <p style={styles.sectionTitle}>Caption Editor</p>
              <p style={styles.transcriptMetaText}>Edit the text here first. Only the edited draft can go live.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                onClick={onDeleteDraft}
                disabled={!captionDraft}
                style={{
                  ...styles.transcriptGhostBtn,
                  color: '#fca5a5',
                  borderColor: 'rgba(248,113,113,0.18)',
                  background: 'rgba(127,29,29,0.18)',
                  opacity: captionDraft ? 1 : 0.5,
                  cursor: captionDraft ? 'pointer' : 'not-allowed',
                }}
              >
                Delete
              </button>
              <button
                onClick={onSaveDraft}
                disabled={!captionDraft}
                style={{ ...styles.transcriptGhostBtn, opacity: captionDraft ? 1 : 0.5, cursor: captionDraft ? 'pointer' : 'not-allowed' }}
              >
                Save Draft
              </button>
              <button
                onClick={onSendEditedLive}
                disabled={!captionDraft}
                style={{ ...styles.addBtn, padding: '8px 14px', opacity: captionDraft ? 1 : 0.5, cursor: captionDraft ? 'pointer' : 'not-allowed' }}
              >
                Send Edited Live
              </button>
            </div>
          </div>

          {captionDraft ? (
            <div style={styles.captionEditorStack}>
              <div style={styles.captionEditorMetaRow}>
                <span
                  style={{
                    ...styles.transcriptConfidence,
                    color: captionDraft.kind === 'quote' ? '#fbbf24' : '#4ade80',
                    borderColor: captionDraft.kind === 'quote' ? 'rgba(251,191,36,0.28)' : 'rgba(74,222,128,0.28)',
                    background: captionDraft.kind === 'quote' ? 'rgba(251,191,36,0.10)' : 'rgba(74,222,128,0.10)',
                  }}
                >
                  {captionDraft.kind === 'quote' ? 'Quote Draft' : 'Key Point Draft'}
                </span>
                <span style={styles.transcriptSuggestionSnippet}>
                  Detected {new Date(captionDraft.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <textarea
                value={captionDraftText}
                onChange={event => onCaptionDraftTextChange(event.target.value)}
                placeholder="Edit the caption text before sending it live..."
                style={styles.captionDraftInput}
              />
              <p style={styles.transcriptSuggestionSnippet}>Original cue: {captionDraft.sourceText}</p>
            </div>
          ) : (
            <div style={styles.captionEmptyCard}>
              <p style={styles.sectionTitle}>No draft selected</p>
              <p style={styles.transcriptEmptyText}>Pick a cue from the queue below and edit it here before sending it to the big screen.</p>
            </div>
          )}
        </div>

        <div style={styles.captionBoardCard}>
          <div style={styles.captionBoardHeader}>
            <div>
              <p style={styles.sectionTitle}>Caption Queue</p>
              <p style={styles.transcriptMetaText}>Review each cue, then display the best moments live for the congregation.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={onRefreshSuggestions} disabled={!transcriptReady} style={{ ...styles.transcriptGhostBtn, opacity: transcriptReady ? 1 : 0.5, cursor: transcriptReady ? 'pointer' : 'not-allowed' }}>
                Regenerate
              </button>
              <button onClick={onClearCaptionCues} style={styles.transcriptGhostBtn}>Clear Cues</button>
            </div>
          </div>

          {captionSuggestions.length > 0 ? (
            <div style={styles.transcriptSuggestionList}>
              {captionSuggestions.map(caption => (
                <div key={caption.id} style={{ ...styles.transcriptSuggestionCard, borderColor: captionDraft?.id === caption.id ? 'rgba(96,165,250,0.28)' : 'rgba(148,163,184,0.10)', boxShadow: captionDraft?.id === caption.id ? '0 0 0 1px rgba(96,165,250,0.14)' : 'none' }}>
                  <div style={styles.transcriptSuggestionTopRow}>
                    <div>
                      <p style={styles.transcriptSuggestionRef}>{caption.kind === 'quote' ? 'Quotable Quote' : 'Key Point'}</p>
                      <p style={styles.transcriptCaptionText}>{caption.text}</p>
                      <p style={styles.transcriptSuggestionSnippet}>
                        Score {caption.score} · detected {new Date(caption.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span
                      style={{
                        ...styles.transcriptConfidence,
                        color: caption.kind === 'quote' ? '#fbbf24' : '#4ade80',
                        borderColor: caption.kind === 'quote' ? 'rgba(251,191,36,0.28)' : 'rgba(74,222,128,0.28)',
                        background: caption.kind === 'quote' ? 'rgba(251,191,36,0.10)' : 'rgba(74,222,128,0.10)',
                      }}
                    >
                      {caption.kind === 'quote' ? 'Quote' : 'Key Point'}
                    </span>
                  </div>
                  <div style={styles.transcriptSuggestionActions}>
                    <button onClick={() => onBeginCaptionEditing(caption)} style={styles.transcriptGhostBtn}>
                      {captionDraft?.id === caption.id ? 'Editing' : 'Edit'}
                    </button>
                    <button onClick={() => onDismissCaptionSuggestion(caption.id)} style={styles.removeBtn}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.captionEmptyCard}>
              <p style={styles.sectionTitle}>No caption cues yet</p>
              <p style={styles.transcriptEmptyText}>Start the microphone, then turn on caption generation to collect live quotes and key points from the sermon.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
