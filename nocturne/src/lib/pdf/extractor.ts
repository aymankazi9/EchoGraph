// Browser-only — import only from 'use client' components.

import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptText } from '@/lib/crypto/encrypt'

// A single PDF source, ordered by session_files.order_index.
export interface SlideSource {
  fileId: string
  pdf: PDFDocumentProxy
}

/**
 * Extracts text from every page of every source PDF, encrypts it, and inserts
 * one slides row per page. page_number is 1-based within each source file;
 * global_slide_index is 1-based and cumulative across all sources in order.
 *
 * For single-source sessions global_slide_index == page_number; for multi-
 * source sessions the second file's global indices start where the first left
 * off. This is the canonical citation index used in sync_map, flashcards, and
 * the Ask tab — raw page_number should not be used as a citation.
 */
export async function extractSlideText(
  sources: SlideSource[],
  sessionId: string,
  masterKey: CryptoKey,
  supabase: SupabaseClient,
): Promise<void> {
  const rows: {
    id: string
    session_id: string
    file_id: string
    page_number: number
    global_slide_index: number
    text_encrypted: string
    density_score: null
    is_red_zone: boolean
    is_likely_zone: boolean
  }[] = []

  let globalIdx = 0

  for (const source of sources) {
    for (let pageNum = 1; pageNum <= source.pdf.numPages; pageNum++) {
      globalIdx++
      const page = await source.pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      const text = (textContent.items as { str?: string }[])
        .map((item) => item.str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      rows.push({
        id: crypto.randomUUID(),
        session_id: sessionId,
        file_id: source.fileId,
        page_number: pageNum,
        global_slide_index: globalIdx,
        // Encrypt even empty pages so the row count leaks nothing about content.
        text_encrypted: await encryptText(masterKey, text || ' '),
        density_score: null,
        is_red_zone: false,
        is_likely_zone: false,
      })

      page.cleanup()
    }
  }

  const { error } = await supabase.from('slides').insert(rows)
  if (error) throw new Error(error.message)

  const totalSlides = sources.reduce((n, s) => n + s.pdf.numPages, 0)
  console.log(
    `[extractor] Extracted and encrypted text from ${totalSlides} slide(s) across ${sources.length} source(s)`,
  )
}
