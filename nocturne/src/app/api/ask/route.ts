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

// ── Token-budget constants for course mode ────────────────────────────────────
// Per-session retrieval is intentionally smaller than single-session mode so
// the merged context stays within a reasonable prompt size even with many lectures.
const COURSE_MAX_SESSIONS    = 8   // cap sessions processed regardless of course size
const COURSE_CHUNKS_PER_SESSION = 4  // transcript chunks scored per session before merge
const COURSE_SLIDES_PER_SESSION = 3  // slides scored per session before merge
const COURSE_TOTAL_CHUNKS    = 14  // global cap on transcript chunks after merge
const COURSE_TOTAL_SLIDES    = 8   // global cap on slides after merge

interface SlideEntry { pageNumber: number; text: string }

/** One session's worth of pre-decrypted content sent in a course-mode request. */
interface CourseSessionPayload {
  sessionId: string
  transcriptText: string
  slides: SlideEntry[]
}

interface AskRequestBody {
  question: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  // Session mode (original)
  sessionId?: string
  transcriptText?: string
  slides?: SlideEntry[]
  // Course mode (new)
  courseId?: string
  sessions?: CourseSessionPayload[]
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

// ── Single-session retrieval (used for session mode + course mode per-session) ─

/**
 * Returns the top-K scored transcript chunks without restoring document order.
 * Scores are preserved so callers can merge across sessions.
 */
function getScoredChunks(
  text: string,
  question: string,
  topK: number,
): { chunk: string; score: number }[] {
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

/**
 * Returns the top-K scored slides without restoring page order.
 * Pinned slides (directly referenced by number in the question) get Infinity score.
 */
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

// ── Single-session retrieval (session mode — preserves document order) ─────────

function getRelevantChunks(text: string, question: string, topK = 5): string[] {
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
  slides: SlideEntry[],
  question: string,
  topK = 3,
): SlideEntry[] {
  if (slides.length === 0) return []

  // ── Step 1: pin explicitly referenced slide numbers ───────────────────────
  const pinnedNumbers = new Set(
    [...question.matchAll(/\bslide\s+(\d+)\b/gi)].map((m) => parseInt(m[1]!, 10)),
  )
  const pinned   = slides.filter((s) =>  pinnedNumbers.has(s.pageNumber))
  const unpinned = slides.filter((s) => !pinnedNumbers.has(s.pageNumber))

  // ── Step 2: TF-IDF score the remaining slides ─────────────────────────────
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

// ── Course-mode context builder ───────────────────────────────────────────────

function buildCourseContext(sessions: CourseSessionPayload[], question: string): string {
  const capped = sessions.slice(0, COURSE_MAX_SESSIONS)

  // 1. Collect scored chunks + slides per session, tagged with lecture index.
  const allChunks: { chunk: string; score: number; lectureIdx: number }[] = []
  const allSlides: { pageNumber: number; text: string; score: number; lectureIdx: number }[] = []

  capped.forEach((session, i) => {
    const lectureIdx = i + 1

    getScoredChunks(session.transcriptText, question, COURSE_CHUNKS_PER_SESSION)
      .forEach((c) => allChunks.push({ ...c, lectureIdx }))

    getScoredSlides(session.slides, question, COURSE_SLIDES_PER_SESSION)
      .forEach((s) => allSlides.push({ ...s, lectureIdx }))
  })

  // 2. Global merge: sort by score, apply token-budget caps.
  const topChunks = allChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, COURSE_TOTAL_CHUNKS)
    .sort((a, b) => a.lectureIdx - b.lectureIdx) // restore lecture order for readability

  const topSlides = allSlides
    .sort((a, b) => b.score - a.score)
    .slice(0, COURSE_TOTAL_SLIDES)
    .sort((a, b) => a.lectureIdx !== b.lectureIdx
      ? a.lectureIdx - b.lectureIdx
      : a.pageNumber - b.pageNumber,
    )

  // 3. Build context string.
  const parts: string[] = []

  if (topChunks.length > 0) {
    const chunkText = topChunks
      .map((c) => `[Lecture ${c.lectureIdx}] ${c.chunk}`)
      .join('\n\n')
    parts.push(`TRANSCRIPT EXCERPTS:\n${chunkText}`)
  }

  if (topSlides.length > 0) {
    const slideText = topSlides
      .map((s) => `[Lecture ${s.lectureIdx}, Slide ${s.pageNumber}] ${s.text}`)
      .join('\n\n')
    parts.push(`SLIDE CONTENT:\n${slideText}`)
  }

  return parts.join('\n\n---\n\n')
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

  const { question, history } = body

  if (!question?.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Ask is not configured — ANTHROPIC_API_KEY is missing.' },
      { status: 503 },
    )
  }

  // ── Build conversation history ───────────────────────────────────────────────
  // Prior turns are decrypted and sent from the client — plaintext is
  // request-scoped only and never persisted here.  Budget: last 10 messages.
  const historyMessages = (history ?? [])
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }))

  // ── Determine mode: course vs session ────────────────────────────────────────
  const isCourseMode = !!(body.courseId && body.sessions?.length)

  if (isCourseMode) {
    // ── COURSE MODE ────────────────────────────────────────────────────────────

    const { courseId, sessions } = body as Required<Pick<AskRequestBody, 'courseId' | 'sessions'>>

    // Verify the course belongs to the authenticated user.
    const { data: courseRow } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!courseRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify all submitted session IDs belong to this user and this course.
    const submittedIds = sessions.map((s) => s.sessionId)
    const { data: ownedRows } = await supabase
      .from('sessions')
      .select('id')
      .in('id', submittedIds)
      .eq('course_id', courseId)
      .eq('user_id', user.id)

    if ((ownedRows?.length ?? 0) !== submittedIds.length) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build merged RAG context across all sessions.
    const context = buildCourseContext(sessions, question)

    const systemPrompt =
      'You are a study assistant for a university course. You have access to content from multiple lectures. ' +
      'Answer questions using ONLY the provided context — do not use outside knowledge. ' +
      'When referencing transcript content, indicate its source as [Lecture N]. ' +
      'When referencing slide content, cite it as [Lecture N, Slide M]. ' +
      'Be concise and precise. If the context does not contain enough information to answer, say so.'

    const userContent = context
      ? `Context:\n${context}\n\nQuestion: ${question}`
      : `Question: ${question}`

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
      console.error('[ask/course] Anthropic error:', llmResponse.status, errText)
      return NextResponse.json({ error: 'LLM request failed' }, { status: 502 })
    }

    const llmData = await llmResponse.json() as { content: AnthropicMessage[] }
    const answer = llmData.content?.find((b) => b.type === 'text')?.text ?? ''

    // Course-mode answers embed [Lecture N, Slide M] citations inline in the text.
    // We don't extract them as navigable indices — sessions aren't all open simultaneously.
    return NextResponse.json({ answer, citedSlideIndices: [] })
  }

  // ── SESSION MODE (original behavior) ─────────────────────────────────────────

  const { sessionId, transcriptText, slides } = body

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required in session mode' }, { status: 400 })
  }

  // Verify the session belongs to the authenticated user.
  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!sessionRow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // RAG: retrieve relevant context
  const chunks = getRelevantChunks(transcriptText ?? '', question)
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

  return NextResponse.json({ answer, citedSlideIndices })
}
