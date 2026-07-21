// Enhances flashcard backs using Claude after the initial keyword-sentence extraction.
// Runs as a non-blocking background call after scoring completes.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScoredKeyword } from './keyword-scorer'
import type { Flashcard } from './flashcard-generator'
import type { TranscriptWordEntry } from '@/store/session-store'
import { encryptText } from '@/lib/crypto/encrypt'

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
}): Promise<void> {
  const { sessionId, scored, cards, slides, words, mk, supabase, loadFlashcards } = params

  if (cards.length === 0) return

  const keywords = scored.map((kw) => ({
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

  // Update flashcard objects with enhanced backs where available
  const enhanced: Flashcard[] = cards.map((card) => {
    const generated = backMap.get(card.keywordTerm.toLowerCase())
    return generated ? { ...card, back: generated } : card
  })

  // Update store so study tab reflects the improved cards
  loadFlashcards(enhanced)

  // Re-encrypt and upsert enhanced backs to DB
  await Promise.all(
    enhanced.map(async (card) => {
      const orig = cards.find((c) => c.id === card.id)
      if (!orig || orig.back === card.back) return // unchanged, skip
      const back_encrypted = await encryptText(mk, card.back)
      await supabase.from('flashcards').update({ back_encrypted }).eq('id', card.id)
    }),
  )
}
