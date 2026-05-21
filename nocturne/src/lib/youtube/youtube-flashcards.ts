// Converts caption keyword matches into Flashcard objects.
// Reuses the Flashcard type from flashcard-generator.ts (Step 9).

import type { Flashcard } from '@/lib/scoring/flashcard-generator'
import type { CaptionMatch } from './captions'

/**
 * Generates one Flashcard per caption match.
 * Back field is the caption sentence with "[YouTube caption]" attribution.
 */
export function generateFlashcardsFromCaptions(matches: CaptionMatch[]): Flashcard[] {
  return matches.map(({ keyword, sentence }) => ({
    id: crypto.randomUUID(),
    keywordTerm: keyword.term,
    front: keyword.term.charAt(0).toUpperCase() + keyword.term.slice(1),
    back: sentence + ' [YouTube caption]',
    slideIndex: null,
    zone: 'red' as const,
  }))
}
