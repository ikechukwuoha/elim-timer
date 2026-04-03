import type { CaptionCue } from '@/types'

const CAPTION_KEYWORDS = [
  'god', 'jesus', 'holy spirit', 'faith', 'grace', 'mercy', 'hope', 'love',
  'prayer', 'truth', 'purpose', 'calling', 'worship', 'promise', 'obedience',
  'wisdom', 'church', 'gospel', 'heart', 'peace', 'strength', 'breakthrough',
]

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeForId(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildCaptionId(text: string): string {
  const normalized = normalizeForId(text) || 'caption'
  let hash = 0
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(index)
    hash |= 0
  }
  return `${normalized.slice(0, 64)}-${Math.abs(hash)}`
}

function splitIntoCandidates(transcript: string): string[] {
  const normalized = normalizeWhitespace(transcript)
  if (!normalized) return []

  const punctuated = normalized
    .replace(/([.!?;:])\s+/g, '$1\n')
    .split(/\n+/)
    .map(part => normalizeWhitespace(part))
    .filter(Boolean)

  if (punctuated.length > 1) return punctuated

  const words = normalized.split(' ')
  if (words.length <= 24) return [normalized]

  const chunks: string[] = []
  for (let start = 0; start < words.length; start += 16) {
    const slice = words.slice(start, start + 18).join(' ')
    if (slice) chunks.push(slice)
  }
  return chunks
}

function countWords(value: string): number {
  return normalizeWhitespace(value).split(' ').filter(Boolean).length
}

function pickKind(value: string): CaptionCue['kind'] {
  const normalized = value.toLowerCase()
  if (
    normalized.includes(' let us ') ||
    normalized.startsWith('let us ') ||
    normalized.includes(' you ') ||
    normalized.includes(' we ') ||
    normalized.includes('god') ||
    normalized.includes('jesus')
  ) {
    return 'quote'
  }
  return 'key-point'
}

function scoreCandidate(value: string): number {
  const normalized = value.toLowerCase()
  const words = countWords(value)
  if (words < 6 || words > 30) return -1

  let score = 0

  if (words >= 8 && words <= 20) score += 3
  else if (words <= 24) score += 2
  else score += 1

  const keywordHits = CAPTION_KEYWORDS.filter(keyword => normalized.includes(keyword)).length
  score += Math.min(keywordHits, 3)

  if (/[.!?]$/.test(value)) score += 1
  if (/\b(you|your|we|our|let us|must|can|will|today|now)\b/.test(normalized)) score += 1
  if (/\b(dont|don't|never|always|because|when|if)\b/.test(normalized)) score += 1

  const uniqueWords = new Set(normalized.split(/\s+/).filter(Boolean))
  if (uniqueWords.size / words > 0.7) score += 1

  return score
}

function cleanCandidate(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/^[-,:;.\s]+/, '')
      .replace(/[-,:;\s]+$/, '')
  )
}

export function extractCaptionCues(
  transcript: string,
  options: { limit?: number; createdAt?: number } = {}
): CaptionCue[] {
  const createdAt = options.createdAt ?? Date.now()
  const limit = options.limit ?? 8
  const candidates = splitIntoCandidates(transcript)
  const unique = new Map<string, CaptionCue>()

  for (const rawCandidate of candidates) {
    const text = cleanCandidate(rawCandidate)
    if (!text) continue

    const score = scoreCandidate(text)
    if (score < 0) continue

    const id = buildCaptionId(text)
    if (unique.has(id)) continue

    unique.set(id, {
      id,
      text,
      kind: pickKind(text),
      sourceText: text,
      score,
      createdAt,
    })
  }

  return Array.from(unique.values())
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if (right.kind !== left.kind) return left.kind === 'quote' ? -1 : 1
      return right.createdAt - left.createdAt
    })
    .slice(0, limit)
}
