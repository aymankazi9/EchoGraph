// PRIVACY CONTRACT: decrypted note/slide/transcript text is used only to build the
// prompt and is discarded when this request finishes. Nothing is persisted server-side.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { hasAccess, type Tier } from '@/lib/tiers/features'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const TRANSCRIPT_WORD_LIMIT = 3000

interface SlideInput { pageNumber: number; text: string }

interface RequestBody {
  sessionId:      string
  noteMarkdown:   string
  transcriptText: string
  slides:         SlideInput[]
}

export interface FlaggedItem {
  /** Verbatim short quote from the student notes (15–50 words) containing the claim. */
  excerpt:         string
  /** One sentence describing the specific discrepancy. */
  explanation:     string
  /** What the lecture actually says, or null if the claim is simply unsupported. */
  lectureEvidence: string | null
}

export async function POST(request: NextRequest) {
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

  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { sessionId, noteMarkdown, transcriptText, slides } = body

  // Verify the session belongs to this user.
  const { data: sessionRow } = await supabase
    .from('sessions').select('id').eq('id', sessionId).eq('user_id', user.id).maybeSingle()
  if (!sessionRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!noteMarkdown.trim()) return NextResponse.json({ flags: [] })

  const slideBlocks = slides
    .filter((s) => s.text.trim())
    .map((s) => `[Slide ${s.pageNumber}]\n${s.text.trim()}`)
    .join('\n\n')

  const truncatedTranscript = transcriptText.split(/\s+/).slice(0, TRANSCRIPT_WORD_LIMIT).join(' ')

  const lectureContext = [
    slideBlocks      && `SLIDE CONTENT:\n${slideBlocks}`,
    truncatedTranscript && `LECTURE TRANSCRIPT:\n${truncatedTranscript}`,
  ].filter(Boolean).join('\n\n')

  const userMessage = `STUDENT NOTES:\n${noteMarkdown}\n\n---\n\n${lectureContext}`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':          ANTHROPIC_API_KEY,
      'anthropic-version':  '2023-06-01',
      'content-type':       'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are fact-checking student notes against the actual lecture content (slides and transcript).

Identify claims in the notes that are:
- Factually inconsistent with or contradicted by the lecture
- Stated with more certainty than the lecture supports
- Plausible-sounding but not found anywhere in the provided lecture content

Do NOT flag:
- Reasonable inferences or valid summaries that capture the correct spirit
- Minor phrasing differences from the original wording
- Personal examples, mnemonics, or study tips the student added
- Formatting, grammar, or writing style

Respond with a JSON array only. Each element:
- "excerpt": verbatim short quote from the STUDENT NOTES (15–50 words) containing the problematic claim — must be copy-pasteable exactly from the notes as written
- "explanation": one sentence describing the specific discrepancy
- "lectureEvidence": what the lecture actually says instead, or null if the claim is simply unsupported

If no issues are found, return [].
Return only the JSON array, no other text or markdown fences.`,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    console.error('[fact-check] Anthropic error:', resp.status, errText)
    return NextResponse.json({ error: 'LLM request failed' }, { status: 502 })
  }

  const data = await resp.json() as { content: { type: string; text: string }[] }
  const raw  = data.content?.find((b) => b.type === 'text')?.text ?? '[]'

  let flags: FlaggedItem[]
  try {
    // Defensively strip any markdown code fences Claude might include.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    flags = JSON.parse(cleaned) as FlaggedItem[]
    if (!Array.isArray(flags)) flags = []
  } catch {
    flags = []
  }

  return NextResponse.json({ flags })
}
