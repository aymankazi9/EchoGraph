export type Rating = 'again' | 'hard' | 'good' | 'easy'

export interface SrsResult {
  easeFactor: number
  intervalDays: number
  dueAt: Date
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
