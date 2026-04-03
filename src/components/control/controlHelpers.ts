import type { SongLine, TimerState } from '@/types'
import { getSyncedNow } from '@/utils/timerStore'

const TRANSCRIPT_MAX_CHARS = 3000

export function levenshtein(a: string, b: string, maxDist = 3): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1
  const m = a.length
  const n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, index) => index)
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0]
    dp[0] = i
    let rowMin = dp[0]
    for (let j = 1; j <= n; j += 1) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp
      rowMin = Math.min(rowMin, dp[j])
    }
    if (rowMin > maxDist) return maxDist + 1
  }
  return dp[n]
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function buildSongLines(lyrics: string, interpretations: string): SongLine[] {
  const lyricRows = lyrics.split('\n')
  const interpretationRows = interpretations.split('\n')
  let lineId = 1

  return lyricRows.reduce<SongLine[]>((lines, rawLyric, index) => {
    const text = rawLyric.trim()
    if (!text) return lines

    const interpretation = interpretationRows[index]?.trim()
    lines.push({
      id: lineId++,
      text,
      interpretation: interpretation || undefined,
    })
    return lines
  }, [])
}

export function stringifySongLines(lines: SongLine[], field: 'text' | 'interpretation'): string {
  return lines.map(line => (field === 'text' ? line.text : (line.interpretation ?? ''))).join('\n')
}

function wordMatches(queryWord: string, verseWord: string): boolean {
  if (queryWord.length <= 3) return verseWord === queryWord
  if (verseWord.includes(queryWord)) return true
  if (queryWord.length >= 4) {
    const maxDist = queryWord.length <= 6 ? 1 : 2
    if (levenshtein(queryWord, verseWord, maxDist) <= maxDist) return true
  }
  return false
}

export function scoreVerse(
  verseText: string,
  queryTerms: string[],
  phraseQuery?: string | null
): { matched: boolean; score: number; matchedTerms: string[] } {
  const lowerText = verseText.toLowerCase()
  const normalizedText = normalizeSearchText(verseText)
  const verseWords = normalizedText.split(' ').filter(Boolean)
  const matchedTerms: string[] = []
  const matchedWordTerms = new Set<string>()
  let score = 0

  const hasExactPhrase = Boolean(phraseQuery && normalizedText.includes(phraseQuery))

  if (hasExactPhrase && phraseQuery) {
    matchedTerms.push(phraseQuery)
    score += 120
  }

  for (const term of queryTerms) {
    if (lowerText.includes(term)) {
      matchedWordTerms.add(term)
      if (!matchedTerms.includes(term)) matchedTerms.push(term)
      score += 12
      continue
    }
    let termMatched = false
    for (const vw of verseWords) {
      if (wordMatches(term, vw)) {
        termMatched = true
        matchedWordTerms.add(term)
        score += vw === term ? 10 : vw.includes(term) ? 7 : 4
        break
      }
    }
    if (termMatched && !matchedTerms.includes(term)) matchedTerms.push(term)
  }

  const allTermsMatched = queryTerms.every(term => matchedWordTerms.has(term))
  const orderedPhraseMatch =
    queryTerms.length > 1 &&
    queryTerms.every((term, index) => {
      if (index === 0) return normalizedText.includes(term)
      const previousTerm = queryTerms[index - 1]
      const previousIndex = normalizedText.indexOf(previousTerm)
      const currentIndex = normalizedText.indexOf(term, previousIndex + previousTerm.length)
      return currentIndex >= 0
    })

  if (queryTerms.length > 1) {
    if (!allTermsMatched && !hasExactPhrase) {
      return { matched: false, score: 0, matchedTerms: [] }
    }
    if (allTermsMatched) score += 36
    if (orderedPhraseMatch) score += 22
  }

  return { matched: hasExactPhrase || allTermsMatched || matchedTerms.length > 0, score, matchedTerms }
}

export function highlightTerms(text: string, terms: string[]): { text: string; highlight: boolean }[] {
  if (!terms.length) return [{ text, highlight: false }]
  const orderedTerms = Array.from(new Set(terms.filter(Boolean))).sort((a, b) => b.length - a.length)
  const escaped = orderedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(pattern)
  return parts.map(part => ({
    text: part,
    highlight: orderedTerms.some(t => part.toLowerCase().includes(t.toLowerCase()) && t.length >= 2),
  }))
}

export function appendTranscript(previous: string, chunk: string): string {
  const next = `${previous}${previous ? ' ' : ''}${chunk}`.replace(/\s+/g, ' ').trim()
  return next.length > TRANSCRIPT_MAX_CHARS ? next.slice(next.length - TRANSCRIPT_MAX_CHARS) : next
}

function normalizeTranscriptChunk(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function shouldAppendTranscriptChunk(previous: string, chunk: string): boolean {
  const normalizedChunk = normalizeTranscriptChunk(chunk)
  if (!normalizedChunk) return false

  const normalizedPrevious = normalizeTranscriptChunk(previous)
  if (!normalizedPrevious) return true

  const recentWindow = normalizedPrevious.slice(-Math.max(240, normalizedChunk.length * 3))
  if (recentWindow.endsWith(normalizedChunk)) return false

  const chunkWords = normalizedChunk.split(' ').filter(Boolean)
  if (chunkWords.length >= 4) {
    const repeatedChunk = `${normalizedChunk} ${normalizedChunk}`
    if (recentWindow.includes(repeatedChunk)) return false
  }

  return true
}

export function describeSpeechError(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Please allow microphone permission and try again.'
    case 'no-speech':
      return 'No speech was detected. Keep speaking and the listener will continue.'
    case 'audio-capture':
      return 'No microphone was found. Check your audio input device.'
    case 'network':
      return 'Speech recognition hit a network issue. It will retry when possible.'
    default:
      return `Speech recognition error: ${error}`
  }
}

export function withStartAnchor(state: TimerState, remaining?: number): TimerState {
  const r = remaining ?? state.remaining
  return { ...state, running: true, remaining: r, startedAt: getSyncedNow(), remainingAtStart: r }
}

export function withPauseAnchor(state: TimerState, remaining?: number): TimerState {
  return { ...state, running: false, remaining: remaining ?? state.remaining, startedAt: null, remainingAtStart: null }
}
