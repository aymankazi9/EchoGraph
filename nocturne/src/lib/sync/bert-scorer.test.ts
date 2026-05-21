import { describe, it, expect } from 'vitest'
import { cosineSimilarity } from './bert-scorer'

describe('cosineSimilarity', () => {
  it('identical vectors → 1.0', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0)
  })

  it('orthogonal vectors → 0.0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0)
  })

  it('zero vector → 0.0 (no division by zero)', () => {
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0.0)
  })

  it('anti-parallel vectors → -1.0', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0)
  })

  it('partial overlap → value in (0, 1)', () => {
    const score = cosineSimilarity([1, 1], [1, 0])
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })
})
