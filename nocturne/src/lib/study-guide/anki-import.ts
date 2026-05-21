// Browser-only. Parses an Anki .apkg file and returns card fronts as keyword list.
// .apkg is a zip containing collection.anki2 (SQLite database).
// Uses JSZip for zip extraction and sql.js for SQLite reading.

import JSZip from 'jszip'
import initSqlJs from 'sql.js'

let sqlJsReady: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null

function getSqlJs() {
  if (!sqlJsReady) {
    sqlJsReady = initSqlJs({
      // Use CDN-hosted WASM to avoid bundling it.
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/${file}`,
    })
  }
  return sqlJsReady
}

/**
 * Extracts card front text from an Anki .apkg file.
 * Returns a deduplicated list of plain-text strings (HTML stripped).
 */
export async function extractApkg(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(arrayBuffer)

  // Anki 2.1 uses collection.anki21; older uses collection.anki2
  const dbFile = zip.file('collection.anki21') ?? zip.file('collection.anki2')
  if (!dbFile) throw new Error('Invalid .apkg: no SQLite collection found.')

  const dbBuffer = await dbFile.async('arraybuffer')

  const SQL = await getSqlJs()
  const db = new SQL.Database(new Uint8Array(dbBuffer))

  // notes.flds stores fields separated by \x1f (ASCII unit separator).
  // The first field is the card front.
  const results = db.exec('SELECT flds FROM notes')
  db.close()

  if (!results[0]) return []

  const seen = new Set<string>()
  const terms: string[] = []

  for (const row of results[0].values) {
    const flds = row[0] as string
    const front = flds.split('\x1f')[0] ?? ''
    // Strip HTML tags and trim
    const plain = front.replace(/<[^>]+>/g, '').trim().toLowerCase()
    if (plain.length >= 2 && plain.length <= 80 && !seen.has(plain)) {
      seen.add(plain)
      terms.push(plain)
    }
  }

  return terms
}
