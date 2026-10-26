// Enhances flashcard backs using Claude after the initial keyword-sentence extraction.
// Runs as a non-blocking background call after scoring completes.
//
// Pipeline:
//   1. Fetch DB state (enhanced_at, keyword source) in one round-trip
//   2. Skip already-enhanced and manual cards; restore their backs into the store
//   3. Sort remaining: Red Zone first, then by confidence descending
//   4. Split into batches of BATCH_SIZE; run MAX_CONCURRENCY batches in parallel
//   5. Each batch: call the route, validate response ids, write DB immediately
//   6. After all batches: merge results and update the store (mount-guarded)
//   7. Log per-run cost summary from llm_usage
//
// Idempotency guarantees:
//   • Cards with enhanced_at IS NOT NULL are skipped — Claude is never called twice.
//   • Cards linked to a manual keyword are always skipped (defensive).
//   • enhanced_at is written only for ids Claude actually returned; missing ids
//     keep enhanced_at NULL and are retried on the next score.
//   • DB writes always complete regardless of component mount state so a user
//     navigating away mid-enhancement doesn't lose the improvements.
//   • Only loadFlashcards is guarded by isAlive — prevents stale async writes
//     from contaminating the store of a later session (cross-session privacy).
//
// Store freshness on re-score:
//   Previously-enhanced backs are fetched from DB and decrypted so the store
//   reflects them immediately after a re-score, without a page reload.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScoredKeyword } from './keyword-scorer'
import type { Flashcard } from './flashcard-generator'
import type { TranscriptWordEntry } from '@/store/session-store'
import { encryptText } from '@/lib/crypto/encrypt'
import { decryptText } from '@/lib/crypto/decrypt'

// ── Tuning constants ───────────────────────────────────────────────────────────
// 10 cards × ~120 tokens/card ≈ 1200 input tokens per batch — well within
// Haiku's rate limits. Raise MAX_CONCURRENCY if p50 latency is acceptable and
// the account has headroom; lower it to 2 if 429s appear in llm_usage.
const BATCH_SIZE = 10
const MAX_CONCURRENCY = 4

// ── Types ──────────────────────────────────────────────────────────────────────

interface SlideText { pageNumber: number; text: string }

// Matches CardEnhanceContext in the route — kept local so the enhancer doesn't
// import from an app-router file.
interface BatchCard {
  id: string
  term: string
  zone: 'red' | 'likely'
  kind?: string
  transcriptContext: string
  slideContext: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Run `tasks` with at most `limit` in-flight at once.
 * Result order matches task order. JS is single-threaded so `next++` is atomic.
 */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

/** Transcript window: up to 15 words before + 45 words after the first mention. */
function getTranscriptContext(term: string, words: TranscriptWordEntry[]): string {
  const kw = term.toLowerCase()
  const idx = words.findIndex((w) => w.word.toLowerCase().includes(kw))
  if (idx === -1) return ''
  const start = Math.max(0, idx - 15)
  const end = Math.min(words.length, idx + 45)
  return words.slice(start, end).map((w) => w.word).join(' ')
}

/** First matching slide text, truncated to 500 chars. */
function getSlideContext(slideIndices: number[], slides: SlideText[]): string {
  for (const idx of slideIndices) {
    const slide = slides.find((s) => s.pageNumber === idx)
    if (slide?.text.trim()) return slide.text.slice(0, 500)
  }
  return ''
}

/** Validate that returned ids are in the expected set and backs are non-empty. */
function validateResults(
  raw: { id: string; back: string }[],
  expectedIds: Set<string>,
): { id: string; back: string }[] {
  return raw.filter(
    (r) =>
      typeof r.id === 'string' &&
      expectedIds.has(r.id) &&
      typeof r.back === 'string' &&
      r.back.trim().length > 0,
  )
}

/**
 * POST one batch to the enhancement route. Retries once on 429 or 5xx.
 * Always resolves — returns [] on failure rather than throwing.
 */
async function fetchBatch(
  batch: BatchCard[],
  sessionId: string,
): Promise<{ id: string; back: string }[]> {
  const expectedIds = new Set(batch.map((c) => c.id))
  const body = JSON.stringify({ sessionId, cards: batch })
  const opts: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  }

  async function parseResponse(resp: Response): Promise<{ id: string; back: string }[]> {
    if (!resp.ok) return []
    const data = await resp.json() as { results?: { id: string; back: string }[] }
    return validateResults(data.results ?? [], expectedIds)
  }

  try {
    const resp = await fetch('/api/generate/flashcards', opts)
    if (resp.ok) return await parseResponse(resp)

    // Retryable: 429 (Anthropic rate limit bubbled up) or 5xx (transient error)
    if (resp.status !== 429 && resp.status < 500) return []

    const retryAfterSec = resp.headers.get('Retry-After')
    const delayMs = retryAfterSec
      ? parseInt(retryAfterSec, 10) * 1000
      : resp.status === 429 ? 2000 : 1000
    await sleep(delayMs)

    return await parseResponse(await fetch('/api/generate/flashcards', opts))
  } catch {
    return [] // Network error — fall back to original backs
  }
}

/**
 * Persist enhanced backs for one batch. Called immediately after the batch resolves,
 * not gated on mount state — navigating away must not lose completed enhancements.
 */
async function writeBatch(
  results: { id: string; back: string }[],
  cardById: Map<string, Flashcard>,
  mk: CryptoKey,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<void> {
  if (results.length === 0) return
  const now = new Date().toISOString()
  await Promise.all(
    results.map(async ({ id, back }) => {
      const orig = cardById.get(id)
      if (!orig) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = { enhanced_at: now }
      if (orig.back !== back) {
        patch.back_encrypted = await encryptText(mk, back)
      }
      const { error } = await supabase.from('flashcards').update(patch).eq('id', id)
      if (error) {
        console.error('[enhanceFlashcards] DB write failed for card', id, ':', error.message)
      }
    }),
  )
}

/**
 * Query llm_usage for calls made during this enhancement run and log a summary.
 * Useful for comparing models or concurrency settings without opening the DB console.
 */
async function reportCost(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  sessionId: string,
  startIso: string,
  batchCount: number,
  cardCount: number,
): Promise<void> {
  const { data } = await supabase
    .from('llm_usage')
    .select('input_tokens, output_tokens, latency_ms, model')
    .eq('session_id', sessionId)
    .eq('route', 'generate/flashcards')
    .gte('created_at', startIso)

  if (!data?.length) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = data as { input_tokens: number; output_tokens: number; latency_ms: number; model: string }[]
  const totalIn  = rows.reduce((s, r) => s + (r.input_tokens  ?? 0), 0)
  const totalOut = rows.reduce((s, r) => s + (r.output_tokens ?? 0), 0)
  const latencies = rows.map((r) => r.latency_ms ?? 0)
  const wallMs = latencies.reduce((s, v) => s + v, 0)
  const maxMs  = Math.max(...latencies)
  const model  = rows[0]?.model ?? 'unknown'

  console.log(
    `[enhancer:cost] model=${model}` +
    ` | cards=${cardCount} batches=${batchCount} api_calls=${rows.length}` +
    ` | tokens in=${totalIn} out=${totalOut}` +
    ` | latency wall=${wallMs}ms max_batch=${maxMs}ms`,
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function enhanceFlashcards(params: {
  sessionId: string
  scored: ScoredKeyword[]
  cards: Flashcard[]
  slides: SlideText[]
  words: TranscriptWordEntry[]
  mk: CryptoKey
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
  loadFlashcards: (cards: Flashcard[]) => void
  /** Returns false once the calling component has unmounted — skip the store write. */
  isAlive?: () => boolean
  /** Called with the total card count just before the first batch fires. */
  onStart?: (total: number) => void
  /** Called with the batch size after each batch resolves (success or failure). */
  onBatchCompleted?: (count: number) => void
  /** Called after all batches complete, before the store update. */
  onEnd?: () => void
}): Promise<void> {
  const { sessionId, scored, cards, slides, words, mk, supabase, loadFlashcards, isAlive,
    onStart, onBatchCompleted, onEnd } = params

  if (cards.length === 0) return

  // ── 1. Fetch DB state ─────────────────────────────────────────────────────
  // Drives: skip already-enhanced / manual cards; restore previously-enhanced backs
  // into the store on re-score without a page reload.
  // Supabase types the joined keywords as an array even for a to-one FK, so we
  // handle both shapes and cast through unknown to silence the overlap error.
  type CardRow = {
    id: string
    back_encrypted: string
    enhanced_at: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keywords: any
  }
  const cardIds = cards.map((c) => c.id)
  const { data: cardRows } = await supabase
    .from('flashcards')
    .select('id, back_encrypted, enhanced_at, keywords!keyword_id(source)')
    .in('id', cardIds)

  const skipIds = new Set<string>()
  const rowsToDecrypt: CardRow[] = []

  for (const row of ((cardRows as unknown as CardRow[]) ?? [])) {
    const kw = Array.isArray(row.keywords) ? row.keywords[0] : row.keywords
    const isManual  = kw?.source === 'manual'
    const isEnhanced = row.enhanced_at !== null
    if (isManual || isEnhanced) skipIds.add(row.id)
    if (isEnhanced && !isManual) rowsToDecrypt.push(row)
  }

  // ── 2. Decrypt previously-enhanced backs ─────────────────────────────────
  const alreadyEnhancedMap = new Map<string, string>() // id → decrypted back
  await Promise.all(
    rowsToDecrypt.map(async (row) => {
      const decrypted = await decryptText(mk, row.back_encrypted)
      alreadyEnhancedMap.set(row.id, decrypted)
    }),
  )

  const cardsToEnhance = cards.filter((c) => !skipIds.has(c.id))

  if (cardsToEnhance.length === 0) {
    // Nothing new to send to Claude — restore any previously-enhanced backs.
    if (alreadyEnhancedMap.size > 0) {
      const restoredCards = cards.map((c) => {
        const back = alreadyEnhancedMap.get(c.id)
        return back ? { ...c, back } : c
      })
      if (isAlive && !isAlive()) return
      loadFlashcards(restoredCards)
    }
    return
  }

  // ── 3. Sort and split: Red Zone first, then confidence descending ─────────
  const kwByTerm = new Map(scored.map((kw) => [kw.term.toLowerCase(), kw]))
  const cardById  = new Map(cardsToEnhance.map((c) => [c.id, c]))

  const sorted = [...cardsToEnhance].sort((a, b) => {
    const aKw = kwByTerm.get(a.keywordTerm.toLowerCase())
    const bKw = kwByTerm.get(b.keywordTerm.toLowerCase())
    const aRed = (aKw?.zone ?? 'likely') === 'red'
    const bRed = (bKw?.zone ?? 'likely') === 'red'
    if (aRed !== bRed) return aRed ? -1 : 1
    return (bKw?.confidenceScore ?? 0) - (aKw?.confidenceScore ?? 0)
  })

  const batches: BatchCard[][] = []
  for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
    batches.push(
      sorted.slice(i, i + BATCH_SIZE).map((card) => {
        const kw = kwByTerm.get(card.keywordTerm.toLowerCase())
        return {
          id: card.id,
          term: card.keywordTerm,
          zone: kw?.zone ?? 'likely',
          kind: kw?.kind,
          transcriptContext: getTranscriptContext(card.keywordTerm, words),
          slideContext: getSlideContext(kw?.slideIndices ?? [], slides),
        }
      }),
    )
  }

  // ── 4. Run batches with bounded concurrency; write DB after each batch ────
  // DB writes happen inside each task regardless of mount state — only the final
  // store update below is guarded by isAlive.
  onStart?.(cardsToEnhance.length)

  const startIso = new Date().toISOString()
  const allResults = new Map<string, string>() // id → enhanced back

  const tasks = batches.map((batch) => async () => {
    const results = await fetchBatch(batch, sessionId)
    await writeBatch(results, cardById, mk, supabase)
    for (const { id, back } of results) allResults.set(id, back)
    onBatchCompleted?.(batch.length)
  })

  await runWithConcurrency(tasks, MAX_CONCURRENCY)
  onEnd?.()

  // ── 5. Store update ───────────────────────────────────────────────────────
  if (allResults.size === 0 && alreadyEnhancedMap.size === 0) return

  const mergedCards = cards.map((c) => {
    const fresh = allResults.get(c.id)
    if (fresh) return { ...c, back: fresh }
    const prev = alreadyEnhancedMap.get(c.id)
    return prev ? { ...c, back: prev } : c
  })

  if (isAlive && !isAlive()) return
  loadFlashcards(mergedCards)

  // ── 6. Cost report ────────────────────────────────────────────────────────
  void reportCost(supabase, sessionId, startIso, batches.length, cardsToEnhance.length)
}
