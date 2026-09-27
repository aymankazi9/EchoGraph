// PRIVACY CONTRACT: decrypted image/PDF data is used only to build the Claude vision request
// and is discarded when this request finishes. Nothing is persisted server-side.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Allow larger bodies — phone photos encoded as base64 can be 4–8 MB each.
export const maxDuration = 60

interface FileInput {
  index: number
  mimeType: string  // 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'
  base64: string
}

interface RequestBody {
  sessionId: string
  files: FileInput[]
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { sessionId, files } = body
  if (!sessionId || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'sessionId and files[] required' }, { status: 400 })
  }

  // Verify session ownership before processing any image data.
  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!sessionRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const results: { index: number; text: string }[] = []

  for (const file of files) {
    try {
      const isPdf = file.mimeType === 'application/pdf'
      const contentBlock = isPdf
        ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: file.base64 } }
        : { type: 'image' as const, source: { type: 'base64' as const, media_type: file.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: file.base64 } }

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system:
            'You are an OCR engine. Transcribe all handwritten and printed text from the content faithfully. ' +
            'Preserve structure: bullets, numbered lists, headings, underlines. ' +
            'Output plain text only — no commentary or explanations.',
          messages: [
            {
              role: 'user',
              content: [
                contentBlock,
                { type: 'text' as const, text: 'Transcribe all text from this content exactly.' },
              ],
            },
          ],
        }),
      })

      if (!resp.ok) {
        console.error(`[ocr] Claude error for file ${file.index}: ${resp.status}`)
        results.push({ index: file.index, text: '' })
        continue
      }

      const data = await resp.json() as { content: { type: string; text: string }[] }
      const text = data.content?.find((b) => b.type === 'text')?.text ?? ''
      results.push({ index: file.index, text })
    } catch (e) {
      console.error(`[ocr] Error processing file ${file.index}:`, e)
      results.push({ index: file.index, text: '' })
    }
  }

  return NextResponse.json({ results })
}
