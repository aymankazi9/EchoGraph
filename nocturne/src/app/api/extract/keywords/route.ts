// PRIVACY CONTRACT: decrypted guide/transcript/slide text is used only to build
// the prompt and is discarded when this request finishes. Nothing is persisted server-side.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { callAnthropic } from '@/lib/anthropic/call'
import type { SupabaseClient } from '@supabase/supabase-js'

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
  kind: 'definition' | 'equation' | 'process' | 'structure' | 'principle'
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(
  guideText: string | null,
  slideBlock: string,
  transcriptBlock: string,
): string {
  const sourceRule = guideText
    ? [
        '3. Tag each term with source — choose exactly one:',
        '   "guide"    — present in the study guide only',
        '   "inferred" — identified from lecture content (slides/transcript) independently',
        '   "both"     — present in the study guide AND independently emphasized in the lecture',
      ].join('\n')
    : '3. Tag every term with source: "inferred" (the only valid value when no study guide is supplied).'

  const parts = [
    'You are an experienced TA preparing a study list for a college-level exam.',
    'Your job is to identify the specific terms a student must know — not to summarise the lecture.',
    '',
    'Extract every term the material warrants.',
    'A short or thin lecture produces a short list; a dense lecture may produce many.',
    'Do not pad to reach a number and do not cap to stay under one.',
    '',
    'Prioritise (in order):',
    '  • Named laws, theorems, principles, and equations (e.g. "bayes\' theorem", "ohm\'s law", "mens rea")',
    '  • Field-specific technical vocabulary that would appear in a textbook glossary',
    '  • Named processes, mechanisms, pathways, and structures (e.g. "krebs cycle", "big-o notation")',
    '  • Multi-word technical phrases where the combination carries specific meaning',
    '',
    '(The example terms above illustrate the type and specificity to look for across any subject.',
    'Do not extract them unless they explicitly appear in the supplied material below.)',
    '',
    'Skip — do not extract:',
    '  • Announcements, logistics, and administrative text ("exam next week", "office hours", "submit on Canvas")',
    '  • Slide titles, section headers, and running headers',
    '  • Generic standalone nouns with no technical meaning in isolation:',
    '    "system", "process", "factor", "structure", "function", "level", "type", "concept",',
    '    "approach", "method", "result", "data", "example", "question", "value", "model", "case"',
    '  • Example-specific numbers, dates, or incidental proper nouns — extract the named concept, not the example',
    '    (e.g. "In 1905, Einstein derived..." → extract "special relativity" not "1905" or "Einstein")',
    '  • Terms the professor explicitly marks as not testable',
    '',
    'Rules:',
    '1. Prefer the most complete, specific form: "ideal gas law" not "gas law", "opportunity cost" not "cost".',
    '2. Merge synonyms and abbreviations into one canonical term using the more complete or widely recognised form.',
    '   Examples: "Na⁺/K⁺ ATPase" and "sodium-potassium pump" → "sodium-potassium ATPase"',
    '             "mRNA" alone is too generic — keep it only if the lecture treats it as a standalone concept.',
    sourceRule,
    '4. Tag each term with kind — choose exactly one:',
    '   "definition"  — a named thing with a precise meaning (e.g. "opportunity cost", "mens rea", "due process")',
    '   "equation"    — a named equation, law, or formula (e.g. "bayes\' theorem", "hooke\'s law", "ohm\'s law")',
    '   "process"     — a named sequence of steps or mechanism (e.g. "krebs cycle", "meiosis", "binary search")',
    '   "structure"   — a named physical or conceptual structure (e.g. "mitochondria", "separation of powers")',
    '   "principle"   — a named rule or governing idea that is not itself an equation (e.g. "parsimony", "law of demand")',
    '5. Use lowercase for all terms.',
    '6. Only return terms explicitly present in the supplied slides or transcript.',
    '   Do not invent or infer terms the material does not mention.',
    '7. If the slides and transcript contain no extractable content, return exactly { "keywords": [] }.',
    '',
    'Return exactly this JSON and nothing else:',
    '{ "keywords": [{ "term": "...", "source": "guide"|"inferred"|"both", "kind": "definition"|"equation"|"process"|"structure"|"principle" }] }',
  ]

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

async function callClaude(
  prompt: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { userId: string; sessionId: string; supabase: SupabaseClient<any> },
): Promise<ExtractedKeyword[]> {
  const data = await callAnthropic({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    temperature: 0,
    system:
      'You are a precise study-term extractor for university lectures. ' +
      'Return only valid JSON — no markdown fences, no explanation.',
    messages: [{ role: 'user', content: prompt }],
    route: 'extract/keywords',
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    supabase: ctx.supabase,
  })

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
      // Upgrade source if a later chunk has stronger evidence; preserve kind
      seen.set(key, { ...kw, kind: kw.kind ?? existing.kind })
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

  if (!slides?.length && !transcriptText?.trim() && !guideText?.trim()) {
    return NextResponse.json(
      { error: 'No extractable content — slides, transcript, and guide are all empty' },
      { status: 400 },
    )
  }

  const totalWords =
    (transcriptText?.split(/\s+/).length ?? 0) +
    slides.reduce((s, sl) => s + sl.text.split(/\s+/).length, 0) +
    (guideText?.split(/\s+/).length ?? 0)

  const ctx = { userId: user.id, sessionId, supabase }
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
      allKeywords = await callClaude(prompt, ctx)
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
        const chunkKws = await callClaude(prompt, ctx)
        allKeywords.push(...chunkKws)
      } catch (e) {
        console.error(`[extract/keywords] chunk ${i} error:`, e)
        // Continue with other chunks rather than failing entirely
      }
    }

    // Final dedup merge across chunks when there is meaningful overlap
    if (allKeywords.length > 120) {
      try {
        const mergePrompt = [
          'The following keyword lists come from different chunks of the same lecture.',
          'Merge them into a single deduplicated list.',
          'Prefer more specific or complete phrases when merging near-duplicates.',
          'Preserve the kind field from the most specific matching entry.',
          'Return exactly: { "keywords": [{ "term": "...", "source": "guide"|"inferred"|"both", "kind": "definition"|"equation"|"process"|"structure"|"principle" }] }',
          '',
          JSON.stringify(allKeywords),
        ].join('\n')
        allKeywords = await callClaude(mergePrompt, ctx)
      } catch {
        // Fall back to local string dedup
      }
    }
  }

  return NextResponse.json({ keywords: dedup(allKeywords) })
}
