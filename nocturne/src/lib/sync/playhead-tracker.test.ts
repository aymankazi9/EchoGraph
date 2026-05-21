import { describe, it, expect } from 'vitest'
import { getActiveSlideIndex, getActiveWordId } from './playhead-tracker'
import type { SyncSegment, TrackedWord } from './playhead-tracker'

const syncMap: SyncSegment[] = [
  { startMs: 0,     endMs: 30000,  slideIndex: 1 },
  { startMs: 30000, endMs: 60000,  slideIndex: 2 },
  { startMs: 60000, endMs: 90000,  slideIndex: 3 },
]

const words: TrackedWord[] = [
  { id: 'a', startMs: 1000,  endMs: 1400  },
  { id: 'b', startMs: 2000,  endMs: 2500  },
  { id: 'c', startMs: 31000, endMs: 31600 },
]

describe('getActiveSlideIndex', () => {
  it('returns 0 when syncMap is empty', () => {
    expect(getActiveSlideIndex(5000, [])).toBe(0)
  })

  it('returns 0 before first segment startMs', () => {
    // First segment starts at 0, so anything before it returns 0 (no match yet)
    const map: SyncSegment[] = [{ startMs: 5000, endMs: 10000, slideIndex: 1 }]
    expect(getActiveSlideIndex(0, map)).toBe(0)
  })

  it('returns slideIndex exactly at startMs', () => {
    expect(getActiveSlideIndex(0, syncMap)).toBe(1)
    expect(getActiveSlideIndex(30000, syncMap)).toBe(2)
    expect(getActiveSlideIndex(60000, syncMap)).toBe(3)
  })

  it('returns slideIndex between two entries', () => {
    expect(getActiveSlideIndex(15000, syncMap)).toBe(1)
    expect(getActiveSlideIndex(45000, syncMap)).toBe(2)
  })

  it('returns last slideIndex after final entry', () => {
    expect(getActiveSlideIndex(100000, syncMap)).toBe(3)
  })
})

describe('getActiveWordId', () => {
  it('returns null when words array is empty', () => {
    expect(getActiveWordId(1000, [])).toBeNull()
  })

  it('returns word id exactly at startMs', () => {
    expect(getActiveWordId(1000, words)).toBe('a')
  })

  it('returns word id exactly at endMs', () => {
    expect(getActiveWordId(1400, words)).toBe('a')
  })

  it('returns null in a gap between words', () => {
    expect(getActiveWordId(1600, words)).toBeNull()
  })

  it('returns null before all words', () => {
    expect(getActiveWordId(0, words)).toBeNull()
  })

  it('returns null after all words', () => {
    expect(getActiveWordId(99000, words)).toBeNull()
  })

  it('matches the correct word across multiple words', () => {
    expect(getActiveWordId(31200, words)).toBe('c')
  })
})
