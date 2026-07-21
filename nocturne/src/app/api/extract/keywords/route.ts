// PRIVACY CONTRACT: decrypted guide/transcript/slide text is used only to build
// the prompt and is discarded when this request finishes. Nothing is persisted server-side.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Chunk if total word count exceeds this — only triggers for ~3h+ lectures
const CHUNK_WORD_THRESHOLD = 100_000
const SLIDES_PER_CHUNK = 12

interface SlideInput { pageNumber: number; text: string }

interface RequestBody {
  sessionId: string
  guideText: string | null
  transcriptText: string
  slides: SlideInput[]
}

export interface ExtractedKeyword {
  term: string
  source: 'guide' | 'inferred' | 'both'
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(
  guideText: string | null,
  slideBlock: string,
  transcriptBlock: string,
): string {
  const parts: string[] = [
    'Extract 60–80 key study terms and concepts from the lecture materials below.',
    '',
    'Rules:',
    '1. Preserve multi-word technical phrases (e.g. "action potential", "sodium-potassium pump").',
    '2. Tag each term with exactly one of these source values:',
    guideText
      ? '   - "guide": explicitly listed as a key term/concept in the study guide'
      : '',
    guideText
      ? '   - "inferred": identified as important from lecture content (slides/transcript) independently — not from the guide'
      : '   - "inferred": identified as important from lecture content (slides/transcript)',
    guideText
      ? '   - "both": present in the study guide AND independently emphasized in the lecture'
      : '',
    '3. Consolidate near-duplicates into the more complete/specific form.',
    '4. Omit single-letter abbreviations, generic filler phrases, and slide headers.',
    '5. Use lowercase for all terms.',
    '',
    'Return exactly this JSON and nothing else:',
    '{ "keywords": [{ "term": "...", "source": "guide" | "inferred" | "both" }] }',
  ].filter((l) => l !== null) as string[]

  if (guideText) {
    parts.push('', '--- STUDY GUIDE ---', guideText.slice(0, 8000))
  }
  if (slideBlock) {
    parts.push('', '--- SLIDES ---', slideBlock)
  }
  if (transcriptBlock) {
    parts.push('', '--- LECTURE TRANSCRIPT ---', transcriptBlock)
  }

  return parts.join('\n')
}

// ── Single Claude call ─────────────────────────────────────────────────────────

async function callClaude(prompt: string): Promise<ExtractedKeyword[]> {
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
        'You are a precise study-term extractor for university lectures. ' +
        'Return only valid JSON — no markdown fences, no explanation.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`)

  const data = await resp.json() as { content: { type: string; text: string }[] }
  const raw = data.content?.find((b) => b.type === 'text')?.text ?? ''
  const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
  return (parsed.keywords ?? []) as ExtractedKeyword[]
}

// ── Dedup extracted terms (string-level; Claude handles semantic dedup in prompt) ──

function dedup(keywords: ExtractedKeyword[]): ExtractedKeyword[] {
  const seen = new Map<string, ExtractedKeyword>()
  for (const kw of keywords) {
    const key = kw.term.toLowerCase().trim()
    if (!key) continue
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, kw)
    } else if (kw.source === 'both' || (kw.source === 'guide' && existing.source === 'inferred')) {
      // Upgrade source if a later chunk has stronger evidence
      seen.set(key, kw)
    }
  }
  return [...seen.values()]
}

// ── Route handler ──────────────────────────────────────────────────────────────

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

  const { sessionId, guideText, transcriptText, slides } = body

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const { data: sessionRow } = await supabase
    .from('sessions').select('id').eq('id', sessionId).eq('user_id', user.id).maybeSingle()
  if (!sessionRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const totalWords =
    (transcriptText?.split(/\s+/).length ?? 0) +
    slides.reduce((s, sl) => s + sl.text.split(/\s+/).length, 0) +
    (guideText?.split(/\s+/).length ?? 0)

  let allKeywords: ExtractedKeyword[] = []

  if (totalWords <= CHUNK_WORD_THRESHOLD) {
    // ── Single pass (covers virtually all real sessions) ──────────────────────
    const slideBlock = slides
      .filter((s) => s.text.trim())
      .map((s) => `[Slide ${s.pageNumber}] ${s.text.trim()}`)
      .join('\n\n')

    // Cap transcript at ~60k words to stay well inside token budget
    const transcriptCapped = transcriptText.split(/\s+/).slice(0, 60_000).join(' ')

    const prompt = buildPrompt(guideText, slideBlock, transcriptCapped)
    try {
      allKeywords = await callClaude(prompt)
    } catch (e) {
      console.error('[extract/keywords] Claude error:', e)
      return NextResponse.json({ error: 'Extraction failed' }, { status: 502 })
    }
  } else {
    // ── Chunked pass for very long sessions ───────────────────────────────────
    const transcriptWords = transcriptText.split(/\s+/)
    const wordsPerChunk = Math.ceil(transcriptWords.length / Math.ceil(slides.length / SLIDES_PER_CHUNK))

    for (let i = 0; i < slides.length; i += SLIDES_PER_CHUNK) {
      const chunkSlides = slides.slice(i, i + SLIDES_PER_CHUNK)
      const slideBlock = chunkSlides
        .filter((s) => s.text.trim())
        .map((s) => `[Slide ${s.pageNumber}] ${s.text.trim()}`)
        .join('\n\n')

      const chunkStart = Math.floor((i / slides.length) * transcriptWords.length)
      const transcriptChunk = transcriptWords
        .slice(chunkStart, chunkStart + wordsPerChunk)
        .join(' ')

      const prompt = buildPrompt(guideText, slideBlock, transcriptChunk)
      try {
        const chunkKws = await callClaude(prompt)
        allKeywords.push(...chunkKws)
      } catch (e) {
        console.error(`[extract/keywords] chunk ${i} error:`, e)
        // Continue with other chunks rather than failing entirely
      }
    }

    // Final dedup merge across chunks
    if (allKeywords.length > 80) {
      try {
        const mergePrompt = [
          'Below are keyword lists from different chunks of the same lecture. Merge them into a single deduplicated list of 60–80 terms, preferring more specific/complete phrases. Consolidate semantically equivalent terms.',
          'Return exactly: { "keywords": [{ "term": "...", "source": "guide" | "inferred" | "both" }] }',
          '',
          JSON.stringify(allKeywords),
        ].join('\n')
        allKeywords = await callClaude(mergePrompt)
      } catch {
        // Fall back to local string dedup
      }
    }
  }

  return NextResponse.json({ keywords: dedup(allKeywords) })
}
