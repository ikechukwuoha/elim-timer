// @ts-nocheck
// scripts/seed-bible.js
const Database = require('better-sqlite3')
const path     = require('path')
const fs       = require('fs')

const DB_PATH  = path.join(__dirname, '..', 'bible.db')
const BOLLS    = 'https://bolls.life'
const DELAY_MS = 400

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.json()
}

function stripText(raw) {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/[GH]\d{3,4}/g, '')
    .replace(/\[[\d]+\]/g, '')
    .replace(/\b\d{3,5}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

const STANDARD_BOOKS = [
  { bookid: 1,  name: 'Genesis',         chapters: 50  },
  { bookid: 2,  name: 'Exodus',          chapters: 40  },
  { bookid: 3,  name: 'Leviticus',       chapters: 27  },
  { bookid: 4,  name: 'Numbers',         chapters: 36  },
  { bookid: 5,  name: 'Deuteronomy',     chapters: 34  },
  { bookid: 6,  name: 'Joshua',          chapters: 24  },
  { bookid: 7,  name: 'Judges',          chapters: 21  },
  { bookid: 8,  name: 'Ruth',            chapters: 4   },
  { bookid: 9,  name: '1 Samuel',        chapters: 31  },
  { bookid: 10, name: '2 Samuel',        chapters: 24  },
  { bookid: 11, name: '1 Kings',         chapters: 22  },
  { bookid: 12, name: '2 Kings',         chapters: 25  },
  { bookid: 13, name: '1 Chronicles',    chapters: 29  },
  { bookid: 14, name: '2 Chronicles',    chapters: 36  },
  { bookid: 15, name: 'Ezra',            chapters: 10  },
  { bookid: 16, name: 'Nehemiah',        chapters: 13  },
  { bookid: 17, name: 'Esther',          chapters: 10  },
  { bookid: 18, name: 'Job',             chapters: 42  },
  { bookid: 19, name: 'Psalms',          chapters: 150 },
  { bookid: 20, name: 'Proverbs',        chapters: 31  },
  { bookid: 21, name: 'Ecclesiastes',    chapters: 12  },
  { bookid: 22, name: 'Song of Solomon', chapters: 8   },
  { bookid: 23, name: 'Isaiah',          chapters: 66  },
  { bookid: 24, name: 'Jeremiah',        chapters: 52  },
  { bookid: 25, name: 'Lamentations',    chapters: 5   },
  { bookid: 26, name: 'Ezekiel',         chapters: 48  },
  { bookid: 27, name: 'Daniel',          chapters: 12  },
  { bookid: 28, name: 'Hosea',           chapters: 14  },
  { bookid: 29, name: 'Joel',            chapters: 3   },
  { bookid: 30, name: 'Amos',            chapters: 9   },
  { bookid: 31, name: 'Obadiah',         chapters: 1   },
  { bookid: 32, name: 'Jonah',           chapters: 4   },
  { bookid: 33, name: 'Micah',           chapters: 7   },
  { bookid: 34, name: 'Nahum',           chapters: 3   },
  { bookid: 35, name: 'Habakkuk',        chapters: 3   },
  { bookid: 36, name: 'Zephaniah',       chapters: 3   },
  { bookid: 37, name: 'Haggai',          chapters: 2   },
  { bookid: 38, name: 'Zechariah',       chapters: 14  },
  { bookid: 39, name: 'Malachi',         chapters: 4   },
  { bookid: 40, name: 'Matthew',         chapters: 28  },
  { bookid: 41, name: 'Mark',            chapters: 16  },
  { bookid: 42, name: 'Luke',            chapters: 24  },
  { bookid: 43, name: 'John',            chapters: 21  },
  { bookid: 44, name: 'Acts',            chapters: 28  },
  { bookid: 45, name: 'Romans',          chapters: 16  },
  { bookid: 46, name: '1 Corinthians',   chapters: 16  },
  { bookid: 47, name: '2 Corinthians',   chapters: 13  },
  { bookid: 48, name: 'Galatians',       chapters: 6   },
  { bookid: 49, name: 'Ephesians',       chapters: 6   },
  { bookid: 50, name: 'Philippians',     chapters: 4   },
  { bookid: 51, name: 'Colossians',      chapters: 4   },
  { bookid: 52, name: '1 Thessalonians', chapters: 5   },
  { bookid: 53, name: '2 Thessalonians', chapters: 3   },
  { bookid: 54, name: '1 Timothy',       chapters: 6   },
  { bookid: 55, name: '2 Timothy',       chapters: 4   },
  { bookid: 56, name: 'Titus',           chapters: 3   },
  { bookid: 57, name: 'Philemon',        chapters: 1   },
  { bookid: 58, name: 'Hebrews',         chapters: 13  },
  { bookid: 59, name: 'James',           chapters: 5   },
  { bookid: 60, name: '1 Peter',         chapters: 5   },
  { bookid: 61, name: '2 Peter',         chapters: 3   },
  { bookid: 62, name: '1 John',          chapters: 5   },
  { bookid: 63, name: '2 John',          chapters: 1   },
  { bookid: 64, name: '3 John',          chapters: 1   },
  { bookid: 65, name: 'Jude',            chapters: 1   },
  { bookid: 66, name: 'Revelation',      chapters: 22  },
]

async function seedKJV(db) {
  console.log('\n📖  KJV — King James Version (local file)')

  const insertTranslation = db.prepare(
    'INSERT OR REPLACE INTO translations(id, name, language) VALUES(?,?,?)'
  )
  const insertBook = db.prepare(
    'INSERT OR IGNORE INTO books(translation, book_id, name, chapters) VALUES(?,?,?,?)'
  )
  const insertVerse = db.prepare(
    'INSERT OR REPLACE INTO verses(translation, book_id, chapter, verse, text) VALUES(?,?,?,?,?)'
  )
  const insertVersesBulk = db.transaction((rows) => {
    for (const r of rows) insertVerse.run('KJV', r.b, r.c, r.v, r.t)
  })

  insertTranslation.run('KJV', 'King James Version', 'English')
  for (const book of STANDARD_BOOKS) {
    insertBook.run('KJV', book.bookid, book.name, book.chapters)
  }

  console.log('  Reading t_kjv.json from /tmp...')
  const raw = JSON.parse(require('fs').readFileSync('/tmp/t_kjv.json', 'utf8'))
  const rows = raw?.resultset?.row

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('t_kjv.json is empty or invalid')
  }

  // shape: { field: [id, b, c, v, text] }
  const verses = rows.map(r => ({
    b: r.field[1],
    c: r.field[2],
    v: r.field[3],
    t: r.field[4],
  }))

  const CHUNK = 1000
  for (let i = 0; i < verses.length; i += CHUNK) {
    insertVersesBulk(verses.slice(i, i + CHUNK))
    process.stdout.write('.')
  }
  console.log(`  ✅  KJV done — ${verses.length} verses`)
}

async function seedNKJV(db) {
  console.log('\n📖  NKJV — New King James Version (bolls.life, stripped)')

  const insertTranslation = db.prepare(
    'INSERT OR REPLACE INTO translations(id, name, language) VALUES(?,?,?)'
  )
  const insertBook = db.prepare(
    'INSERT OR IGNORE INTO books(translation, book_id, name, chapters) VALUES(?,?,?,?)'
  )
  const insertVerse = db.prepare(
    'INSERT OR REPLACE INTO verses(translation, book_id, chapter, verse, text) VALUES(?,?,?,?,?)'
  )
  const insertVersesBulk = db.transaction((rows) => {
    for (const r of rows) insertVerse.run(r.translation, r.bookId, r.chapter, r.verse, r.text)
  })

  insertTranslation.run('NKJV', 'New King James Version', 'English')

  let books
  try {
    books = await fetchJSON(`${BOLLS}/get-books/NKJV/`)
  } catch (e) {
    console.warn(`  ⚠  Could not fetch NKJV books: ${e.message}`)
    return
  }

  console.log(`    ${books.length} books found`)

  for (const book of books) {
    const bookId        = book.bookid ?? book.book_id ?? book.id
    const bookName      = book.name
    const totalChapters = book.chapters || 50
    insertBook.run('NKJV', bookId, bookName, book.chapters ?? 0)

    process.stdout.write(`    ${bookName}: `)

    for (let ch = 1; ch <= totalChapters; ch++) {
      try {
        const verses = await fetchJSON(`${BOLLS}/get-text/NKJV/${bookId}/${ch}/`)
        if (!Array.isArray(verses) || verses.length === 0) break

        const rows = verses.map(v => ({
          translation: 'NKJV',
          bookId,
          chapter: ch,
          verse:   v.verse,
          text:    stripText(v.text),
        }))
        insertVersesBulk(rows)
        process.stdout.write('.')
        await sleep(DELAY_MS)
      } catch (e) {
        process.stdout.write('✕')
        console.warn(`\n  ⚠  Error at NKJV ${bookName} ${ch}: ${e.message}`)
        await sleep(1000)
      }
    }
    process.stdout.write('\n')
  }

  console.log('  ✅  NKJV done')
}

async function main() {
  const db = new Database(DB_PATH)

  db.exec(`
    CREATE TABLE IF NOT EXISTS translations (
      id       TEXT PRIMARY KEY,
      name     TEXT NOT NULL,
      language TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS books (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      translation TEXT NOT NULL,
      book_id     INTEGER NOT NULL,
      name        TEXT NOT NULL,
      chapters    INTEGER NOT NULL DEFAULT 0,
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

  await seedKJV(db)
  await seedNKJV(db)

  db.close()
  const stats = fs.statSync(DB_PATH)
  const mb    = (stats.size / 1024 / 1024).toFixed(1)
  console.log(`\n🎉  Seed complete — bible.db is ${mb} MB`)
}

main().catch(e => { console.error(e); process.exit(1) })















// // scripts/seed-bible.js
// // Run ONCE with internet: node scripts/seed-bible.js
// // Fetches 20 major translations from bolls.life and stores in bible.db (SQLite)

// const Database = require('better-sqlite3')
// const path     = require('path')
// const fs       = require('fs')

// const DB_PATH = path.join(__dirname, '..', 'bible.db')

// const TRANSLATIONS = [
//   // English
//   { id: 'KJV',   name: 'King James Version',           language: 'English' },
//   { id: 'NKJV',  name: 'New King James Version',       language: 'English' },
//   { id: 'NIV',   name: 'New International Version',    language: 'English' },
//   { id: 'ESV',   name: 'English Standard Version',     language: 'English' },
//   { id: 'NLT',   name: 'New Living Translation',       language: 'English' },
//   { id: 'NASB',  name: 'New American Standard Bible',  language: 'English' },
//   { id: 'AMP',   name: 'Amplified Bible',              language: 'English' },
//   { id: 'MSG',   name: 'The Message',                  language: 'English' },
//   { id: 'CSB',   name: 'Christian Standard Bible',     language: 'English' },
//   { id: 'NET',   name: 'New English Translation',      language: 'English' },
//   // Other major languages
//   { id: 'RVR60', name: 'Reina Valera 1960',            language: 'Spanish' },
//   { id: 'NVI',   name: 'Nueva Versión Internacional',  language: 'Spanish' },
//   { id: 'LSG',   name: 'Louis Segond',                 language: 'French'  },
//   { id: 'LUT',   name: 'Luther Bibel',                 language: 'German'  },
//   { id: 'NR06',  name: 'Nuova Riveduta 2006',          language: 'Italian' },
//   { id: 'RUSV',  name: 'Russian Synodal Version',      language: 'Russian' },
//   { id: 'UKR',   name: 'Ukrainian Bible',              language: 'Ukrainian'},
//   { id: 'TR',    name: 'Textus Receptus (Greek)',      language: 'Greek'   },
//   { id: 'BHS',   name: 'Hebrew Bible (BHS)',           language: 'Hebrew'  },
//   { id: 'VUL',   name: 'Latin Vulgate',                language: 'Latin'   },
// ]

// const BASE = 'https://bolls.life'
// const DELAY_MS = 400   // be polite — don't hammer the API

// function sleep(ms) {
//   return new Promise(r => setTimeout(r, ms))
// }

// async function fetchJSON(url) {
//   const res = await fetch(url)
//   if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
//   return res.json()
// }

// async function main() {
//   // ── Create / open DB ───────────────────────────────────────
//   const db = new Database(DB_PATH)

//   db.exec(`
//     CREATE TABLE IF NOT EXISTS translations (
//       id       TEXT PRIMARY KEY,
//       name     TEXT NOT NULL,
//       language TEXT NOT NULL
//     );

//     CREATE TABLE IF NOT EXISTS books (
//       id            INTEGER PRIMARY KEY AUTOINCREMENT,
//       translation   TEXT NOT NULL,
//       book_id       INTEGER NOT NULL,
//       name          TEXT NOT NULL,
//       chapters      INTEGER NOT NULL DEFAULT 0,
//       UNIQUE(translation, book_id)
//     );

//     CREATE TABLE IF NOT EXISTS verses (
//       id          INTEGER PRIMARY KEY AUTOINCREMENT,
//       translation TEXT NOT NULL,
//       book_id     INTEGER NOT NULL,
//       chapter     INTEGER NOT NULL,
//       verse       INTEGER NOT NULL,
//       text        TEXT NOT NULL,
//       UNIQUE(translation, book_id, chapter, verse)
//     );

//     CREATE INDEX IF NOT EXISTS idx_verses_lookup
//       ON verses(translation, book_id, chapter);
//   `)

//   const insertTranslation = db.prepare(
//     `INSERT OR IGNORE INTO translations(id, name, language) VALUES(?,?,?)`
//   )
//   const insertBook = db.prepare(
//     `INSERT OR IGNORE INTO books(translation, book_id, name, chapters) VALUES(?,?,?,?)`
//   )
//   const insertVerse = db.prepare(
//     `INSERT OR IGNORE INTO verses(translation, book_id, chapter, verse, text) VALUES(?,?,?,?,?)`
//   )

//   // Wrap bulk inserts in a transaction for 100x speed
//   const insertVersesBulk = db.transaction((rows) => {
//     for (const r of rows) insertVerse.run(r.translation, r.bookId, r.chapter, r.verse, r.text)
//   })

//   for (const translation of TRANSLATIONS) {
//     console.log(`\n📖  ${translation.id} — ${translation.name}`)
//     insertTranslation.run(translation.id, translation.name, translation.language)

//     // ── Fetch book list ──────────────────────────────────────
//     let books
//     try {
//       books = await fetchJSON(`${BASE}/get-books/${translation.id}/`)
//     } catch (e) {
//       console.warn(`  ⚠  Could not fetch books for ${translation.id}: ${e.message}`)
//       continue
//     }

//     if (!Array.isArray(books) || books.length === 0) {
//       console.warn(`  ⚠  No books returned for ${translation.id}`)
//       continue
//     }

//     console.log(`    ${books.length} books found`)

//     for (const book of books) {
//       const bookId   = book.bookid ?? book.book_id ?? book.id
//       const bookName = book.name
//       const chapters = book.chapters ?? 0
//       insertBook.run(translation.id, bookId, bookName, chapters)

//       // ── Fetch every chapter ────────────────────────────────
//       const totalChapters = chapters || 50  // fallback if API doesn't give count
//       process.stdout.write(`    ${bookName}: `)

//       for (let ch = 1; ch <= totalChapters; ch++) {
//         try {
//           const verses = await fetchJSON(`${BASE}/get-text/${translation.id}/${bookId}/${ch}/`)

//           if (!Array.isArray(verses) || verses.length === 0) {
//             // Hit a chapter beyond the book's end — stop
//             break
//           }

//           const rows = verses.map(v => ({
//             translation: translation.id,
//             bookId,
//             chapter: ch,
//             verse:   v.verse,
//             text:    v.text,
//           }))
//           insertVersesBulk(rows)
//           process.stdout.write('.')
//           await sleep(DELAY_MS)

//         } catch (e) {
//           process.stdout.write('✕')
//           console.warn(`\n  ⚠  Error at ${translation.id} ${bookName} ${ch}: ${e.message}`)
//           await sleep(1000)
//         }
//       }
//       process.stdout.write('\n')
//     }

//     console.log(`  ✅  ${translation.id} done`)
//   }

//   db.close()
//   const stats = fs.statSync(DB_PATH)
//   const mb    = (stats.size / 1024 / 1024).toFixed(1)
//   console.log(`\n🎉  Seed complete — bible.db is ${mb} MB`)
// }

// main().catch(e => { console.error(e); process.exit(1) })
