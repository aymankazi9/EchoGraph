// Quiz generation endpoint.
// PRIVACY CONTRACT: pre-decrypted flashcard text arrives in the request body,
// is used only to build the prompt, and is discarded when the request finishes.
// Nothing is persisted server-side.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { hasAccess, type Tier } from '@/lib/tiers/features'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_QUESTIONS  = 20   // hard cap on questions per quiz
const BATCH_SIZE     = 10   // cards per LLM call (keeps prompt + output within token budget)
const MAX_DECK_TERMS = 20   // distractor context terms included in every prompt

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuizCard {
  id: string
  front: string   // already decrypted by client
  back: string    // already decrypted by client
  zone: 'red' | 'likely'
}

interface QuizRequestBody {
  /** For ownership verification. Exactly one must be set. */
  sessionId?: string
  courseId?: string
  /** Pre-decrypted flashcard data (max MAX_QUESTIONS cards). */
  cards: QuizCard[]
}

interface GeneratedQuestion {
  id: string
  question: string
  distractors: string[]
}

// ── LLM call ─────────────────────────────────────────────────────────────────

async function generateBatch(
  batch: QuizCard[],
  deckTerms: string[],
): Promise<GeneratedQuestion[]> {
  // Deck context: other terms the LLM can draw on for plausible distractors.
  const deckContext = deckTerms.slice(0, MAX_DECK_TERMS).join(', ')

  const cardList = batch.map((c) => JSON.stringify({ id: c.id, front: c.front, back: c.back })).join('\n')

  const system =
    'You generate multiple-choice quiz questions for university lecture flashcards. ' +
    'For each card you receive, produce: (1) a clear question rephrasing the front as a proper question ' +
    '("What is X?", "Which of the following describes X?", "How does X work?", etc.) and ' +
    '(2) exactly 3 plausible wrong answers (distractors). ' +
    'Distractors must be topically related — draw on the DECK TERMS provided to make them sound like they ' +
    'could belong to the same subject — but must NOT be correct answers and must NOT be verbatim copies ' +
    'of other cards. Match the style and length of the correct answer. ' +
    'Return ONLY valid JSON, no markdown fences.'

  const userMsg =
    `DECK TERMS (for distractor context): ${deckContext}\n\n` +
    `CARDS:\n${cardList}\n\n` +
    `Return: {"results":[{"id":"...","question":"...","distractors":["...","...","..."]}]}`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3072,
      system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  })

  if (!resp.ok) throw new Error(`Anthropic ${resp.status}`)

  const data = await resp.json() as { content: { type: string; text: string }[] }
  const raw = data.content?.find((b) => b.type === 'text')?.text ?? ''
  const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  const parsed = JSON.parse(cleaned) as { results: GeneratedQuestion[] }
  return parsed.results ?? []
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: subRow } = await supabase
    .from('subscriptions').select('tier').eq('user_id', user.id).maybeSingle()
  const userTier = (subRow?.tier ?? 'dusk') as Tier
  if (!hasAccess(userTier, 'eclipse')) {
    return NextResponse.json({ error: 'Requires Eclipse plan', code: 'tier_required' }, { status: 403 })
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Quiz generation not configured' }, { status: 503 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: QuizRequestBody
  try {
    body = await request.json() as QuizRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { sessionId, courseId, cards } = body

  if (!Array.isArray(cards) || cards.length < 4) {
    return NextResponse.json({ error: 'At least 4 cards required to generate a quiz' }, { status: 400 })
  }

  // ── Ownership verification ─────────────────────────────────────────────────────
  if (sessionId) {
    const { data: row } = await supabase
      .from('sessions').select('id').eq('id', sessionId).eq('user_id', user.id).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } else if (courseId) {
    const { data: row } = await supabase
      .from('courses').select('id').eq('id', courseId).eq('user_id', user.id).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } else {
    return NextResponse.json({ error: 'sessionId or courseId required' }, { status: 400 })
  }

  // ── Cap and batch ─────────────────────────────────────────────────────────────
  const selected = cards.slice(0, MAX_QUESTIONS)

  // Deck terms: all card fronts (including those not being generated as questions)
  // — used as distractor context for every batch.
  const deckTerms = cards.map((c) => c.front)

  const results: GeneratedQuestion[] = []
  for (let i = 0; i < selected.length; i += BATCH_SIZE) {
    const batch = selected.slice(i, i + BATCH_SIZE)
    try {
      const batchResults = await generateBatch(batch, deckTerms.filter(
        (t) => !batch.some((c) => c.front === t),
      ))
      results.push(...batchResults)
    } catch (e) {
      console.error('[generate/quiz] batch error:', i, e)
      // Continue with whatever was generated — client handles partial results gracefully
    }
  }

  return NextResponse.json({ results })
}
