import type { ChangeEventHandler, RefObject } from 'react'
import type { BibleBackground, BibleDisplayMode, BibleVerse } from '@/types'
import type { BibleTranslation, BibleBook } from '@/utils/bibleApi'
import { BOOK_ID_MAP } from '@/utils/bibleApi'
import type { ScriptureSuggestion } from '@/utils/scriptureDetection'
import OnScreenScripturePanel from './OnScreenScripturePanel'
import ScriptureAssistPanel from './ScriptureAssistPanel'
import type { ControlStyles } from './controlStyles'

type BibleSearchHit = {
  book: string
  bookId: string
  chapter: number
  verse: number
  text: string
  translation: string
  reference: string
  score?: number
  matchedTerms?: string[]
}

type HighlightedSegment = {
  text: string
  highlight: boolean
}

type QueuedScriptureSuggestion = ScriptureSuggestion & {
  queuedAt: number
}

type TranscriptProviderMode = 'browser' | 'openai' | 'hybrid'

type BibleTabProps = {
  styles: ControlStyles
  activeVerse: BibleVerse | null
  activeSecondaryVerse: BibleVerse | null
  bibleDisplayMode: BibleDisplayMode
  bibleBackgrounds: BibleBackground[]
  activeBibleBackgroundId: string
  bibleTextColor: string
  bibleTextColorOptions: Array<{ id: string; label: string; value: string }>
  bibleFontFamilyId: string
  bibleFontOptions: Array<{ id: string; label: string; family: string }>
  bibleFontScale: number
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
  onDownloadTranscript: () => void
  onClearTranscriptAssist: () => void
  onToggleAutoDisplay: (enabled: boolean) => void
  onOpenCaptions: () => void
  onOpenSuggestion: (suggestion: QueuedScriptureSuggestion) => void
  onDisplaySuggestion: (suggestion: QueuedScriptureSuggestion) => void
  onDismissSuggestion: (canonicalId: string) => void
  quickRef: string
  onQuickRefChange: (value: string) => void
  quickRefSuggestion: { book: string; value: string } | null
  onAcceptQuickRefSuggestion: () => void
  onSubmitQuickRef: () => void
  quickRefError: string
  keywordSearchInputRef: RefObject<HTMLInputElement | null>
  keywordSearch: string
  onKeywordSearchChange: (value: string) => void
  onRunKeywordSearch: () => void
  keywordSearching: boolean
  keywordSearchProgress: string
  keywordSearchError: string
  keywordResults: BibleSearchHit[]
  highlightTerms: (text: string, terms: string[]) => HighlightedSegment[]
  onOpenKeywordHit: (hit: BibleSearchHit) => void
  translations: BibleTranslation[]
  filteredTranslations: BibleTranslation[]
  selectedTranslation: string
  translationSearch: string
  onTranslationSearchChange: (value: string) => void
  showTranslationList: boolean
  onShowTranslationList: () => void
  onHideTranslationList: () => void
  onLoadTranslations: () => void
  onSelectTranslation: (translationId: string) => void
  selectedSecondaryTranslation: string
  secondaryTranslationSearch: string
  filteredSecondaryTranslations: BibleTranslation[]
  showSecondaryTranslationList: boolean
  onSecondaryTranslationSearchChange: (value: string) => void
  onShowSecondaryTranslationList: () => void
  onHideSecondaryTranslationList: () => void
  onSelectSecondaryTranslation: (translationId: string) => void
  onBibleDisplayModeChange: (displayMode: BibleDisplayMode) => void
  onBibleBackgroundUpload: ChangeEventHandler<HTMLInputElement>
  onSelectBibleBackground: (backgroundId: string) => void
  onDeleteBibleBackground: (backgroundId: string) => void
  onBibleTextColorChange: (color: string) => void
  onBibleFontFamilyChange: (fontFamilyId: string) => void
  onBibleFontScaleChange: (fontScale: number) => void
  selectedBook: string
  selectedBookId: string
  bookSearch: string
  onBookSearchChange: (value: string) => void
  showBookList: boolean
  onShowBookList: () => void
  onHideBookList: () => void
  filteredBooks: BibleBook[]
  onSelectBook: (bookName: string, bookId: string) => void
  selectedChapter: number
  chapterInput: string
  onChapterInputChange: (value: string) => void
  maxChapterCount: number
  onCommitChapterInput: () => void
  onJumpToChapter: (chapter: number) => void
  canGoPrevChapter: boolean
  canGoNextChapter: boolean
  chapterViewVerses: Array<{ verse: number; text: string }>
  bibleLoading: boolean
  activeVerseIndex: number
  canGoPrevVerse: boolean
  canGoNextVerse: boolean
  onJumpToVerse: (direction: number) => void
  onDisplayVerse: (verse: BibleVerse) => void
}

export default function BibleTab({
  styles,
  activeVerse,
  activeSecondaryVerse,
  bibleDisplayMode,
  bibleBackgrounds,
  activeBibleBackgroundId,
  bibleTextColor,
  bibleTextColorOptions,
  bibleFontFamilyId,
  bibleFontOptions,
  bibleFontScale,
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
  onDownloadTranscript,
  onClearTranscriptAssist,
  onToggleAutoDisplay,
  onOpenCaptions,
  onOpenSuggestion,
  onDisplaySuggestion,
  onDismissSuggestion,
  quickRef,
  onQuickRefChange,
  quickRefSuggestion,
  onAcceptQuickRefSuggestion,
  onSubmitQuickRef,
  quickRefError,
  keywordSearchInputRef,
  keywordSearch,
  onKeywordSearchChange,
  onRunKeywordSearch,
  keywordSearching,
  keywordSearchProgress,
  keywordSearchError,
  keywordResults,
  highlightTerms,
  onOpenKeywordHit,
  translations,
  filteredTranslations,
  selectedTranslation,
  translationSearch,
  onTranslationSearchChange,
  showTranslationList,
  onShowTranslationList,
  onHideTranslationList,
  onLoadTranslations,
  onSelectTranslation,
  selectedSecondaryTranslation,
  secondaryTranslationSearch,
  filteredSecondaryTranslations,
  showSecondaryTranslationList,
  onSecondaryTranslationSearchChange,
  onShowSecondaryTranslationList,
  onHideSecondaryTranslationList,
  onSelectSecondaryTranslation,
  onBibleDisplayModeChange,
  onBibleBackgroundUpload,
  onSelectBibleBackground,
  onDeleteBibleBackground,
  onBibleTextColorChange,
  onBibleFontFamilyChange,
  onBibleFontScaleChange,
  selectedBook,
  selectedBookId,
  bookSearch,
  onBookSearchChange,
  showBookList,
  onShowBookList,
  onHideBookList,
  filteredBooks,
  onSelectBook,
  selectedChapter,
  chapterInput,
  onChapterInputChange,
  maxChapterCount,
  onCommitChapterInput,
  onJumpToChapter,
  canGoPrevChapter,
  canGoNextChapter,
  chapterViewVerses,
  bibleLoading,
  activeVerseIndex,
  canGoPrevVerse,
  canGoNextVerse,
  onJumpToVerse,
  onDisplayVerse,
}: BibleTabProps) {
  const bookOptions =
    filteredBooks.length > 0
      ? filteredBooks
      : Object.entries(BOOK_ID_MAP)
          .filter(([name]) => !bookSearch || name.toLowerCase().includes(bookSearch.toLowerCase()))
          .map(([name, numId]) => ({ bookid: parseInt(numId, 10), name, chapters: 0 }))

  const keywordResultsSection = keywordResults.length > 0 ? (
    <>
      <div style={styles.resultHeaderRow}>
        <p style={styles.sectionTitle}>Search Results</p>
        <span style={styles.resultCount}>{keywordResults.length} found · sorted by relevance</span>
      </div>
      <div style={styles.keywordResultsBox}>
        {keywordResults.map((hit, index) => {
          const isActive =
            activeVerse?.book === hit.book &&
            activeVerse?.chapter === hit.chapter &&
            activeVerse?.verse === hit.verse
          const segments = highlightTerms(hit.text, hit.matchedTerms ?? [])

          return (
            <div
              key={`${hit.bookId}-${hit.chapter}-${hit.verse}-${index}`}
              role="button"
              tabIndex={0}
              onClick={() => void onOpenKeywordHit(hit)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void onOpenKeywordHit(hit)
                }
              }}
              style={{
                ...styles.keywordResultRow,
                borderColor: isActive ? '#1e40af' : '#252528',
                background: isActive ? 'linear-gradient(135deg,#16233f,#0f1a30)' : '#1c1c1e',
                cursor: 'pointer',
              }}
              title="Click to display this verse"
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={styles.keywordResultRef}>{hit.reference}</p>
                <p style={styles.keywordResultText}>
                  {segments.map((segment, segmentIndex) =>
                    segment.highlight ? (
                      <mark key={segmentIndex} style={{ background: 'rgba(251,191,36,0.25)', color: '#fde68a', borderRadius: 3, padding: '0 2px' }}>
                        {segment.text}
                      </mark>
                    ) : (
                      <span key={segmentIndex}>{segment.text}</span>
                    )
                  )}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </>
  ) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.05fr) minmax(0, 1.35fr)', gap: 18, alignItems: 'start', flexShrink: 0 }}>
        <ScriptureAssistPanel
          styles={styles}
          transcriptListening={transcriptListening}
          transcriptReady={transcriptReady}
          transcriptSupported={transcriptSupported}
          transcriptStatusLabel={transcriptStatusLabel}
          transcriptStatusColor={transcriptStatusColor}
          transcriptProviderMode={transcriptProviderMode}
          transcriptProviderOptions={transcriptProviderOptions}
          transcriptProviderLabel={transcriptProviderLabel}
          transcriptProviderDetail={transcriptProviderDetail}
          autoDisplayScriptures={autoDisplayScriptures}
          transcriptError={transcriptError}
          transcriptText={transcriptText}
          transcriptInterimText={transcriptInterimText}
          combinedTranscript={combinedTranscript}
          captionSuggestionCount={captionSuggestionCount}
          scriptureSuggestions={scriptureSuggestions}
          onToggleListening={onToggleListening}
          onTranscriptProviderModeChange={onTranscriptProviderModeChange}
          onDownload={onDownloadTranscript}
          onClear={onClearTranscriptAssist}
          onToggleAutoDisplay={onToggleAutoDisplay}
          onOpenCaptions={onOpenCaptions}
          onOpenSuggestion={onOpenSuggestion}
          onDisplaySuggestion={onDisplaySuggestion}
          onDismissSuggestion={onDismissSuggestion}
        />

        <div style={{ ...styles.editorCard, padding: 18, gap: 16, minHeight: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, alignItems: 'start' }}>
          <div style={{ ...styles.summaryCard, gap: 10 }}>
            <p style={styles.sectionTitle}>Quick Reference</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="e.g. John 3:16 or Romans 8"
                value={quickRef}
                onChange={event => onQuickRefChange(event.target.value)}
                onKeyDown={event => {
                  const isCaretAtEnd =
                    event.currentTarget.selectionStart === event.currentTarget.value.length &&
                    event.currentTarget.selectionEnd === event.currentTarget.value.length

                  if ((event.key === 'Tab' || event.key === 'ArrowRight') && quickRefSuggestion && (event.key === 'Tab' || isCaretAtEnd)) {
                    event.preventDefault()
                    onAcceptQuickRefSuggestion()
                    return
                  }

                  if (event.key === 'Enter') {
                    event.preventDefault()
                    onSubmitQuickRef()
                  }
                }}
                style={{ ...styles.addInput, flex: 1 }}
              />
              <button onClick={onSubmitQuickRef} style={{ ...styles.addBtn, padding: '8px 14px', flexShrink: 0 }}>Go</button>
            </div>
            {quickRefSuggestion && (
              <p style={{ fontSize: 11, color: '#93c5fd', margin: 0 }}>
                Press Tab or Right Arrow to autocomplete <strong>{quickRefSuggestion.book}</strong>.
              </p>
            )}
            {quickRefError && <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>{quickRefError}</p>}
          </div>

          <div style={{ ...styles.summaryCard, gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={styles.sectionTitle}>Keyword Search</p>
              <span style={{ fontSize: 10, color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '2px 8px', letterSpacing: '0.06em' }}>
                FUZZY + PHRASE
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                ref={keywordSearchInputRef}
                type="text"
                placeholder="Type any word or phrase…"
                value={keywordSearch}
                onChange={event => onKeywordSearchChange(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && onRunKeywordSearch()}
                style={{ ...styles.addInput, flex: 1 }}
              />
              <button onClick={onRunKeywordSearch} style={{ ...styles.addBtn, padding: '8px 14px', flexShrink: 0 }} disabled={keywordSearching}>
                {keywordSearching ? '…' : 'Search'}
              </button>
            </div>
            {keywordSearchProgress && !keywordSearchError && (
              <p style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                {keywordSearchProgress}
              </p>
            )}
            {keywordSearchError && <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>{keywordSearchError}</p>}
            <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>Single words stay fuzzy. Multi-word searches keep the words together and rank exact phrases first.</p>
          </div>

          <div style={{ ...styles.summaryCard, gap: 10 }}>
            <div style={styles.compactLabelRow}>
              <p style={styles.sectionTitle}>Translation</p>
              {translations.length <= 16 && <button onClick={onLoadTranslations} style={styles.linkBtn}>Load all ↓</button>}
            </div>
            <input
              type="text"
              placeholder="KJV, NIV…"
              value={translationSearch}
              onChange={event => onTranslationSearchChange(event.target.value)}
              onFocus={onShowTranslationList}
              onBlur={() => setTimeout(onHideTranslationList, 200)}
              style={styles.compactInput}
            />
            {!showTranslationList && (
              <div style={styles.compactSelected}>
                <span style={{ fontWeight: 700 }}>{selectedTranslation}</span>
                <span style={{ color: '#93c5fd', fontSize: 11 }}>{translations.find(translation => translation.id === selectedTranslation)?.name ?? ''}</span>
              </div>
            )}
            {showTranslationList && (
              <div style={styles.compactList}>
                {filteredTranslations.slice(0, 100).map((translation, index) => (
                  <div
                    key={`${translation.id}-${index}`}
                    onMouseDown={() => onSelectTranslation(translation.id)}
                    style={{
                      ...styles.compactListItem,
                      background: translation.id === selectedTranslation ? '#1e3a2a' : 'transparent',
                      color: translation.id === selectedTranslation ? '#22c55e' : '#cbd5e1',
                    }}
                  >
                    <span style={{ fontWeight: 700, minWidth: 42, color: translation.id === selectedTranslation ? '#22c55e' : '#e2e8f0' }}>{translation.id}</span>
                    <span style={{ flex: 1, color: '#64748b', fontSize: 11 }}>{translation.name}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6 }}>
              {(['single', 'double'] as BibleDisplayMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => onBibleDisplayModeChange(mode)}
                  style={{
                    ...styles.ctrlBtn,
                    flex: 1,
                    padding: '7px 0',
                    background: bibleDisplayMode === mode ? 'linear-gradient(135deg,#1d4ed8,#1e40af)' : 'rgba(15,23,42,0.85)',
                    borderColor: bibleDisplayMode === mode ? '#2563eb' : '#23314a',
                    color: bibleDisplayMode === mode ? '#eff6ff' : '#94a3b8',
                  }}
                >
                  {mode === 'single' ? 'Single View' : 'Double View'}
                </button>
              ))}
            </div>

            <div>
              <p style={styles.sectionTitle}>Second Translation</p>
              <input
                type="text"
                placeholder="NIV, ESV…"
                value={secondaryTranslationSearch}
                onChange={event => onSecondaryTranslationSearchChange(event.target.value)}
                onFocus={onShowSecondaryTranslationList}
                onBlur={() => setTimeout(onHideSecondaryTranslationList, 200)}
                style={styles.compactInput}
              />
              {!showSecondaryTranslationList && (
                <div style={{ ...styles.compactSelected, borderColor: 'rgba(59,130,246,0.28)', background: 'rgba(30,64,175,0.08)' }}>
                  <span style={{ fontWeight: 700 }}>{selectedSecondaryTranslation}</span>
                  <span style={{ color: '#93c5fd', fontSize: 11 }}>
                    {translations.find(translation => translation.id === selectedSecondaryTranslation)?.name ?? ''}
                  </span>
                </div>
              )}
              {showSecondaryTranslationList && (
                <div style={styles.compactList}>
                  {filteredSecondaryTranslations.slice(0, 100).map((translation, index) => (
                    <div
                      key={`${translation.id}-secondary-${index}`}
                      onMouseDown={() => onSelectSecondaryTranslation(translation.id)}
                      style={{
                        ...styles.compactListItem,
                        background: translation.id === selectedSecondaryTranslation ? '#172554' : 'transparent',
                        color: translation.id === selectedSecondaryTranslation ? '#93c5fd' : '#cbd5e1',
                      }}
                    >
                      <span style={{ fontWeight: 700, minWidth: 42, color: translation.id === selectedSecondaryTranslation ? '#93c5fd' : '#e2e8f0' }}>{translation.id}</span>
                      <span style={{ flex: 1, color: '#64748b', fontSize: 11 }}>{translation.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ ...styles.summaryCard, gap: 12 }}>
            <div>
              <p style={styles.sectionTitle}>Book</p>
              <input
                type="text"
                placeholder="Search book…"
                value={bookSearch}
                onChange={event => onBookSearchChange(event.target.value)}
                onFocus={onShowBookList}
                onBlur={() => setTimeout(onHideBookList, 200)}
                style={styles.compactInput}
              />
              {!showBookList && (
                <div style={{ ...styles.compactSelected, color: '#22c55e', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  {selectedBook}
                </div>
              )}
              {showBookList && (
                <div style={styles.compactList}>
                  {bookOptions.map(book => (
                    <div
                      key={book.bookid}
                      onMouseDown={() => onSelectBook(book.name, String(book.bookid))}
                      style={{
                        ...styles.compactListItem,
                        background: String(book.bookid) === selectedBookId ? '#1e3a2a' : 'transparent',
                        color: String(book.bookid) === selectedBookId ? '#22c55e' : '#cbd5e1',
                      }}
                    >
                      {book.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p style={styles.sectionTitle}>Chapter</p>
              <div style={styles.chapterNavBar}>
                <button
                  onClick={() => onJumpToChapter(selectedChapter - 1)}
                  disabled={!canGoPrevChapter}
                  style={{ ...styles.chapterNavBtn, opacity: canGoPrevChapter ? 1 : 0.45, cursor: canGoPrevChapter ? 'pointer' : 'not-allowed' }}
                >
                  <span style={styles.chapterNavArrow}>◀</span>
                  <span>Previous</span>
                </button>

                <div style={styles.chapterNavCenter}>
                  <span style={styles.chapterNavMeta}>{selectedBook}</span>
                  <div style={styles.chapterInputWrap}>
                    <input
                      type="number"
                      min="1"
                      max={maxChapterCount}
                      value={chapterInput}
                      onChange={event => onChapterInputChange(event.target.value)}
                      onBlur={onCommitChapterInput}
                      onKeyDown={event => {
                        if (event.key === 'Enter') onCommitChapterInput()
                      }}
                      style={styles.chapterInput}
                    />
                    <span style={styles.chapterCount}>of {maxChapterCount}</span>
                  </div>
                </div>

                <button
                  onClick={() => onJumpToChapter(selectedChapter + 1)}
                  disabled={!canGoNextChapter}
                  style={{ ...styles.chapterNavBtn, opacity: canGoNextChapter ? 1 : 0.45, cursor: canGoNextChapter ? 'pointer' : 'not-allowed' }}
                >
                  <span>Next</span>
                  <span style={styles.chapterNavArrow}>▶</span>
                </button>
              </div>
            </div>
          </div>

          <div style={{ ...styles.summaryCard, gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <p style={styles.sectionTitle}>Scripture Style</p>
              <label
                style={{
                  ...styles.transcriptGhostBtn,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                Upload Bg
                <input type="file" accept="image/*" multiple onChange={onBibleBackgroundUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <div>
              <p style={styles.sectionTitle}>Backgrounds</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 8, marginTop: 8 }}>
                {bibleBackgrounds.map(background => {
                  const isActive = background.id === activeBibleBackgroundId
                  const isImage = background.kind === 'image'

                  return (
                    <div
                      key={background.id}
                      style={{
                        position: 'relative',
                        borderRadius: 12,
                        border: `1px solid ${isActive ? '#2563eb' : 'rgba(148,163,184,0.14)'}`,
                        background: isActive ? 'rgba(30,64,175,0.14)' : 'rgba(15,23,42,0.56)',
                        boxShadow: isActive ? '0 0 0 1px rgba(59,130,246,0.22)' : 'none',
                      }}
                    >
                      <button
                        onClick={() => onSelectBibleBackground(background.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          padding: 6,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#e2e8f0',
                        }}
                      >
                        <div
                          style={{
                            height: 54,
                            borderRadius: 8,
                            background: isImage
                              ? `linear-gradient(rgba(15,23,42,0.14), rgba(15,23,42,0.3)), url("${background.value}") center/cover no-repeat`
                              : background.value,
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        />
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            color: isActive ? '#dbeafe' : '#cbd5e1',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {background.name}
                        </span>
                      </button>

                      {!background.builtIn && (
                        <button
                          onClick={() => onDeleteBibleBackground(background.id)}
                          style={{
                            ...styles.removeBtn,
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            background: 'rgba(15,23,42,0.86)',
                            color: '#fca5a5',
                            borderColor: 'rgba(248,113,113,0.18)',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <p style={styles.sectionTitle}>Text Color</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {bibleTextColorOptions.map(option => {
                  const isActive = option.value.toLowerCase() === bibleTextColor.toLowerCase()

                  return (
                    <button
                      key={option.id}
                      onClick={() => onBibleTextColorChange(option.value)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 10px',
                        borderRadius: 999,
                        border: `1px solid ${isActive ? '#2563eb' : 'rgba(148,163,184,0.14)'}`,
                        background: isActive ? 'rgba(30,64,175,0.16)' : 'rgba(15,23,42,0.84)',
                        color: isActive ? '#dbeafe' : '#cbd5e1',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: option.value,
                          border: option.value.toLowerCase() === '#ffffff' ? '1px solid rgba(15,23,42,0.55)' : '1px solid rgba(255,255,255,0.16)',
                          boxShadow: option.value.toLowerCase() === '#000000' ? '0 0 0 1px rgba(255,255,255,0.18)' : 'none',
                        }}
                      />
                      <span>{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p style={styles.sectionTitle}>Font Family</p>
              <select
                value={bibleFontFamilyId}
                onChange={event => onBibleFontFamilyChange(event.target.value)}
                style={{ ...styles.fullSelect, marginTop: 8, fontSize: 12 }}
              >
                {bibleFontOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <p style={styles.sectionTitle}>Font Size</p>
                <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>{bibleFontScale}%</span>
              </div>
              <input
                type="range"
                min="85"
                max="150"
                step="5"
                value={bibleFontScale}
                onChange={event => onBibleFontScaleChange(Number(event.target.value))}
                style={{ width: '100%', marginTop: 10, accentColor: '#2563eb' }}
              />
              <p style={{ fontSize: 10, color: '#64748b', margin: '6px 0 0' }}>
                Increase or reduce scripture size while keeping auto-fit protection for long passages.
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 360px) minmax(0, 1fr)', gap: 18, minHeight: 0, flex: 1 }}>
        <aside style={{ ...styles.left, gap: 10 }}>
          <OnScreenScripturePanel
            styles={styles}
            activeVerse={activeVerse}
            activeSecondaryVerse={activeSecondaryVerse}
            bibleDisplayMode={bibleDisplayMode}
          />
          {keywordResultsSection}
        </aside>

        <main style={styles.right}>
        <div style={styles.verseHeaderBar}>
          <div style={styles.verseHeaderText}>
            <p style={styles.sectionTitle}>Verse Browser</p>
            <p style={styles.verseHeaderTitle}>
              {selectedBook} {selectedChapter} — {chapterViewVerses.length} verse{chapterViewVerses.length !== 1 ? 's' : ''}
              {bibleLoading && <span style={{ color: '#475569', marginLeft: 8 }}>Loading…</span>}
            </p>
            <p style={styles.verseHeaderMeta}>
              {activeVerseIndex >= 0
                ? `Active verse ${chapterViewVerses[activeVerseIndex]?.verse} of ${chapterViewVerses.length}`
                : 'Select a verse below to enable previous and next'}
            </p>
          </div>

          <div style={styles.verseHeaderActions}>
            <button
              onClick={() => onJumpToVerse(-1)}
              disabled={!canGoPrevVerse}
              style={{ ...styles.verseHeaderBtn, opacity: canGoPrevVerse ? 1 : 0.45, cursor: canGoPrevVerse ? 'pointer' : 'not-allowed' }}
            >
              <span style={styles.chapterNavArrow}>◀</span>
              <span>Previous Verse</span>
            </button>
            <button
              onClick={() => onJumpToVerse(1)}
              disabled={!canGoNextVerse}
              style={{ ...styles.verseHeaderBtn, opacity: canGoNextVerse ? 1 : 0.45, cursor: canGoNextVerse ? 'pointer' : 'not-allowed' }}
            >
              <span>Next Verse</span>
              <span style={styles.chapterNavArrow}>▶</span>
            </button>
          </div>
        </div>

        <div style={{ ...styles.activityList, gap: 4 }}>
          {chapterViewVerses.map(verseRow => {
            const isActive =
              activeVerse?.verse === verseRow.verse &&
              activeVerse?.book === selectedBook &&
              activeVerse?.chapter === selectedChapter

            return (
              <div
                key={verseRow.verse}
                role="button"
                tabIndex={0}
                onClick={() =>
                  onDisplayVerse({
                    book: selectedBook,
                    chapter: selectedChapter,
                    verse: verseRow.verse,
                    text: verseRow.text,
                    translation: selectedTranslation,
                    reference: `${selectedBook} ${selectedChapter}:${verseRow.verse} (${selectedTranslation})`,
                  })
                }
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onDisplayVerse({
                      book: selectedBook,
                      chapter: selectedChapter,
                      verse: verseRow.verse,
                      text: verseRow.text,
                      translation: selectedTranslation,
                      reference: `${selectedBook} ${selectedChapter}:${verseRow.verse} (${selectedTranslation})`,
                    })
                  }
                }}
                style={{
                  ...styles.activityRow,
                  background: isActive ? 'linear-gradient(135deg,#1e3a5f,#162d4a)' : '#1c1c1e',
                  borderColor: isActive ? '#1e40af' : '#252528',
                  cursor: 'pointer',
                  alignItems: 'flex-start',
                  boxShadow: isActive ? '0 2px 12px rgba(30,64,175,0.2)' : 'none',
                }}
                title="Click to display this verse on screen"
              >
                <span style={{ ...styles.indexBadge, background: isActive ? '#3b82f6' : '#252528', color: isActive ? '#fff' : '#4a4a55', flexShrink: 0, marginTop: 2 }}>
                  {verseRow.verse}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: isActive ? '#fff' : '#94a3b8', lineHeight: 1.65 }}>{verseRow.text}</span>
              </div>
            )
          })}
          {!bibleLoading && chapterViewVerses.length === 0 && <p style={{ color: '#334155', textAlign: 'center', padding: 40 }}>No verses found</p>}
        </div>
        </main>
      </div>
    </div>
  )
}
