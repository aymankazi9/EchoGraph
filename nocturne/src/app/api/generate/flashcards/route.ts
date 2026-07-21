// PRIVACY CONTRACT: decrypted term/context text is used only to build the prompt
// and is discarded when this request finishes. Nothing is persisted server-side.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

interface KeywordContext {
  term: string
  zone: 'red' | 'likely'
  transcriptContext: string
  slideContext: string
}

interface RequestBody {
  sessionId: string
  keywords: KeywordContext[]
}

const BATCH_SIZE = 25

function buildPromptBlock(kw: KeywordContext, index: number): string {
  const lines = [
    `TERM ${index + 1}: ${kw.term}`,
    `PRIORITY: ${kw.zone === 'red' ? 'high — professor emphasized this' : 'moderate'}`,
  ]
  if (kw.transcriptContext) lines.push(`LECTURE: ${kw.transcriptContext}`)
  if (kw.slideContext) lines.push(`SLIDE: ${kw.slideContext}`)
  return lines.join('\n')
}

async function callClaude(keywords: KeywordContext[]): Promise<{ term: string; back: string }[]> {
  const termList = keywords.map((kw, i) => buildPromptBlock(kw, i)).join('\n\n')

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system:
        'You generate flashcard back sides for university lecture terms. Each back must be 1–3 sentences, ' +
        'use only the provided lecture context (not outside knowledge), and explain what the student needs to know. ' +
        'Return valid JSON only — no markdown fences, no explanation.',
      messages: [
        {
          role: 'user',
          content:
            `Generate flashcard backs. Return exactly: { "results": [{ "term": "...", "back": "..." }] }\n\n` +
            termList,
        },
      ],
    }),
  })

  if (!resp.ok) throw new Error(`Anthropic ${resp.status}`)

  const data = await resp.json() as { content: { type: string; text: string }[] }
  const raw = data.content?.find((b) => b.type === 'text')?.text ?? ''

  const parsed = JSON.parse(raw.replace(/^```json\n?/, '').replace(/\n?```$/, ''))
  return (parsed.results ?? []) as { term: string; back: string }[]
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

  const { sessionId, keywords } = body
  if (!sessionId || !Array.isArray(keywords) || keywords.length === 0) {
    return NextResponse.json({ error: 'sessionId and keywords required' }, { status: 400 })
  }

  const { data: sessionRow } = await supabase
    .from('sessions').select('id').eq('id', sessionId).eq('user_id', user.id).maybeSingle()
  if (!sessionRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Batch into groups to stay within token limits
  const results: { term: string; back: string }[] = []
  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    const batch = keywords.slice(i, i + BATCH_SIZE)
    try {
      const batchResults = await callClaude(batch)
      results.push(...batchResults)
    } catch (e) {
      console.error('[generate/flashcards] batch error:', e)
      // Return whatever we have so far — client falls back to original backs
    }
  }

  return NextResponse.json({ results })
}
