// Enhances flashcard backs using Claude after the initial keyword-sentence extraction.
// Runs as a non-blocking background call after scoring completes.
//
// Idempotency guarantees:
//   • Cards with enhanced_at IS NOT NULL are skipped — Claude is never called twice.
//   • Cards linked to a manual keyword (user-authored backs) are always skipped.
//   • enhanced_at is written only for cards Claude actually returned a result for;
//     missing terms keep enhanced_at NULL and are retried on the next score.
//   • DB writes always complete regardless of component mount state so a user
//     navigating away mid-enhancement doesn't lose the improvements.
//   • Only loadFlashcards is guarded by isAlive — prevents stale async writes
//     from contaminating the store of a later session (cross-session privacy).
//
// Store freshness on re-score:
//   Previously-enhanced backs are fetched from DB and decrypted so the store
//   reflects them immediately after a re-score, without requiring a page reload.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScoredKeyword } from './keyword-scorer'
import type { Flashcard } from './flashcard-generator'
import type { TranscriptWordEntry } from '@/store/session-store'
import { encryptText } from '@/lib/crypto/encrypt'
import { decryptText } from '@/lib/crypto/decrypt'

interface SlideText { pageNumber: number; text: string }

// Extract up to ~60 words of transcript context around the first mention of `term`.
function getTranscriptContext(term: string, words: TranscriptWordEntry[]): string {
  const kw = term.toLowerCase()
  const idx = words.findIndex((w) => w.word.toLowerCase().includes(kw))
  if (idx === -1) return ''
  const start = Math.max(0, idx - 15)
  const end = Math.min(words.length, idx + 45)
  return words.slice(start, end).map((w) => w.word).join(' ')
}

// Return the text of the first matching slide, truncated to 500 chars.
function getSlideContext(slideIndices: number[], slides: SlideText[]): string {
  for (const idx of slideIndices) {
    const slide = slides.find((s) => s.pageNumber === idx)
    if (slide?.text.trim()) return slide.text.slice(0, 500)
  }
  return ''
}

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
}): Promise<void> {
  const { sessionId, scored, cards, slides, words, mk, supabase, loadFlashcards, isAlive } = params

  if (cards.length === 0) return

  // Single round-trip: fetch current enhanced_at, back_encrypted, and linked keyword
  // source for every card in the batch. This drives three things:
  //   1. skip already-enhanced cards (enhanced_at IS NOT NULL)
  //   2. skip manual cards (keywords.source === 'manual') — defensive; manual cards
  //      are not expected in `cards` since executeRescore excludes them, but guarded
  //      here to prevent future regressions
  //   3. restore already-enhanced backs into the store on a re-score so the user
  //      sees the improved text without needing a page reload
  // Supabase types the joined keywords column as an array even for a to-one FK,
  // so we handle both shapes and cast through unknown to silence the overlap error.
  type CardRow = {
    id: string
    back_encrypted: string
    enhanced_at: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keywords: any // { source: string } | { source: string }[] | null
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
    const isManual = kw?.source === 'manual'
    const isEnhanced = row.enhanced_at !== null
    if (isManual || isEnhanced) skipIds.add(row.id)
    // Stash non-manual enhanced rows so we can decrypt and restore their backs
    if (isEnhanced && !isManual) rowsToDecrypt.push(row)
  }

  // Decrypt already-enhanced backs in parallel — needed to inject them into the
  // store so a re-score doesn't revert visibly-enhanced cards to fallback backs.
  const alreadyEnhancedMap = new Map<string, string>() // id → decrypted back
  await Promise.all(
    rowsToDecrypt.map(async (row) => {
      const decrypted = await decryptText(mk, row.back_encrypted)
      alreadyEnhancedMap.set(row.id, decrypted)
    }),
  )

  const cardsToEnhance = cards.filter((c) => !skipIds.has(c.id))

  if (cardsToEnhance.length === 0) {
    // Nothing new to send to Claude. If some cards were previously enhanced, restore
    // their backs into the store so re-scores don't leave the user seeing fallback backs.
    if (alreadyEnhancedMap.size > 0) {
      const restoredCards = cards.map((c) => {
        const enhancedBack = alreadyEnhancedMap.get(c.id)
        return enhancedBack ? { ...c, back: enhancedBack } : c
      })
      if (isAlive && !isAlive()) return
      loadFlashcards(restoredCards)
    }
    return
  }

  // Build keyword contexts only for the cards being sent to Claude.
  const termSet = new Set(cardsToEnhance.map((c) => c.keywordTerm.toLowerCase()))
  const keywords = scored
    .filter((kw) => termSet.has(kw.term.toLowerCase()))
    .map((kw) => ({
      term: kw.term,
      zone: kw.zone,
      transcriptContext: getTranscriptContext(kw.term, words),
      slideContext: getSlideContext(kw.slideIndices, slides),
    }))

  let results: { term: string; back: string }[] = []
  try {
    const resp = await fetch('/api/generate/flashcards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, keywords }),
    })
    if (!resp.ok) return
    const data = await resp.json() as { results: { term: string; back: string }[] }
    results = data.results ?? []
  } catch {
    return // silently fall back to original backs
  }

  if (results.length === 0) return

  // Build a term → generated back lookup (case-insensitive)
  const backMap = new Map(results.map((r) => [r.term.toLowerCase(), r.back]))

  // Apply enhanced backs to the cards that were sent to Claude
  const enhancedSubset: Flashcard[] = cardsToEnhance.map((card) => {
    const generated = backMap.get(card.keywordTerm.toLowerCase())
    return generated ? { ...card, back: generated } : card
  })

  // ── DB writes ────────────────────────────────────────────────────────────────
  // Executed before the isAlive check so a navigated-away session doesn't lose
  // enhancements. Only loadFlashcards (the store write) is gated on mount state.
  //
  // enhanced_at is written only when Claude returned a result for the card's term.
  // Cards absent from backMap keep enhanced_at NULL → retried on the next score.
  const now = new Date().toISOString()
  await Promise.all(
    enhancedSubset.map(async (card) => {
      if (!backMap.has(card.keywordTerm.toLowerCase())) return

      const orig = cardsToEnhance.find((c) => c.id === card.id)!
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = { enhanced_at: now }
      if (orig.back !== card.back) {
        patch.back_encrypted = await encryptText(mk, card.back)
      }
      const { error } = await supabase.from('flashcards').update(patch).eq('id', card.id)
      if (error) {
        console.error('[enhanceFlashcards] DB update failed for card', card.id, ':', error.message)
      }
    }),
  )

  // ── Store write ──────────────────────────────────────────────────────────────
  // Merge: freshly-enhanced cards, previously-enhanced cards (restored from DB),
  // and unchanged cards — into the full ordered array the store expects.
  const freshlyEnhancedById = new Map(enhancedSubset.map((c) => [c.id, c]))
  const mergedCards = cards.map((c) => {
    const fresh = freshlyEnhancedById.get(c.id)
    if (fresh) return fresh
    const prevBack = alreadyEnhancedMap.get(c.id)
    return prevBack ? { ...c, back: prevBack } : c
  })

  // Skip if the component that owns this session has since unmounted — writing
  // into the store from a stale async call would contaminate the next session.
  if (isAlive && !isAlive()) return
  loadFlashcards(mergedCards)
}
