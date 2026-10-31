import { describe, it, expect } from 'vitest'
import { detectClusters } from './detect-clusters'

describe('detectClusters', () => {
  it('splits two dense groups joined by a single weak bridge into separate clusters', () => {
    const nodes = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((id) => ({ id }))
    const edges = [
      { source: 'a1', target: 'a2', weight: 0.9 },
      { source: 'a2', target: 'a3', weight: 0.9 },
      { source: 'a1', target: 'a3', weight: 0.9 },
      { source: 'b1', target: 'b2', weight: 0.9 },
      { source: 'b2', target: 'b3', weight: 0.9 },
      { source: 'b1', target: 'b3', weight: 0.9 },
      { source: 'a3', target: 'b1', weight: 0.05 },
    ]

    const result = detectClusters(nodes, edges)

    expect(result.a1).toBe(result.a2)
    expect(result.a2).toBe(result.a3)
    expect(result.b1).toBe(result.b2)
    expect(result.b2).toBe(result.b3)
    expect(result.a1).not.toBe(result.b1)
  })

  it('puts every node in its own cluster when there are no edges', () => {
    const nodes = ['x', 'y', 'z'].map((id) => ({ id }))
    const result = detectClusters(nodes, [])
    const values = new Set(Object.values(result))
    expect(values.size).toBe(3)
  })

  it('assigns cluster 0 to the largest community', () => {
    const nodes = ['a1', 'a2', 'a3', 'a4', 'b1', 'b2'].map((id) => ({ id }))
    // a1-a4 form a complete graph (every pair connected) so full merge always
    // dominates any partial grouping — unlike a 4-cycle, which has no single
    // best partition under symmetric weights and can legitimately split.
    const edges = [
      { source: 'a1', target: 'a2', weight: 0.9 },
      { source: 'a1', target: 'a3', weight: 0.9 },
      { source: 'a1', target: 'a4', weight: 0.9 },
      { source: 'a2', target: 'a3', weight: 0.9 },
      { source: 'a2', target: 'a4', weight: 0.9 },
      { source: 'a3', target: 'a4', weight: 0.9 },
      { source: 'b1', target: 'b2', weight: 0.9 },
    ]

    const result = detectClusters(nodes, edges)
    expect(result.a1).toBe(0)
    expect(result.a2).toBe(0)
    expect(result.a3).toBe(0)
    expect(result.a4).toBe(0)
  })

  it('returns an empty object for an empty node list', () => {
    expect(detectClusters([], [])).toEqual({})
  })
})
