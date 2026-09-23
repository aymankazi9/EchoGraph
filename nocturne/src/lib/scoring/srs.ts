export type Rating = 'again' | 'hard' | 'good' | 'easy'

export interface SrsResult {
  easeFactor: number
  intervalDays: number
  dueAt: Date
}

// ─── Mastery ──────────────────────────────────────────────────────────────────

/** interval_days at which a card is considered fully mastered. */
export const MASTERY_INTERVAL_DAYS = 21

export type MasteryState = 'new' | 'learning' | 'mastered'

export interface MasteryResult {
  /** 0–1 linear progress toward mastery. */
  progress: number
  state: MasteryState
}

/**
 * Derives mastery from the card's current SM-2 interval.
 * Pass undefined (or 0) when the card has no review rows yet → state: 'new'.
 * This is a pure computed value — never stored, always reflects live reviews.
 *
 * State buckets:
 *   new      — no reviews yet           (progress = 0)   gray
 *   learning — 0 < progress < 1         (progress 0–1)   yellow
 *   mastered — interval ≥ 21 days       (progress = 1)   teal
 */
export function computeMastery(intervalDays: number | undefined): MasteryResult {
  if (!intervalDays) return { progress: 0, state: 'new' }
  const progress = Math.min(intervalDays / MASTERY_INTERVAL_DAYS, 1)
  return { progress, state: progress >= 1 ? 'mastered' : 'learning' }
}

export function computeNextReview(
  rating: Rating,
  easeFactor: number,   // default 2.5 for new cards
  intervalDays: number, // default 0 for new cards
): SrsResult {
  let newEF: number
  let newInterval: number

  if (rating === 'again') {
    newEF = Math.max(1.3, easeFactor - 0.2)
    newInterval = 1
  } else if (rating === 'hard') {
    newEF = Math.max(1.3, easeFactor - 0.15)
    newInterval = intervalDays <= 1 ? 1 : Math.max(2, Math.round(intervalDays * 1.2))
  } else if (rating === 'good') {
    newEF = easeFactor
    newInterval = intervalDays <= 0 ? 1 : intervalDays < 6 ? 6 : Math.round(intervalDays * easeFactor)
  } else {
    // easy
    newEF = Math.min(3.0, easeFactor + 0.15)
    newInterval = intervalDays <= 0 ? 4 : Math.round(intervalDays * easeFactor * 1.3)
  }

  const dueAt = new Date()
  dueAt.setDate(dueAt.getDate() + newInterval)
  dueAt.setHours(23, 59, 59, 999)

  return { easeFactor: newEF, intervalDays: newInterval, dueAt }
}
