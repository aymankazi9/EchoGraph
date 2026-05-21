// Generates flashcards from scored keywords.
// Front = keyword term. Back = best transcript sentence + slide reference.

import type { ScoredKeyword } from './keyword-scorer'
import type { TranscriptWordEntry } from '@/store/session-store'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Flashcard {
  id: string
  keywordTerm: string
  front: string
  back: string
  slideIndex: number | null
  zone: 'red' | 'likely'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Groups transcript words into sentences by end-of-sentence punctuation
 * or gaps > 800 ms between words.
 */
function buildSentences(words: TranscriptWordEntry[]): TranscriptWordEntry[][] {
  if (words.length === 0) return []
  const sentences: TranscriptWordEntry[][] = [[words[0]]]

  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1]
    const curr = words[i]
    const gapMs = curr.startMs - prev.endMs
    const endsWithPunct = /[.!?]$/.test(prev.word)
    if (gapMs > 800 || endsWithPunct) sentences.push([])
    sentences[sentences.length - 1].push(curr)
  }

  return sentences
}

/**
 * Finds the best sentence (longest match) containing the keyword.
 * Returns the sentence text and the slide index from the first word.
 */
function findBestSentence(
  keyword: string,
  sentences: TranscriptWordEntry[][],
): { text: string; slideIndex: number | null } | null {
  const kw = keyword.toLowerCase()
  let best: { text: string; slideIndex: number | null } | null = null
  let bestLen = 0

  for (const sentence of sentences) {
    const text = sentence.map((w) => w.word).join(' ')
    if (!text.toLowerCase().includes(kw)) continue
    if (text.length > bestLen) {
      bestLen = text.length
      best = { text, slideIndex: sentence[0]?.slideIndex ?? null }
    }
  }

  return best
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates one flashcard per keyword using the best matching transcript sentence.
 * Keywords with no transcript mention get a slide-only back if slides are available.
 */
export function generateFlashcards(
  keywords: ScoredKeyword[],
  words: TranscriptWordEntry[],
): Flashcard[] {
  const sentences = buildSentences(words)
  const cards: Flashcard[] = []

  for (const kw of keywords) {
    const match = findBestSentence(kw.term, sentences)

    let back: string
    let slideIndex: number | null = null

    if (match) {
      const slideRef = match.slideIndex != null ? ` [Slide ${match.slideIndex}]` : ''
      back = match.text + slideRef
      slideIndex = match.slideIndex
    } else if (kw.slideIndices.length > 0) {
      back = `Covered on slide${kw.slideIndices.length > 1 ? 's' : ''} ${kw.slideIndices.join(', ')}.`
      slideIndex = kw.slideIndices[0] ?? null
    } else {
      back = `Term from study guide: ${kw.source}.`
    }

    cards.push({
      id: crypto.randomUUID(),
      keywordTerm: kw.term,
      front: kw.term.charAt(0).toUpperCase() + kw.term.slice(1),
      back,
      slideIndex,
      zone: kw.zone,
    })
  }

  return cards
}
