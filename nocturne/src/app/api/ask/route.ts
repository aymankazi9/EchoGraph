// RAG endpoint for the Ask tab.
// PRIVACY CONTRACT: no plaintext content is persisted here.
// Decrypted transcript/slide text arrives in the request body, is used to build
// a prompt, and is discarded when the request finishes. The encrypted response
// is stored client-side after this handler returns.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { hasAccess, type Tier } from '@/lib/tiers/features'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

interface AskRequestBody {
  question: string
  transcriptText: string
  slides: { pageNumber: number; text: string }[]
  sessionId: string
  /** Prior conversation turns, oldest first, already decrypted client-side. */
  history?: { role: 'user' | 'assistant'; content: string }[]
}

interface AnthropicMessage {
  type: string
  text: string
}

// ── Retrieval helpers ─────────────────────────────────────────────────────────

// Tokenize text into scoreable terms.
//
// length > 2  — keeps 3-letter technical terms (DNA, ATP, …) that the old
//               length > 3 threshold dropped.
// number exemption — pure-digit tokens ("11", "5") survive regardless of length
//               so slide numbers and numeric figures in questions are matchable.
// TF-IDF then handles the common 3-letter tokens (the, and, not, …) that the
// looser threshold admits — they appear in nearly every chunk and receive a
// very low IDF weight, effectively neutralising them without a hard filter.
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter((w) => w.length > 2 || /^\d+$/.test(w))
}

// Smooth TF-IDF (sklearn-style):
//   idf(t) = ln((N+1) / (df+1)) + 1   always ≥ 1; ubiquitous terms approach 1
//   score(doc, query) = Σ tf(t, doc) · idf(t)
function buildIdf(
  queryTerms: string[],
  docTokenSets: Set<string>[],
  N: number,
): Map<string, number> {
  const idf = new Map<string, number>()
  for (const term of queryTerms) {
    const df = docTokenSets.reduce((n, s) => n + (s.has(term) ? 1 : 0), 0)
    idf.set(term, Math.log((N + 1) / (df + 1)) + 1)
  }
  return idf
}

function tfidfScore(
  docTokens: string[],
  queryTerms: string[],
  idf: Map<string, number>,
): number {
  const tf = new Map<string, number>()
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1)
  return queryTerms.reduce((acc, term) => acc + (tf.get(term) ?? 0) * (idf.get(term) ?? 0), 0)
}

function getRelevantChunks(text: string, question: string, topK = 5): string[] {
  if (!text.trim()) return []
  const words = text.split(/\s+/)
  const chunkSize = 150
  const step = chunkSize - 30 // 30-word overlap

  const chunks: string[] = []
  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim()) chunks.push(chunk)
  }

  const queryTerms = [...new Set(tokenize(question))]
  if (queryTerms.length === 0) return chunks.slice(0, topK)

  const chunkTokens    = chunks.map((c) => tokenize(c))
  const chunkTokenSets = chunkTokens.map((t) => new Set(t))
  const idf            = buildIdf(queryTerms, chunkTokenSets, chunks.length)

  return chunks
    .map((chunk, idx) => ({
      chunk,
      score: tfidfScore(chunkTokens[idx]!, queryTerms, idf),
      idx,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .sort((a, b) => a.idx - b.idx)
    .map((c) => c.chunk)
}

function getRelevantSlides(
  slides: { pageNumber: number; text: string }[],
  question: string,
  topK = 3,
): { pageNumber: number; text: string }[] {
  if (slides.length === 0) return []

  // ── Step 1: pin explicitly referenced slide numbers ───────────────────────
  // Extract every "slide N" or "slide 11" reference from the question before
  // scoring so direct references are guaranteed to be in context regardless of
  // keyword overlap.  Multiple references in one question are all pinned.
  // The number "11" would be dropped by the length-4 filter below, so this
  // must happen before qWords is built.
  const pinnedNumbers = new Set(
    [...question.matchAll(/\bslide\s+(\d+)\b/gi)].map((m) => parseInt(m[1]!, 10)),
  )
  const pinned   = slides.filter((s) =>  pinnedNumbers.has(s.pageNumber))
  const unpinned = slides.filter((s) => !pinnedNumbers.has(s.pageNumber))

  // ── Step 2: TF-IDF score the remaining slides ─────────────────────────────
  // IDF is computed across ALL slides (pinned + unpinned) so corpus statistics
  // are accurate regardless of which slides the pin step selected.  Pinned
  // slides do not consume scored slots — topK additional slides are still
  // selected from the unpinned pool for broader context.
  const queryTerms   = [...new Set(tokenize(question))]
  const allTokenSets = slides.map((s) => new Set(tokenize(s.text)))
  const idf          = buildIdf(queryTerms, allTokenSets, slides.length)

  const scored = unpinned
    .map((s) => ({ ...s, score: tfidfScore(tokenize(s.text), queryTerms, idf) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .sort((a, b) => a.pageNumber - b.pageNumber)

  // ── Step 3: merge, restore document order ─────────────────────────────────
  return [...pinned, ...scored].sort((a, b) => a.pageNumber - b.pageNumber)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {}, // read-only in route handler
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: subRow } = await supabase.from('subscriptions').select('tier').eq('user_id', user.id).maybeSingle()
  const userTier = (subRow?.tier ?? 'dusk') as Tier
  if (!hasAccess(userTier, 'eclipse')) {
    return NextResponse.json({ error: 'Requires Eclipse plan', code: 'tier_required' }, { status: 403 })
  }

  // ── Parse + validate body ───────────────────────────────────────────────────
  let body: AskRequestBody
  try {
    body = await request.json() as AskRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { question, transcriptText, slides, sessionId, history } = body

  if (!question?.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }

  // Verify the session belongs to the authenticated user
  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!sessionRow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Check LLM is configured ─────────────────────────────────────────────────
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Ask is not configured — ANTHROPIC_API_KEY is missing.' },
      { status: 503 },
    )
  }

  // ── RAG: retrieve relevant context ──────────────────────────────────────────
  const chunks = getRelevantChunks(transcriptText, question)
  const relevantSlides = getRelevantSlides(slides ?? [], question)

  const contextParts: string[] = []
  if (chunks.length > 0) {
    contextParts.push(`TRANSCRIPT EXCERPTS:\n${chunks.join('\n\n')}`)
  }
  if (relevantSlides.length > 0) {
    const slideContext = relevantSlides
      .map((s) => `[Slide ${s.pageNumber}] ${s.text}`)
      .join('\n\n')
    contextParts.push(`SLIDE CONTENT:\n${slideContext}`)
  }

  const context = contextParts.join('\n\n---\n\n')

  const systemPrompt =
    'You are a study assistant for a university lecture. Answer questions using ONLY the provided context — do not use outside knowledge. ' +
    'When referencing slide content, cite the slide as [Slide N]. ' +
    'Be concise and precise. If the context does not contain enough information to answer, say so.'

  const userContent = context
    ? `Context:\n${context}\n\nQuestion: ${question}`
    : `Question: ${question}`

  // ── Build conversation history ───────────────────────────────────────────────
  // Prior turns are decrypted and sent from the client — plaintext is
  // request-scoped only and never persisted here.  We budget to the last 10
  // messages (≈5 turns) to keep prompt size bounded; the client sends no more
  // than that, so this is a belt-and-suspenders guard.
  //
  // RAG context is injected into the CURRENT user turn only.  Re-injecting it
  // into every history turn would balloon the prompt and confuse the model about
  // which context is authoritative for the new question.
  const historyMessages = (history ?? [])
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }))

  // ── Call Anthropic Messages API ─────────────────────────────────────────────
  const llmResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [...historyMessages, { role: 'user', content: userContent }],
    }),
  })

  if (!llmResponse.ok) {
    const errText = await llmResponse.text()
    console.error('[ask] Anthropic error:', llmResponse.status, errText)
    return NextResponse.json({ error: 'LLM request failed' }, { status: 502 })
  }

  const llmData = await llmResponse.json() as { content: AnthropicMessage[] }
  const answer = llmData.content?.find((b) => b.type === 'text')?.text ?? ''

  // Extract cited slide numbers from [Slide N] references in the answer
  const citedSlideIndices = [...answer.matchAll(/\[Slide (\d+)\]/g)]
    .map((m) => parseInt(m[1]!, 10))
    .filter((n, i, arr) => !isNaN(n) && arr.indexOf(n) === i)

  // plaintext answer leaves this handler — it is never written to the DB here.
  // The client re-encrypts it before storing in ask_messages.
  return NextResponse.json({ answer, citedSlideIndices })
}
