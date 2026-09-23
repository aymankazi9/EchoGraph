import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { extractSlideText } from './extractor'
import type { SlideSource } from './extractor'

// ── Mock encryptText so tests run in Node without SubtleCrypto ───────────────
vi.mock('@/lib/crypto/encrypt', () => ({
  encryptText: async (_key: unknown, text: string) => `enc:${text}`,
}))

// ── Minimal PDFDocumentProxy stub ────────────────────────────────────────────
function makePdf(numPages: number): SlideSource['pdf'] {
  return {
    numPages,
    getPage: async (n: number) => ({
      getTextContent: async () => ({ items: [{ str: `slide ${n} content` }] }),
      cleanup: () => {},
    }),
  } as unknown as SlideSource['pdf']
}

// ── Minimal Supabase stub — captures rows passed to slides.insert ─────────
type InsertedRow = Record<string, unknown>

function makeMockDb() {
  const inserted: InsertedRow[] = []
  const supabase = {
    from: (_table: string) => ({
      insert: (rows: InsertedRow[]) => {
        inserted.push(...rows)
        return Promise.resolve({ error: null })
      },
    }),
  } as unknown as SupabaseClient
  return { supabase, inserted }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('extractSlideText', () => {
  it('2-file upload (10 + 15 pages) produces global_slide_index 1–25 with no collisions', async () => {
    const { supabase, inserted } = makeMockDb()

    await extractSlideText(
      [
        { fileId: 'file-a', pdf: makePdf(10) },
        { fileId: 'file-b', pdf: makePdf(15) },
      ],
      'session-x',
      null as unknown as CryptoKey,
      supabase,
    )

    expect(inserted).toHaveLength(25)

    // global_slide_index must be 1-25 with no gaps or duplicates
    const indices = inserted
      .map((r) => r.global_slide_index as number)
      .sort((a, b) => a - b)
    expect(indices).toEqual(Array.from({ length: 25 }, (_, i) => i + 1))
    expect(new Set(indices).size).toBe(25)

    // File A: pages 1-10 map to global indices 1-10
    const fileA = inserted.filter((r) => r.file_id === 'file-a')
    expect(fileA).toHaveLength(10)
    expect(fileA.map((r) => r.page_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(fileA.map((r) => r.global_slide_index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    // File B: pages 1-15 map to global indices 11-25
    const fileB = inserted.filter((r) => r.file_id === 'file-b')
    expect(fileB).toHaveLength(15)
    expect(fileB.map((r) => r.page_number)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    )
    expect(fileB.map((r) => r.global_slide_index)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 11),
    )
  })

  it('single-file session: global_slide_index equals page_number for every row', async () => {
    const { supabase, inserted } = makeMockDb()

    await extractSlideText(
      [{ fileId: 'file-single', pdf: makePdf(12) }],
      'session-y',
      null as unknown as CryptoKey,
      supabase,
    )

    expect(inserted).toHaveLength(12)
    for (const row of inserted) {
      expect(row.global_slide_index).toBe(row.page_number)
    }
  })

  it('each row carries the correct file_id and session_id', async () => {
    const { supabase, inserted } = makeMockDb()

    await extractSlideText(
      [
        { fileId: 'pdf-1', pdf: makePdf(3) },
        { fileId: 'pdf-2', pdf: makePdf(2) },
      ],
      'sess-42',
      null as unknown as CryptoKey,
      supabase,
    )

    expect(inserted.filter((r) => r.file_id === 'pdf-1')).toHaveLength(3)
    expect(inserted.filter((r) => r.file_id === 'pdf-2')).toHaveLength(2)
    expect(inserted.every((r) => r.session_id === 'sess-42')).toBe(true)
  })
})
