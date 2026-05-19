// Pure functions — no side effects, no imports. Unit testable in isolation.
// Called by session-store whenever currentTimeMs changes.

export interface SyncSegment {
  startMs: number
  endMs: number
  slideIndex: number  // page_number (1-based)
}

export interface TrackedWord {
  id: string
  startMs: number
  endMs: number
}

/**
 * Returns the slideIndex active at currentTimeMs.
 * Walks the (ascending) syncMap and returns the last entry whose startMs <= currentTimeMs.
 * Returns 0 when no syncMap is loaded or currentTimeMs is before the first entry.
 */
export function getActiveSlideIndex(
  currentTimeMs: number,
  syncMap: SyncSegment[],
): number {
  if (syncMap.length === 0) return 0
  let result = 0
  for (const seg of syncMap) {
    if (seg.startMs <= currentTimeMs) result = seg.slideIndex
    else break
  }
  return result
}

/**
 * Returns the ID of the word whose window [startMs, endMs] contains currentTimeMs, or null.
 * Words must be sorted ascending by startMs for early-exit to work.
 */
export function getActiveWordId(
  currentTimeMs: number,
  words: TrackedWord[],
): string | null {
  for (const w of words) {
    if (w.startMs > currentTimeMs) break  // past the playhead — no match ahead
    if (currentTimeMs <= w.endMs) return w.id
  }
  return null
}
