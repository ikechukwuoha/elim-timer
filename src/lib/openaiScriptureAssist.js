const OPENAI_BASE_URL = 'https://api.openai.com/v1'

const SUPPORTED_BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
  'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke',
  'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation',
]

const BOOK_ID_MAP = {
  Genesis: '1',
  Exodus: '2',
  Leviticus: '3',
  Numbers: '4',
  Deuteronomy: '5',
  Joshua: '6',
  Judges: '7',
  Ruth: '8',
  '1 Samuel': '9',
  '2 Samuel': '10',
  '1 Kings': '11',
  '2 Kings': '12',
  '1 Chronicles': '13',
  '2 Chronicles': '14',
  Ezra: '15',
  Nehemiah: '16',
  Esther: '17',
  Job: '18',
  Psalms: '19',
  Proverbs: '20',
  Ecclesiastes: '21',
  'Song of Solomon': '22',
  Isaiah: '23',
  Jeremiah: '24',
  Lamentations: '25',
  Ezekiel: '26',
  Daniel: '27',
  Hosea: '28',
  Joel: '29',
  Amos: '30',
  Obadiah: '31',
  Jonah: '32',
  Micah: '33',
  Nahum: '34',
  Habakkuk: '35',
  Zephaniah: '36',
  Haggai: '37',
  Zechariah: '38',
  Malachi: '39',
  Matthew: '40',
  Mark: '41',
  Luke: '42',
  John: '43',
  Acts: '44',
  Romans: '45',
  '1 Corinthians': '46',
  '2 Corinthians': '47',
  Galatians: '48',
  Ephesians: '49',
  Philippians: '50',
  Colossians: '51',
  '1 Thessalonians': '52',
  '2 Thessalonians': '53',
  '1 Timothy': '54',
  '2 Timothy': '55',
  Titus: '56',
  Philemon: '57',
  Hebrews: '58',
  James: '59',
  '1 Peter': '60',
  '2 Peter': '61',
  '1 John': '62',
  '2 John': '63',
  '3 John': '64',
  Jude: '65',
  Revelation: '66',
}

function getOpenAIScriptureAssistSettings() {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim()
  const transcribeModel = (process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe').trim()
  const extractionModel = (process.env.OPENAI_SCRIPTURE_MODEL || 'gpt-4o-mini').trim()
  return {
    apiKey,
    transcribeModel,
    extractionModel,
    configured: Boolean(apiKey),
  }
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferAudioFilename(mimeType) {
  const normalized = String(mimeType || '').toLowerCase()
  if (normalized.includes('mp4')) return 'sermon-audio.m4a'
  if (normalized.includes('mpeg')) return 'sermon-audio.mp3'
  if (normalized.includes('ogg')) return 'sermon-audio.ogg'
  if (normalized.includes('wav')) return 'sermon-audio.wav'
  return 'sermon-audio.webm'
}

async function readOpenAIError(response) {
  try {
    const payload = await response.json()
    return payload?.error?.message || JSON.stringify(payload)
  } catch {
    try {
      return await response.text()
    } catch {
      return `OpenAI request failed with status ${response.status}`
    }
  }
}

async function transcribeAudioChunkWithOpenAI({ audioBuffer, mimeType, recentTranscript = '' }) {
  const settings = getOpenAIScriptureAssistSettings()
  if (!settings.configured) {
    throw new Error('OpenAI transcription is not configured yet. Add OPENAI_API_KEY to your environment.')
  }

  const recent = normalizeWhitespace(recentTranscript).slice(-500)

  const form = new FormData()
  const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' })
  form.append('model', settings.transcribeModel)
  form.append('file', audioBlob, inferAudioFilename(mimeType))
  form.append('language', 'en')
  form.append(
    'prompt',
    [
      'This is a live Christian sermon transcript.',
      'Preserve spoken Bible references carefully.',
      'Book names may include numbered books like 1 Corinthians, 2 Timothy, 1 John, and Revelation.',
      recent ? `Recent transcript context: ${recent}` : '',
      'Return plain text only.',
    ].join(' ')
  )

  const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: form,
  })

  if (!response.ok) {
    const detail = await readOpenAIError(response)
    throw new Error(detail || 'OpenAI could not transcribe the audio chunk.')
  }

  const payload = await response.json()
  return normalizeWhitespace(payload?.text || '')
}

function normalizeBookName(book) {
  const normalized = normalizeWhitespace(book).toLowerCase()
  if (!normalized) return null

  const direct = SUPPORTED_BIBLE_BOOKS.find(candidate => candidate.toLowerCase() === normalized)
  if (direct) return direct

  const normalizedDigits = normalized
    .replace(/^first\s+/, '1 ')
    .replace(/^second\s+/, '2 ')
    .replace(/^third\s+/, '3 ')
    .replace(/^1st\s+/, '1 ')
    .replace(/^2nd\s+/, '2 ')
    .replace(/^3rd\s+/, '3 ')

  return SUPPORTED_BIBLE_BOOKS.find(candidate => candidate.toLowerCase() === normalizedDigits) || null
}

function normalizeModelSuggestion(rawSuggestion) {
  const book = normalizeBookName(rawSuggestion?.book)
  const chapter = Number(rawSuggestion?.chapter)
  const verseValue = rawSuggestion?.verse == null ? null : Number(rawSuggestion.verse)
  const kind = rawSuggestion?.kind === 'chapter' || verseValue == null ? 'chapter' : 'verse'
  const confidence = rawSuggestion?.confidence === 'high' ? 'high' : 'medium'

  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > 200) return null
  if (kind === 'verse' && (!Number.isInteger(verseValue) || verseValue < 1 || verseValue > 200)) return null

  const verse = kind === 'verse' ? verseValue : null
  const reference = verse == null ? `${book} ${chapter}` : `${book} ${chapter}:${verse}`

  return {
    canonicalId: `${book}:${chapter}:${verse == null ? 'chapter' : verse}`,
    book,
    bookId: BOOK_ID_MAP[book],
    chapter,
    verse,
    confidence,
    kind,
    reference,
    matchedText: normalizeWhitespace(rawSuggestion?.matchedText || reference),
    snippet: normalizeWhitespace(rawSuggestion?.snippet || rawSuggestion?.matchedText || reference),
  }
}

async function extractScriptureSuggestionsWithOpenAI({ latestTranscript, recentTranscript = '' }) {
  const settings = getOpenAIScriptureAssistSettings()
  if (!settings.configured) return []

  const latest = normalizeWhitespace(latestTranscript)
  const recent = normalizeWhitespace(recentTranscript).slice(-1400)
  if (!latest) return []

  const schema = {
    name: 'scripture_references',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        references: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              book: { type: 'string' },
              chapter: { type: 'integer', minimum: 1, maximum: 200 },
              verse: {
                anyOf: [
                  { type: 'integer', minimum: 1, maximum: 200 },
                  { type: 'null' },
                ],
              },
              kind: { type: 'string', enum: ['verse', 'chapter'] },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              matchedText: { type: 'string' },
              snippet: { type: 'string' },
            },
            required: ['book', 'chapter', 'verse', 'kind', 'confidence', 'matchedText', 'snippet'],
          },
        },
      },
      required: ['references'],
    },
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.extractionModel,
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: schema,
      },
      messages: [
        {
          role: 'system',
          content: [
            'You extract explicit Bible references from live sermon transcripts for a church presentation system.',
            'Only return references that were clearly spoken or completed by the latest transcript chunk with help from recent context.',
            'Never guess based on themes, paraphrases, or verse wording alone.',
            'Use canonical Protestant book names exactly as one of these values:',
            SUPPORTED_BIBLE_BOOKS.join(', '),
            'If a verse range is mentioned, return only the first verse for now.',
            'Use high confidence only for explicit references. Use medium when the latest chunk completes a reference from the recent context. Use low sparingly.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            recent_context: recent,
            latest_transcript: latest,
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await readOpenAIError(response)
    throw new Error(detail || 'OpenAI could not extract scripture references.')
  }

  const payload = await response.json()
  const rawContent = payload?.choices?.[0]?.message?.content
  if (typeof rawContent !== 'string' || !rawContent.trim()) return []

  let parsed
  try {
    parsed = JSON.parse(rawContent)
  } catch {
    return []
  }

  const suggestions = Array.isArray(parsed?.references) ? parsed.references : []
  const unique = new Map()

  for (const suggestion of suggestions) {
    const normalized = normalizeModelSuggestion(suggestion)
    if (!normalized) continue
    if (!normalized.bookId) continue
    if ((suggestion?.confidence || '').toLowerCase() === 'low') continue
    if (!unique.has(normalized.canonicalId)) unique.set(normalized.canonicalId, normalized)
  }

  return Array.from(unique.values())
}

module.exports = {
  getOpenAIScriptureAssistSettings,
  transcribeAudioChunkWithOpenAI,
  extractScriptureSuggestionsWithOpenAI,
}
