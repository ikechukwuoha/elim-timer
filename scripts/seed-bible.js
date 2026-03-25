// scripts/seed-bible.js
// Run ONCE with internet: node scripts/seed-bible.js
// Fetches 20 major translations from bolls.life and stores in bible.db (SQLite)

const Database = require('better-sqlite3')
const path     = require('path')
const fs       = require('fs')

const DB_PATH = path.join(__dirname, '..', 'bible.db')

const TRANSLATIONS = [
  // English
  { id: 'KJV',   name: 'King James Version',           language: 'English' },
  { id: 'NKJV',  name: 'New King James Version',       language: 'English' },
  { id: 'NIV',   name: 'New International Version',    language: 'English' },
  { id: 'ESV',   name: 'English Standard Version',     language: 'English' },
  { id: 'NLT',   name: 'New Living Translation',       language: 'English' },
  { id: 'NASB',  name: 'New American Standard Bible',  language: 'English' },
  { id: 'AMP',   name: 'Amplified Bible',              language: 'English' },
  { id: 'MSG',   name: 'The Message',                  language: 'English' },
  { id: 'CSB',   name: 'Christian Standard Bible',     language: 'English' },
  { id: 'NET',   name: 'New English Translation',      language: 'English' },
  // Other major languages
  { id: 'RVR60', name: 'Reina Valera 1960',            language: 'Spanish' },
  { id: 'NVI',   name: 'Nueva Versión Internacional',  language: 'Spanish' },
  { id: 'LSG',   name: 'Louis Segond',                 language: 'French'  },
  { id: 'LUT',   name: 'Luther Bibel',                 language: 'German'  },
  { id: 'NR06',  name: 'Nuova Riveduta 2006',          language: 'Italian' },
  { id: 'RUSV',  name: 'Russian Synodal Version',      language: 'Russian' },
  { id: 'UKR',   name: 'Ukrainian Bible',              language: 'Ukrainian'},
  { id: 'TR',    name: 'Textus Receptus (Greek)',      language: 'Greek'   },
  { id: 'BHS',   name: 'Hebrew Bible (BHS)',           language: 'Hebrew'  },
  { id: 'VUL',   name: 'Latin Vulgate',                language: 'Latin'   },
]

const BASE = 'https://bolls.life'
const DELAY_MS = 400   // be polite — don't hammer the API

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json()
}

async function main() {
  // ── Create / open DB ───────────────────────────────────────
  const db = new Database(DB_PATH)

  db.exec(`
    CREATE TABLE IF NOT EXISTS translations (
      id       TEXT PRIMARY KEY,
      name     TEXT NOT NULL,
      language TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      translation   TEXT NOT NULL,
      book_id       INTEGER NOT NULL,
      name          TEXT NOT NULL,
      chapters      INTEGER NOT NULL DEFAULT 0,
      UNIQUE(translation, book_id)
    );

    CREATE TABLE IF NOT EXISTS verses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      translation TEXT NOT NULL,
      book_id     INTEGER NOT NULL,
      chapter     INTEGER NOT NULL,
      verse       INTEGER NOT NULL,
      text        TEXT NOT NULL,
      UNIQUE(translation, book_id, chapter, verse)
    );

    CREATE INDEX IF NOT EXISTS idx_verses_lookup
      ON verses(translation, book_id, chapter);
  `)

  const insertTranslation = db.prepare(
    `INSERT OR IGNORE INTO translations(id, name, language) VALUES(?,?,?)`
  )
  const insertBook = db.prepare(
    `INSERT OR IGNORE INTO books(translation, book_id, name, chapters) VALUES(?,?,?,?)`
  )
  const insertVerse = db.prepare(
    `INSERT OR IGNORE INTO verses(translation, book_id, chapter, verse, text) VALUES(?,?,?,?,?)`
  )

  // Wrap bulk inserts in a transaction for 100x speed
  const insertVersesBulk = db.transaction((rows) => {
    for (const r of rows) insertVerse.run(r.translation, r.bookId, r.chapter, r.verse, r.text)
  })

  for (const translation of TRANSLATIONS) {
    console.log(`\n📖  ${translation.id} — ${translation.name}`)
    insertTranslation.run(translation.id, translation.name, translation.language)

    // ── Fetch book list ──────────────────────────────────────
    let books
    try {
      books = await fetchJSON(`${BASE}/get-books/${translation.id}/`)
    } catch (e) {
      console.warn(`  ⚠  Could not fetch books for ${translation.id}: ${e.message}`)
      continue
    }

    if (!Array.isArray(books) || books.length === 0) {
      console.warn(`  ⚠  No books returned for ${translation.id}`)
      continue
    }

    console.log(`    ${books.length} books found`)

    for (const book of books) {
      const bookId   = book.bookid ?? book.book_id ?? book.id
      const bookName = book.name
      const chapters = book.chapters ?? 0
      insertBook.run(translation.id, bookId, bookName, chapters)

      // ── Fetch every chapter ────────────────────────────────
      const totalChapters = chapters || 50  // fallback if API doesn't give count
      process.stdout.write(`    ${bookName}: `)

      for (let ch = 1; ch <= totalChapters; ch++) {
        try {
          const verses = await fetchJSON(`${BASE}/get-text/${translation.id}/${bookId}/${ch}/`)

          if (!Array.isArray(verses) || verses.length === 0) {
            // Hit a chapter beyond the book's end — stop
            break
          }

          const rows = verses.map(v => ({
            translation: translation.id,
            bookId,
            chapter: ch,
            verse:   v.verse,
            text:    v.text,
          }))
          insertVersesBulk(rows)
          process.stdout.write('.')
          await sleep(DELAY_MS)

        } catch (e) {
          process.stdout.write('✕')
          console.warn(`\n  ⚠  Error at ${translation.id} ${bookName} ${ch}: ${e.message}`)
          await sleep(1000)
        }
      }
      process.stdout.write('\n')
    }

    console.log(`  ✅  ${translation.id} done`)
  }

  db.close()
  const stats = fs.statSync(DB_PATH)
  const mb    = (stats.size / 1024 / 1024).toFixed(1)
  console.log(`\n🎉  Seed complete — bible.db is ${mb} MB`)
}

main().catch(e => { console.error(e); process.exit(1) })
