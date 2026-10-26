// PRIVACY CONTRACT: decrypted term/context text is used only to build the prompt
// and is discarded when this request finishes. Nothing is persisted server-side.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { hasAccess, type Tier } from '@/lib/tiers/features'
import { callAnthropic } from '@/lib/anthropic/call'
import type { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

interface CardEnhanceContext {
  id: string
  term: string
  zone: 'red' | 'likely'
  kind?: string
  transcriptContext: string
  slideContext: string
}

interface RequestBody {
  sessionId: string
  cards: CardEnhanceContext[]
}

// The client (flashcard-enhancer.ts) owns batching and concurrency.
// Each request carries ≤BATCH_SIZE cards; one Claude call per request.

function buildCardBlock(card: CardEnhanceContext): string {
  const lines = [
    `CARD_ID: ${card.id}`,
    `TERM: ${card.term}`,
    `KIND: ${card.kind ?? 'definition'}`,
    `PRIORITY: ${card.zone === 'red' ? 'high — professor emphasized this' : 'moderate'}`,
  ]
  if (card.transcriptContext) lines.push(`LECTURE: ${card.transcriptContext}`)
  if (card.slideContext) lines.push(`SLIDE: ${card.slideContext}`)
  return lines.join('\n')
}

async function callClaude(
  cards: CardEnhanceContext[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { userId: string; sessionId: string; supabase: SupabaseClient<any> },
): Promise<{ id: string; back: string }[]> {
  const cardList = cards.map((c) => buildCardBlock(c)).join('\n\n')

  const data = await callAnthropic({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    temperature: 0,
    system: [
      'You write flashcard back sides for university exam terms.',
      'Rules:',
      '  • 1–2 sentences, ≤25 words total. Lead directly with the definition/answer — do not restate the term.',
      '  • Use only the supplied lecture context. Do not add outside knowledge.',
      '  • No markdown, no bullet points, no slide citations, no hedging phrases ("refers to", "in general").',
      '  • If KIND is "equation": include the one-line formula using $...$ inline LaTeX, then one phrase of meaning.',
      '    Example for ohm\'s law: $V = IR$, where voltage equals current times resistance.',
      '  • If KIND is "process": name the key steps or end-result in ≤25 words.',
      '  • If KIND is "structure": name the location/composition and primary function in ≤25 words.',
      '  • If KIND is "principle": state the rule and what it predicts or prohibits in ≤25 words.',
      '  • Return valid JSON only — no markdown fences, no explanation.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content:
          'Generate flashcard backs. Return exactly:\n' +
          '{ "results": [{ "id": "...", "back": "..." }] }\n\n' +
          'Each "id" must match the CARD_ID supplied for that term.\n\n' +
          cardList,
      },
    ],
    route: 'generate/flashcards',
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    supabase: ctx.supabase,
  })

  const raw = data.content?.find((b) => b.type === 'text')?.text ?? ''
  const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
  return (parsed.results ?? []) as { id: string; back: string }[]
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: subRow } = await supabase.from('subscriptions').select('tier').eq('user_id', user.id).maybeSingle()
  const userTier = (subRow?.tier ?? 'dusk') as Tier
  if (!hasAccess(userTier, 'midnight')) {
    return NextResponse.json({ error: 'Requires Midnight plan', code: 'tier_required' }, { status: 403 })
  }

  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { sessionId, cards } = body
  if (!sessionId || !Array.isArray(cards) || cards.length === 0) {
    return NextResponse.json({ error: 'sessionId and cards required' }, { status: 400 })
  }

  const { data: sessionRow } = await supabase
    .from('sessions').select('id').eq('id', sessionId).eq('user_id', user.id).maybeSingle()
  if (!sessionRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ctx = { userId: user.id, sessionId, supabase }

  // One Claude call per request — the client owns batching and concurrency.
  let results: { id: string; back: string }[] = []
  try {
    results = await callClaude(cards, ctx)
  } catch (e) {
    console.error('[generate/flashcards] callClaude error:', e)
    // Client falls back to original backs on empty results
  }

  return NextResponse.json({ results })
}
