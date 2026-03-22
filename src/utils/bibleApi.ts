import type { BibleTranslation, BibleVerse, BibleChapter } from '@/types'

export type { BibleTranslation } from '@/types'

// ── Bolls.life Bible API ──────────────────────────────────────
// Free, no API key, clean JSON response
// Docs: https://bolls.life/api/
const BASE = 'https://bolls.life'

// ── Types ─────────────────────────────────────────────────────

export interface BibleBook {
  bookid:      number
  name:        string
  chapters:    number
  chronorder?: number
}

interface BollsVerse {
  pk:    number
  verse: number
  text:  string
}

interface BollsTranslation {
  short_name: string
  full_name:  string
  language?:  string
}

// ── Curated translation list (shown before API loads) ─────────
// These are confirmed working short_names on bolls.life
export const PRESET_TRANSLATIONS: BibleTranslation[] = [
  { id: 'KJV',   name: 'King James Version',           language: 'English' },
  { id: 'NKJV',  name: 'New King James Version',       language: 'English' },
  { id: 'NIV',   name: 'New International Version',    language: 'English' },
  { id: 'ESV',   name: 'English Standard Version',     language: 'English' },
  { id: 'NLT',   name: 'New Living Translation',       language: 'English' },
  { id: 'NASB',  name: 'New American Standard Bible',  language: 'English' },
  { id: 'AMP',   name: 'Amplified Bible',              language: 'English' },
  { id: 'MSG',   name: 'The Message',                  language: 'English' },
  { id: 'CEV',   name: 'Contemporary English Version', language: 'English' },
  { id: 'GNT',   name: 'Good News Translation',        language: 'English' },
  { id: 'NCV',   name: 'New Century Version',          language: 'English' },
  { id: 'HCSB',  name: 'Holman Christian Standard',    language: 'English' },
  { id: 'TLB',   name: 'The Living Bible',             language: 'English' },
  { id: 'WEB',   name: 'World English Bible',          language: 'English' },
  { id: 'ASV',   name: 'American Standard Version',    language: 'English' },
  { id: 'YLT',   name: "Young's Literal Translation",  language: 'English' },
]

// fallback alias
export const FALLBACK_TRANSLATIONS = PRESET_TRANSLATIONS

// ── Translations list from API ────────────────────────────────

let _translationsCache: BibleTranslation[] | null = null

export async function fetchTranslations(): Promise<BibleTranslation[]> {
  if (_translationsCache) return _translationsCache
  try {
    const res  = await fetch(`${BASE}/static/bolls/app/views/languages.json`)
    const data = await res.json() as BollsTranslation[]
    _translationsCache = data.map(t => ({
      id:       t.short_name,
      name:     t.full_name,
      language: t.language ?? 'Unknown',
    }))
    return _translationsCache
  } catch {
    return PRESET_TRANSLATIONS
  }
}

// ── Books ─────────────────────────────────────────────────────
// Bolls uses numeric bookids (1=Genesis … 66=Revelation)

const _booksCache: Record<string, BibleBook[]> = {}

export async function fetchBooks(translationId: string): Promise<BibleBook[]> {
  if (_booksCache[translationId]) return _booksCache[translationId]
  try {
    const res  = await fetch(`${BASE}/get-books/${translationId}/`)
    const data = await res.json() as BibleBook[]
    _booksCache[translationId] = data
    return data
  } catch {
    // Fallback: standard 66-book list with numeric ids
    return STANDARD_BOOKS
  }
}

// ── Chapter ───────────────────────────────────────────────────
// GET /get-text/{translation}/{bookid}/{chapter}/
// Returns: [{ pk, verse, text }]  — text may contain HTML tags

const _chapterCache: Record<string, BibleChapter> = {}

function stripHtml(html: string): string {
  return html
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Remove Strong's concordance numbers (standalone 3-5 digit numbers)
    .replace(/\b\d{3,5}\b/g, '')
    // Clean up multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Clean up spaces before punctuation
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

export async function fetchChapter(
  translationId: string,
  bookId: string,          // numeric string e.g. "43"
  chapter: number,
  bookName: string,
): Promise<BibleChapter | null> {
  const key = `${translationId}_${bookId}_${chapter}`
  if (_chapterCache[key]) return _chapterCache[key]
  try {
    const res  = await fetch(`${BASE}/get-text/${translationId}/${bookId}/${chapter}/`)
    const data = await res.json() as BollsVerse[]

    if (!Array.isArray(data) || data.length === 0) return null

    const result: BibleChapter = {
      book:    bookName,
      chapter,
      verses:  data.map(v => ({
        verse: v.verse,
        text:  stripHtml(v.text),
      })),
    }
    _chapterCache[key] = result
    return result
  } catch (err) {
    console.error('fetchChapter error:', err)
    return null
  }
}

// ── Single verse ──────────────────────────────────────────────

export async function fetchVerse(
  translationId: string,
  bookId: string,
  bookName: string,
  chapter: number,
  verse: number,
): Promise<BibleVerse | null> {
  const ch = await fetchChapter(translationId, bookId, chapter, bookName)
  if (!ch) return null
  const v = ch.verses.find(v => v.verse === verse)
  if (!v) return null
  return {
    book: bookName, chapter, verse, text: v.text,
    translation: translationId,
    reference: `${bookName} ${chapter}:${verse} (${translationId})`,
  }
}

// ── Search ────────────────────────────────────────────────────

export async function searchVerses(
  translationId: string,
  bookId: string,
  bookName: string,
  chapter: number,
  query: string,
): Promise<BibleVerse[]> {
  const ch = await fetchChapter(translationId, bookId, chapter, bookName)
  if (!ch) return []
  const q = query.toLowerCase()
  return ch.verses
    .filter(v => v.text.toLowerCase().includes(q))
    .map(v => ({
      book: bookName, chapter, verse: v.verse, text: v.text,
      translation: translationId,
      reference: `${bookName} ${chapter}:${v.verse} (${translationId})`,
    }))
}

// ── BOOK_ID_MAP: name → numeric bookid string ─────────────────
// Bolls uses numeric book ids (1–66)

export const BOOK_ID_MAP: Record<string, string> = {
  'Genesis': '1', 'Exodus': '2', 'Leviticus': '3', 'Numbers': '4',
  'Deuteronomy': '5', 'Joshua': '6', 'Judges': '7', 'Ruth': '8',
  '1 Samuel': '9', '2 Samuel': '10', '1 Kings': '11', '2 Kings': '12',
  '1 Chronicles': '13', '2 Chronicles': '14', 'Ezra': '15', 'Nehemiah': '16',
  'Esther': '17', 'Job': '18', 'Psalms': '19', 'Proverbs': '20',
  'Ecclesiastes': '21', 'Song of Solomon': '22', 'Isaiah': '23', 'Jeremiah': '24',
  'Lamentations': '25', 'Ezekiel': '26', 'Daniel': '27', 'Hosea': '28',
  'Joel': '29', 'Amos': '30', 'Obadiah': '31', 'Jonah': '32',
  'Micah': '33', 'Nahum': '34', 'Habakkuk': '35', 'Zephaniah': '36',
  'Haggai': '37', 'Zechariah': '38', 'Malachi': '39',
  'Matthew': '40', 'Mark': '41', 'Luke': '42', 'John': '43',
  'Acts': '44', 'Romans': '45', '1 Corinthians': '46', '2 Corinthians': '47',
  'Galatians': '48', 'Ephesians': '49', 'Philippians': '50', 'Colossians': '51',
  '1 Thessalonians': '52', '2 Thessalonians': '53', '1 Timothy': '54',
  '2 Timothy': '55', 'Titus': '56', 'Philemon': '57', 'Hebrews': '58',
  'James': '59', '1 Peter': '60', '2 Peter': '61', '1 John': '62',
  '2 John': '63', '3 John': '64', 'Jude': '65', 'Revelation': '66',
}

// ── Standard 66 books fallback ────────────────────────────────

export const STANDARD_BOOKS: BibleBook[] = [
  { bookid: 1,  name: 'Genesis',         chapters: 50 },
  { bookid: 2,  name: 'Exodus',          chapters: 40 },
  { bookid: 3,  name: 'Leviticus',       chapters: 27 },
  { bookid: 4,  name: 'Numbers',         chapters: 36 },
  { bookid: 5,  name: 'Deuteronomy',     chapters: 34 },
  { bookid: 6,  name: 'Joshua',          chapters: 24 },
  { bookid: 7,  name: 'Judges',          chapters: 21 },
  { bookid: 8,  name: 'Ruth',            chapters: 4  },
  { bookid: 9,  name: '1 Samuel',        chapters: 31 },
  { bookid: 10, name: '2 Samuel',        chapters: 24 },
  { bookid: 11, name: '1 Kings',         chapters: 22 },
  { bookid: 12, name: '2 Kings',         chapters: 25 },
  { bookid: 13, name: '1 Chronicles',    chapters: 29 },
  { bookid: 14, name: '2 Chronicles',    chapters: 36 },
  { bookid: 15, name: 'Ezra',            chapters: 10 },
  { bookid: 16, name: 'Nehemiah',        chapters: 13 },
  { bookid: 17, name: 'Esther',          chapters: 10 },
  { bookid: 18, name: 'Job',             chapters: 42 },
  { bookid: 19, name: 'Psalms',          chapters: 150 },
  { bookid: 20, name: 'Proverbs',        chapters: 31 },
  { bookid: 21, name: 'Ecclesiastes',    chapters: 12 },
  { bookid: 22, name: 'Song of Solomon', chapters: 8  },
  { bookid: 23, name: 'Isaiah',          chapters: 66 },
  { bookid: 24, name: 'Jeremiah',        chapters: 52 },
  { bookid: 25, name: 'Lamentations',    chapters: 5  },
  { bookid: 26, name: 'Ezekiel',         chapters: 48 },
  { bookid: 27, name: 'Daniel',          chapters: 12 },
  { bookid: 28, name: 'Hosea',           chapters: 14 },
  { bookid: 29, name: 'Joel',            chapters: 3  },
  { bookid: 30, name: 'Amos',            chapters: 9  },
  { bookid: 31, name: 'Obadiah',         chapters: 1  },
  { bookid: 32, name: 'Jonah',           chapters: 4  },
  { bookid: 33, name: 'Micah',           chapters: 7  },
  { bookid: 34, name: 'Nahum',           chapters: 3  },
  { bookid: 35, name: 'Habakkuk',        chapters: 3  },
  { bookid: 36, name: 'Zephaniah',       chapters: 3  },
  { bookid: 37, name: 'Haggai',          chapters: 2  },
  { bookid: 38, name: 'Zechariah',       chapters: 14 },
  { bookid: 39, name: 'Malachi',         chapters: 4  },
  { bookid: 40, name: 'Matthew',         chapters: 28 },
  { bookid: 41, name: 'Mark',            chapters: 16 },
  { bookid: 42, name: 'Luke',            chapters: 24 },
  { bookid: 43, name: 'John',            chapters: 21 },
  { bookid: 44, name: 'Acts',            chapters: 28 },
  { bookid: 45, name: 'Romans',          chapters: 16 },
  { bookid: 46, name: '1 Corinthians',   chapters: 16 },
  { bookid: 47, name: '2 Corinthians',   chapters: 13 },
  { bookid: 48, name: 'Galatians',       chapters: 6  },
  { bookid: 49, name: 'Ephesians',       chapters: 6  },
  { bookid: 50, name: 'Philippians',     chapters: 4  },
  { bookid: 51, name: 'Colossians',      chapters: 4  },
  { bookid: 52, name: '1 Thessalonians', chapters: 5  },
  { bookid: 53, name: '2 Thessalonians', chapters: 3  },
  { bookid: 54, name: '1 Timothy',       chapters: 6  },
  { bookid: 55, name: '2 Timothy',       chapters: 4  },
  { bookid: 56, name: 'Titus',           chapters: 3  },
  { bookid: 57, name: 'Philemon',        chapters: 1  },
  { bookid: 58, name: 'Hebrews',         chapters: 13 },
  { bookid: 59, name: 'James',           chapters: 5  },
  { bookid: 60, name: '1 Peter',         chapters: 5  },
  { bookid: 61, name: '2 Peter',         chapters: 3  },
  { bookid: 62, name: '1 John',          chapters: 5  },
  { bookid: 63, name: '2 John',          chapters: 1  },
  { bookid: 64, name: '3 John',          chapters: 1  },
  { bookid: 65, name: 'Jude',            chapters: 1  },
  { bookid: 66, name: 'Revelation',      chapters: 22 },
]