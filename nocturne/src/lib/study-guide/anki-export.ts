// Browser-only. Generates a valid Anki .apkg from a flashcard set.
// Uses sql.js for SQLite creation and JSZip for packaging.

import JSZip from 'jszip'
import initSqlJs from 'sql.js'

import type { Flashcard } from '@/lib/scoring/flashcard-generator'

let sqlJsReady: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null

function getSqlJs() {
  if (!sqlJsReady) {
    sqlJsReady = initSqlJs({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/${file}`,
    })
  }
  return sqlJsReady
}

// ─── Anki schema helpers ───────────────────────────────────────────────────────

// Anki uses epoch seconds for creation timestamps.
function nowSec() {
  return Math.floor(Date.now() / 1000)
}

// Simple CRC32-based field checksum Anki requires on notes.sfld
function sfld(front: string): number {
  // Anki uses CRC32 of the front field stripped of HTML.
  // We approximate with a fast hash — sufficient for valid apkg generation.
  let hash = 0
  for (let i = 0; i < front.length; i++) {
    hash = (Math.imul(31, hash) + front.charCodeAt(i)) >>> 0
  }
  return hash
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a minimal valid Anki .apkg containing one note per flashcard.
 * Returns a Uint8Array suitable for download via a Blob URL.
 */
export async function generateApkg(
  flashcards: Flashcard[],
  deckName: string,
): Promise<Uint8Array> {
  const SQL = await getSqlJs()
  const db = new SQL.Database()

  const deckId = 1
  const modelId = 1
  const nowS = nowSec()

  // ── Schema ─────────────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS col (
      id integer PRIMARY KEY,
      crt integer,
      mod integer,
      scm integer,
      ver integer,
      dty integer,
      usn integer,
      ls  integer,
      conf text,
      models text,
      decks text,
      dconf text,
      tags text
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id    integer PRIMARY KEY,
      guid  text,
      mid   integer,
      mod   integer,
      usn   integer,
      tags  text,
      flds  text,
      sfld  integer,
      csum  integer,
      flags integer,
      data  text
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id    integer PRIMARY KEY,
      nid   integer,
      did   integer,
      ord   integer,
      mod   integer,
      usn   integer,
      type  integer,
      queue integer,
      due   integer,
      ivl   integer,
      factor integer,
      reps  integer,
      lapses integer,
      left  integer,
      odue  integer,
      odid  integer,
      flags integer,
      data  text
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS graves (
      usn integer, oid integer, type integer
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS revlog (
      id integer PRIMARY KEY, cid integer, usn integer, ease integer,
      ivl integer, lastIvl integer, factor integer, time integer, type integer
    )
  `)

  // ── Model (Basic note type) ─────────────────────────────────────────────────
  const model = {
    [modelId]: {
      id: modelId,
      name: 'Basic',
      type: 0,
      mod: nowS,
      usn: -1,
      sortf: 0,
      did: null,
      tmpls: [{
        name: 'Card 1',
        ord: 0,
        qfmt: '{{Front}}',
        afmt: '{{FrontSide}}<hr id=answer>{{Back}}',
        bqfmt: '',
        bafmt: '',
        did: null,
        bfont: '',
        bsize: 0,
      }],
      flds: [
        { name: 'Front', ord: 0, sticky: false, rtl: false, font: 'Arial', size: 20 },
        { name: 'Back', ord: 1, sticky: false, rtl: false, font: 'Arial', size: 20 },
      ],
      css: '.card { font-family: Arial; font-size: 20px; text-align: center; }',
      latexPre: '',
      latexPost: '',
      tags: [],
      vers: [],
    },
  }

  // ── Deck ────────────────────────────────────────────────────────────────────
  const deck = {
    [deckId]: {
      id: deckId,
      name: deckName,
      desc: '',
      usn: -1,
      mod: nowS,
      collapsed: false,
      newToday: [0, 0],
      revToday: [0, 0],
      lrnToday: [0, 0],
      timeToday: [0, 0],
      conf: 1,
      extendRev: 50,
      extendNew: 10,
      dyn: 0,
    },
  }

  const dconf = {
    1: {
      id: 1, name: 'Default', replayq: true, lapse: {}, rev: {}, new: {},
      autoplay: true, timer: 0, maxTaken: 60, usn: -1, mod: nowS,
    },
  }

  db.run(
    `INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      1, nowS, nowS, nowS, 11, 0, -1, 0,
      '{}',
      JSON.stringify(model),
      JSON.stringify(deck),
      JSON.stringify(dconf),
      '{}',
    ],
  )

  // ── Notes + Cards ────────────────────────────────────────────────────────────
  const stmtNote = db.prepare(
    `INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  )
  const stmtCard = db.prepare(
    `INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  )

  flashcards.forEach((fc, i) => {
    const noteId = nowS * 1000 + i
    const cardId = noteId + 1
    const flds = `${fc.front}\x1f${fc.back}`
    const tags = fc.zone === 'red' ? 'red-zone' : 'likely-zone'

    stmtNote.run([noteId, crypto.randomUUID(), modelId, nowS, -1, tags, flds, sfld(fc.front), sfld(fc.front), 0, ''])
    stmtCard.run([cardId, noteId, deckId, 0, nowS, -1, 0, 0, i, 0, 2500, 0, 0, 0, 0, 0, 0, ''])
  })

  stmtNote.free()
  stmtCard.free()

  const dbData = db.export()
  db.close()

  const zip = new JSZip()
  zip.file('collection.anki2', dbData)
  zip.file('media', '{}')

  return zip.generateAsync({ type: 'uint8array' })
}
