// Browser-only — import only from 'use client' components.

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAndDecryptFile } from '@/lib/crypto/decrypt'
import { encryptText } from '@/lib/crypto/encrypt'

// ─── Mime type detection from magic bytes ─────────────────────────────────────

function detectMimeType(bytes: Uint8Array): string {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg'
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png'
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  // PDF: %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf'
  // Default — Claude supports JPEG
  return 'image/jpeg'
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  // Process in 32 KB chunks to avoid call stack overflow on large images
  const CHUNK = 32768
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface HandwrittenSource {
  fileId: string
  storagePath: string
  orderIndex: number
}

/**
 * Downloads, decrypts, and OCRs each handwritten file via /api/ocr, then stores
 * the encrypted OCR text in handwritten_pages. Skips files that already have rows.
 *
 * PRIVACY CONTRACT: decrypted image bytes exist only in memory for the duration
 * of the OCR request. They are never persisted; only the encrypted OCR text is stored.
 */
export async function extractHandwrittenText(
  sources: HandwrittenSource[],
  sessionId: string,
  masterKey: CryptoKey,
  supabase: SupabaseClient,
): Promise<void> {
  if (sources.length === 0) return

  // Skip files that already have OCR rows
  const { data: existing } = await supabase
    .from('handwritten_pages')
    .select('file_id')
    .eq('session_id', sessionId)

  const doneFileIds = new Set((existing ?? []).map((r) => r.file_id as string))
  const pending = sources.filter((s) => !doneFileIds.has(s.fileId))
  if (pending.length === 0) return

  // Decrypt all pending files in parallel
  const filesForOcr: { index: number; mimeType: string; base64: string; source: HandwrittenSource }[] = []

  await Promise.all(
    pending.map(async (src, i) => {
      try {
        const plainBuf = await fetchAndDecryptFile(supabase, src.storagePath, masterKey)
        const bytes = new Uint8Array(plainBuf)
        const mimeType = detectMimeType(bytes)
        const base64 = bufToBase64(plainBuf)
        filesForOcr.push({ index: i, mimeType, base64, source: src })
      } catch (e) {
        console.error(`[handwritten] Failed to decrypt ${src.fileId}:`, e)
      }
    }),
  )

  if (filesForOcr.length === 0) return

  // Sort by index to preserve order
  filesForOcr.sort((a, b) => a.index - b.index)

  // Send to OCR route — decrypted bytes are in transit only, never stored
  const resp = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      files: filesForOcr.map(({ index, mimeType, base64 }) => ({ index, mimeType, base64 })),
    }),
  })

  if (!resp.ok) {
    console.error('[handwritten] OCR route error:', resp.status)
    return
  }

  const { results } = await resp.json() as { results: { index: number; text: string }[] }

  // Encrypt each OCR result and insert into handwritten_pages
  const rows = await Promise.all(
    results
      .filter((r) => r.text.trim())
      .map(async (r) => {
        const src = filesForOcr[r.index]?.source
        if (!src) return null
        return {
          id: crypto.randomUUID(),
          session_id: sessionId,
          file_id: src.fileId,
          order_index: src.orderIndex,
          text_encrypted: await encryptText(masterKey, r.text),
        }
      }),
  )

  const validRows = rows.filter((r): r is NonNullable<typeof r> => r !== null)
  if (validRows.length > 0) {
    const { error } = await supabase.from('handwritten_pages').insert(validRows)
    if (error) console.error('[handwritten] Insert error:', error.message)
    else console.log(`[handwritten] OCR'd and stored ${validRows.length} file(s)`)
  }
}
