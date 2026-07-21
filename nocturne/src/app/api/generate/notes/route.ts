// PRIVACY CONTRACT: decrypted slide/transcript text is used only to build the prompt
// and is discarded when this request finishes. Nothing is persisted server-side.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const TRANSCRIPT_WORD_LIMIT = 2500

interface SlideInput { pageNumber: number; text: string }
interface KeywordInput { term: string; zone: 'red' | 'likely' }

interface RequestBody {
  sessionId: string
  slides: SlideInput[]
  transcriptText: string
  keywords: KeywordInput[]
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

  const { sessionId, slides, transcriptText, keywords } = body

  const { data: sessionRow } = await supabase
    .from('sessions').select('id').eq('id', sessionId).eq('user_id', user.id).maybeSingle()
  if (!sessionRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const redTerms = keywords.filter((k) => k.zone === 'red').map((k) => k.term)
  const likelyTerms = keywords.filter((k) => k.zone === 'likely').map((k) => k.term)

  const slideBlocks = slides
    .filter((s) => s.text.trim())
    .map((s) => `[Slide ${s.pageNumber}]\n${s.text.trim()}`)
    .join('\n\n')

  // Truncate transcript to stay within token budget
  const truncatedTranscript = transcriptText.split(/\s+/).slice(0, TRANSCRIPT_WORD_LIMIT).join(' ')

  const parts: string[] = [
    'Generate structured study notes in markdown. Use ## headers per topic, bullet points for key ideas, and **bold** for important terms.',
    'Prioritize the high-emphasis terms — the professor spent the most time on these.',
    '',
  ]
  if (redTerms.length > 0) parts.push(`**High-emphasis (most likely on exam):** ${redTerms.join(', ')}`)
  if (likelyTerms.length > 0) parts.push(`**Moderate-emphasis:** ${likelyTerms.join(', ')}`)
  if (slideBlocks) { parts.push('', 'SLIDE CONTENT:', slideBlocks) }
  if (truncatedTranscript) { parts.push('', 'LECTURE TRANSCRIPT (excerpt):', truncatedTranscript) }

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
        'You are generating structured study notes from a university lecture. ' +
        'Write clear, student-friendly markdown organized by topic. ' +
        'Only use the provided lecture context. Do not add information not in the materials.',
      messages: [{ role: 'user', content: parts.join('\n') }],
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    console.error('[generate/notes] Anthropic error:', resp.status, errText)
    return NextResponse.json({ error: 'LLM request failed' }, { status: 502 })
  }

  const data = await resp.json() as { content: { type: string; text: string }[] }
  const notes = data.content?.find((b) => b.type === 'text')?.text ?? ''

  return NextResponse.json({ notes })
}
