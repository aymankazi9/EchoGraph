// Vault-level RAG endpoint.
// PRIVACY CONTRACT: decrypted session titles, transcript text, and slide text arrive
// in the request body, are used to build a prompt, and are discarded when the request
// finishes. Nothing is persisted in plaintext.
//
// Two-stage retrieval architecture:
//   Stage 1 (client-side): lightweight scoring using decrypted titles, course names,
//            and keyword terms — selects the top ~5 most relevant sessions.
//   Stage 2 (server-side): full TF-IDF scoring of transcript chunks and slides across
//            those sessions, merged globally by score, fed to the LLM.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { hasAccess, type Tier } from '@/lib/tiers/features'

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ── Token-budget constants ────────────────────────────────────────────────────
const VAULT_CHUNKS_PER_SESSION = 5
const VAULT_SLIDES_PER_SESSION = 3
const VAULT_TOTAL_CHUNKS = 18
const VAULT_TOTAL_SLIDES = 10

// ── Types ─────────────────────────────────────────────────────────────────────

interface SlideEntry { pageNumber: number; text: string }

/** One session's pre-decrypted content sent from the client after Stage 1. */
interface VaultSessionPayload {
  sessionId:    string
  /** Decrypted session title — request-scoped, not persisted. */
  sessionTitle: string
  transcriptText: string
  slides: SlideEntry[]
}

interface VaultAskBody {
  question: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  /** Top-K sessions selected by client-side Stage 1 scoring. */
  sessions: VaultSessionPayload[]
}

interface AnthropicMessage { type: string; text: string }

// ── Retrieval helpers (Stage 2) ───────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter((w) => w.length > 2 || /^\d+$/.test(w))
}

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

/** Top-K transcript chunks scored by TF-IDF, scores preserved for global merge. */
function getScoredChunks(
  text: string,
  question: string,
  topK: number,
): { chunk: string; score: number }[] {
  if (!text.trim()) return []
  const words = text.split(/\s+/)
  const chunkSize = 150
  const step = chunkSize - 30

  const chunks: string[] = []
  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim()) chunks.push(chunk)
  }

  const queryTerms = [...new Set(tokenize(question))]
  if (queryTerms.length === 0) return chunks.slice(0, topK).map((chunk) => ({ chunk, score: 0 }))

  const chunkTokens    = chunks.map((c) => tokenize(c))
  const chunkTokenSets = chunkTokens.map((t) => new Set(t))
  const idf            = buildIdf(queryTerms, chunkTokenSets, chunks.length)

  return chunks
    .map((chunk, idx) => ({
      chunk,
      score: tfidfScore(chunkTokens[idx]!, queryTerms, idf),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/** Top-K slides scored by TF-IDF; slides directly referenced by number get Infinity. */
function getScoredSlides(
  slides: SlideEntry[],
  question: string,
  topK: number,
): { pageNumber: number; text: string; score: number }[] {
  if (slides.length === 0) return []

  const pinnedNumbers = new Set(
    [...question.matchAll(/\bslide\s+(\d+)\b/gi)].map((m) => parseInt(m[1]!, 10)),
  )
  const pinned   = slides.filter((s) =>  pinnedNumbers.has(s.pageNumber))
  const unpinned = slides.filter((s) => !pinnedNumbers.has(s.pageNumber))

  const queryTerms   = [...new Set(tokenize(question))]
  const allTokenSets = slides.map((s) => new Set(tokenize(s.text)))
  const idf          = buildIdf(queryTerms, allTokenSets, slides.length)

  const scored = unpinned
    .map((s) => ({ ...s, score: tfidfScore(tokenize(s.text), queryTerms, idf) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return [...pinned.map((s) => ({ ...s, score: Infinity })), ...scored]
}

// ── Stage 2: build merged context across selected sessions ────────────────────

function buildVaultContext(sessions: VaultSessionPayload[], question: string): string {
  const allChunks: { chunk: string; score: number; title: string }[] = []
  const allSlides: { pageNumber: number; text: string; score: number; title: string }[] = []

  for (const session of sessions) {
    // Truncate title for citation labels — keep it short but unambiguous.
    const label = session.sessionTitle.trim() || `Session ${session.sessionId.slice(0, 6)}`

    getScoredChunks(session.transcriptText, question, VAULT_CHUNKS_PER_SESSION)
      .forEach((c) => allChunks.push({ ...c, title: label }))

    getScoredSlides(session.slides, question, VAULT_SLIDES_PER_SESSION)
      .forEach((s) => allSlides.push({ ...s, title: label }))
  }

  // Global merge: rank by score, apply budget caps, then group by session for readability.
  const topChunks = allChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, VAULT_TOTAL_CHUNKS)
    .sort((a, b) => a.title.localeCompare(b.title))

  const topSlides = allSlides
    .sort((a, b) => b.score - a.score)
    .slice(0, VAULT_TOTAL_SLIDES)
    .sort((a, b) => {
      const c = a.title.localeCompare(b.title)
      return c !== 0 ? c : a.pageNumber - b.pageNumber
    })

  const parts: string[] = []

  if (topChunks.length > 0) {
    parts.push(
      `TRANSCRIPT EXCERPTS:\n${topChunks.map((c) => `[${c.title}] ${c.chunk}`).join('\n\n')}`,
    )
  }

  if (topSlides.length > 0) {
    parts.push(
      `SLIDE CONTENT:\n${topSlides
        .map((s) => `[${s.title}, Slide ${s.pageNumber}] ${s.text}`)
        .join('\n\n')}`,
    )
  }

  return parts.join('\n\n---\n\n')
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Tier gate: Eclipse only ────────────────────────────────────────────────
  const { data: subRow } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', user.id)
    .maybeSingle()
  const userTier = (subRow?.tier ?? 'dusk') as Tier
  if (!hasAccess(userTier, 'eclipse')) {
    return NextResponse.json(
      { error: 'Vault Ask requires the Eclipse plan', code: 'tier_required' },
      { status: 403 },
    )
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: VaultAskBody
  try {
    body = await request.json() as VaultAskBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { question, history, sessions } = body

  if (!question?.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }
  if (!sessions?.length) {
    return NextResponse.json({ error: 'sessions is required' }, { status: 400 })
  }
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Ask is not configured — ANTHROPIC_API_KEY is missing.' },
      { status: 503 },
    )
  }

  // ── Ownership verification ─────────────────────────────────────────────────
  // Reject any session IDs that don't belong to the authenticated user.
  const submittedIds = sessions.map((s) => s.sessionId)
  const { data: ownedRows } = await supabase
    .from('sessions')
    .select('id')
    .in('id', submittedIds)
    .eq('user_id', user.id)

  if ((ownedRows?.length ?? 0) !== submittedIds.length) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Conversation history ───────────────────────────────────────────────────
  // Budget: last 10 messages (≈5 turns). Decrypted content sent from client —
  // plaintext is request-scoped only, never persisted here.
  const historyMessages = (history ?? [])
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }))

  // ── Stage 2 retrieval ──────────────────────────────────────────────────────
  const context = buildVaultContext(sessions, question)

  // ── System prompt ──────────────────────────────────────────────────────────
  const systemPrompt =
    'You are a study assistant with access to content from multiple lectures across the user\'s vault. ' +
    'Answer questions using ONLY the provided context — do not use outside knowledge. ' +
    'When referencing transcript content, cite the source session as [Session Title] — ' +
    'e.g. [Glycolysis Lecture]. ' +
    'When referencing slide content, cite it as [Session Title, Slide N] — ' +
    'e.g. [Glycolysis Lecture, Slide 12], so the user knows which lecture and slide a claim comes from. ' +
    'Be concise and precise. If the context does not contain enough information to answer, say so.'

  const userContent = context
    ? `Context:\n${context}\n\nQuestion: ${question}`
    : `Question: ${question}`

  // ── LLM call ──────────────────────────────────────────────────────────────
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
    console.error('[vault-ask] Anthropic error:', llmResponse.status, errText)
    return NextResponse.json({ error: 'LLM request failed' }, { status: 502 })
  }

  const llmData = await llmResponse.json() as { content: AnthropicMessage[] }
  const answer  = llmData.content?.find((b) => b.type === 'text')?.text ?? ''

  return NextResponse.json({ answer })
}
