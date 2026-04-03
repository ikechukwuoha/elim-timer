import { BOOK_ID_MAP } from '@/utils/bibleApi'

export type ScriptureSuggestion = {
  canonicalId: string
  book: string
  bookId: string
  chapter: number
  verse: number | null
  confidence: 'high' | 'medium'
  kind: 'verse' | 'chapter'
  reference: string
  matchedText: string
  snippet: string
}

type Token = {
  value: string
  start: number
  end: number
}

type AliasEntry = {
  book: string
  bookId: string
  alias: string
  tokens: string[]
}

const SIMPLE_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
}

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
  fortieth: 40,
  fiftieth: 50,
  sixtieth: 60,
  seventieth: 70,
  eightieth: 80,
  ninetieth: 90,
}

const COMMON_ALIASES: Record<string, string[]> = {
  Genesis: ['gen'],
  Exodus: ['exo', 'exod'],
  Leviticus: ['lev'],
  Numbers: ['num'],
  Deuteronomy: ['deut'],
  Joshua: ['josh'],
  Judges: ['judg'],
  Psalms: ['psalm', 'ps', 'psa'],
  Proverbs: ['prov', 'pro'],
  Ecclesiastes: ['ecc'],
  'Song of Solomon': ['song of songs', 'songs'],
  Isaiah: ['isa'],
  Jeremiah: ['jer'],
  Lamentations: ['lam'],
  Ezekiel: ['ezek'],
  Daniel: ['dan'],
  Obadiah: ['obad'],
  Micah: ['mic'],
  Nahum: ['nah'],
  Habakkuk: ['hab'],
  Zephaniah: ['zeph'],
  Zechariah: ['zech'],
  Matthew: ['matt', 'mt'],
  Mark: ['mk'],
  Luke: ['lk'],
  John: ['jn'],
  Acts: ['act'],
  Romans: ['rom'],
  Galatians: ['gal'],
  Ephesians: ['eph'],
  Philippians: ['phil'],
  Colossians: ['col'],
  Philemon: ['philem', 'phm'],
  Hebrews: ['heb'],
  James: ['jas'],
  Jude: ['jud'],
  Revelation: ['rev', 'revelations'],
}

const NUMBERED_WORDS: Record<string, { word: string; ordinal: string; roman: string }> = {
  '1': { word: 'first', ordinal: '1st', roman: 'i' },
  '2': { word: 'second', ordinal: '2nd', roman: 'ii' },
  '3': { word: 'third', ordinal: '3rd', roman: 'iii' },
}

function buildAliasEntries(): AliasEntry[] {
  const entries: AliasEntry[] = []

  for (const [book, bookId] of Object.entries(BOOK_ID_MAP)) {
    const aliases = new Set<string>()
    aliases.add(book.toLowerCase())

    const numbered = book.match(/^([123])\s+(.+)$/)
    if (numbered) {
      const [, number, rest] = numbered
      const restLower = rest.toLowerCase()
      const numMeta = NUMBERED_WORDS[number]
      aliases.add(`${number} ${restLower}`)
      aliases.add(`${numMeta.word} ${restLower}`)
      aliases.add(`${numMeta.ordinal} ${restLower}`)
      aliases.add(`${numMeta.roman} ${restLower}`)

      const restAliases = COMMON_ALIASES[rest] ?? []
      for (const alias of restAliases) {
        aliases.add(`${number} ${alias}`)
        aliases.add(`${numMeta.word} ${alias}`)
        aliases.add(`${numMeta.ordinal} ${alias}`)
        aliases.add(`${numMeta.roman} ${alias}`)
      }
    } else {
      for (const alias of COMMON_ALIASES[book] ?? []) aliases.add(alias)
    }

    for (const alias of aliases) {
      entries.push({
        book,
        bookId,
        alias,
        tokens: alias.split(' '),
      })
    }
  }

  return entries.sort((a, b) => {
    const byTokenCount = b.tokens.length - a.tokens.length
    if (byTokenCount !== 0) return byTokenCount
    return b.alias.length - a.alias.length
  })
}

const ALIAS_ENTRIES = buildAliasEntries()

function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[:,-]/g, match => ` ${match} `)
    .replace(/[()[\]{}"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const pattern = /[a-z0-9]+|[:,-]/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    tokens.push({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
  }

  return tokens
}

function isNumberishToken(value: string): boolean {
  return /^\d+$/.test(value) ||
    value === 'and' ||
    value === 'hundred' ||
    value in SIMPLE_NUMBERS ||
    value in TENS ||
    value in ORDINALS
}

function isNumberStartToken(value: string): boolean {
  return /^\d+$/.test(value) || value in SIMPLE_NUMBERS || value in TENS || value in ORDINALS
}

function parseNumberExpression(raw: string): number | null {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return null

  let current = 0
  let sawValue = false

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      current += Number(token)
      sawValue = true
      continue
    }
    if (token === 'and') continue
    if (token === 'hundred') {
      current = current === 0 ? 100 : current * 100
      sawValue = true
      continue
    }
    if (token in SIMPLE_NUMBERS) {
      current += SIMPLE_NUMBERS[token]
      sawValue = true
      continue
    }
    if (token in TENS) {
      current += TENS[token]
      sawValue = true
      continue
    }
    if (token in ORDINALS) {
      current += ORDINALS[token]
      sawValue = true
      continue
    }
    return null
  }

  return sawValue && current > 0 ? current : null
}

function consumeNumber(tokens: Token[], startIndex: number): { value: number; raw: string; nextIndex: number } | null {
  if (startIndex >= tokens.length || !isNumberStartToken(tokens[startIndex].value)) return null

  const values: string[] = []
  let index = startIndex

  while (index < tokens.length && isNumberishToken(tokens[index].value)) {
    values.push(tokens[index].value)
    index += 1
  }

  const raw = values.join(' ')
  const value = parseNumberExpression(raw)
  if (value == null) return null

  return { value, raw, nextIndex: index }
}

function overlaps(used: Array<[number, number]>, start: number, end: number): boolean {
  return used.some(([usedStart, usedEnd]) => start < usedEnd && end > usedStart)
}

function formatSnippet(text: string, start: number, end: number): string {
  const snippetStart = Math.max(0, start - 30)
  const snippetEnd = Math.min(text.length, end + 45)
  const snippet = text.slice(snippetStart, snippetEnd).trim()
  return snippet
    .replace(/\s+([:,-])/g, '$1')
    .replace(/([:,-])\s+/g, '$1 ')
}

function buildReference(book: string, chapter: number, verse: number | null): string {
  return verse == null ? `${book} ${chapter}` : `${book} ${chapter}:${verse}`
}

export function detectScriptureSuggestions(transcript: string): ScriptureSuggestion[] {
  const normalized = normalizeTranscript(transcript)
  if (!normalized) return []

  const tokens = tokenize(normalized)
  const suggestions: ScriptureSuggestion[] = []
  const usedSpans: Array<[number, number]> = []

  for (const entry of ALIAS_ENTRIES) {
    for (let i = 0; i <= tokens.length - entry.tokens.length; i += 1) {
      const matchesAlias = entry.tokens.every((token, offset) => tokens[i + offset]?.value === token)
      if (!matchesAlias) continue

      const aliasStart = tokens[i].start
      const aliasEnd = tokens[i + entry.tokens.length - 1].end
      if (overlaps(usedSpans, aliasStart, aliasEnd)) continue

      let cursor = i + entry.tokens.length
      if (tokens[cursor]?.value === 'chapter') cursor += 1

      const chapterMatch = consumeNumber(tokens, cursor)
      if (!chapterMatch) continue
      if (chapterMatch.value > 200) continue

      cursor = chapterMatch.nextIndex
      let verseValue: number | null = null
      let endTokenIndex = chapterMatch.nextIndex - 1

      if (tokens[cursor]?.value === ':' || tokens[cursor]?.value === 'verse' || tokens[cursor]?.value === 'verses' || tokens[cursor]?.value === 'v') {
        cursor += 1
        const verseMatch = consumeNumber(tokens, cursor)
        if (verseMatch && verseMatch.value <= 200) {
          verseValue = verseMatch.value
          endTokenIndex = verseMatch.nextIndex - 1
        }
      } else if (tokens[cursor] && isNumberStartToken(tokens[cursor].value)) {
        const verseMatch = consumeNumber(tokens, cursor)
        if (verseMatch && verseMatch.value <= 200) {
          verseValue = verseMatch.value
          endTokenIndex = verseMatch.nextIndex - 1
        }
      }

      const matchEnd = tokens[endTokenIndex]?.end ?? aliasEnd
      if (overlaps(usedSpans, aliasStart, matchEnd)) continue

      const reference = buildReference(entry.book, chapterMatch.value, verseValue)
      suggestions.push({
        canonicalId: `${entry.book}:${chapterMatch.value}:${verseValue ?? 'chapter'}`,
        book: entry.book,
        bookId: entry.bookId,
        chapter: chapterMatch.value,
        verse: verseValue,
        confidence: verseValue == null ? 'medium' : 'high',
        kind: verseValue == null ? 'chapter' : 'verse',
        reference,
        matchedText: normalized.slice(aliasStart, matchEnd),
        snippet: formatSnippet(normalized, aliasStart, matchEnd),
      })

      usedSpans.push([aliasStart, matchEnd])
    }
  }

  const unique = new Map<string, ScriptureSuggestion>()
  for (const suggestion of suggestions) {
    if (!unique.has(suggestion.canonicalId)) unique.set(suggestion.canonicalId, suggestion)
  }

  return Array.from(unique.values()).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'verse' ? -1 : 1
    return a.reference.localeCompare(b.reference)
  })
}
