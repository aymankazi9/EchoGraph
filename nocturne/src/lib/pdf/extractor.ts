// Browser-only — import only from 'use client' components.

import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptText } from '@/lib/crypto/encrypt'

// Extract text from every page of a PDF, encrypt each page's text, and
// insert one row per page into public.slides. Runs silently after render.
export async function extractSlideText(
  pdf: PDFDocumentProxy,
  sessionId: string,
  masterKey: CryptoKey,
  supabase: SupabaseClient,
): Promise<void> {
  const rows: {
    id: string
    session_id: string
    page_number: number
    text_encrypted: string
    density_score: null
    is_red_zone: boolean
    is_likely_zone: boolean
  }[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    const text = (textContent.items as { str?: string }[])
      .map((item) => item.str ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    rows.push({
      id: crypto.randomUUID(),
      session_id: sessionId,
      page_number: pageNum,
      // Encrypt even empty pages so the row count leaks nothing about content.
      text_encrypted: await encryptText(masterKey, text || ' '),
      density_score: null,
      is_red_zone: false,
      is_likely_zone: false,
    })

    page.cleanup()
  }

  const { error } = await supabase.from('slides').insert(rows)
  if (error) throw new Error(error.message)

  console.log(`[extractor] Extracted and encrypted text from ${pdf.numPages} pages`)
}
