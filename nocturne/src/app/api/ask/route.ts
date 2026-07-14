// RAG endpoint for the Ask tab.
// PRIVACY CONTRACT: no plaintext content is persisted here.
// Decrypted transcript/slide text arrives in the request body, is used to build
// a prompt, and is discarded when the request finishes. The encrypted response
// is stored client-side after this handler returns.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

interface AskRequestBody {
  question: string
  transcriptText: string
  slides: { pageNumber: number; text: string }[]
  sessionId: string
}

interface AnthropicMessage {
  type: string
  text: string
}

// ── Retrieval helpers ─────────────────────────────────────────────────────────

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

  const qWords = new Set(
    question.toLowerCase().split(/\W+/).filter((w) => w.length > 3),
  )

  return chunks
    .map((chunk, idx) => {
      const score = chunk.toLowerCase().split(/\W+/).filter((w) => qWords.has(w)).length
      return { chunk, score, idx }
    })
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

  const qWords = new Set(
    question.toLowerCase().split(/\W+/).filter((w) => w.length > 3),
  )

  return slides
    .map((s) => {
      const score = s.text.toLowerCase().split(/\W+/).filter((w) => qWords.has(w)).length
      return { ...s, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .sort((a, b) => a.pageNumber - b.pageNumber)
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

  // ── Parse + validate body ───────────────────────────────────────────────────
  let body: AskRequestBody
  try {
    body = await request.json() as AskRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { question, transcriptText, slides, sessionId } = body

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
      messages: [{ role: 'user', content: userContent }],
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
