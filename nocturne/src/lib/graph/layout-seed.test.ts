import { describe, it, expect } from 'vitest'
import { seedPositions, isDegenerateLayout, type SeededPosition } from './layout-seed'

function bboxHeight(positions: Record<string, SeededPosition>): number {
  const ys = Object.values(positions).map((p) => p.y)
  return Math.max(...ys) - Math.min(...ys)
}

describe('seedPositions', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  const clusterByTerm = { a: 0, b: 0, c: 0, d: 1, e: 1, f: 1 }

  it('is deterministic for the same seedKey', () => {
    const p1 = seedPositions(ids, clusterByTerm, 'session-1:abc')
    const p2 = seedPositions(ids, clusterByTerm, 'session-1:abc')
    expect(p1).toEqual(p2)
  })

  it('produces a different layout for a different seedKey', () => {
    const p1 = seedPositions(ids, clusterByTerm, 'session-1:abc')
    const p2 = seedPositions(ids, clusterByTerm, 'session-2:xyz')
    expect(p1).not.toEqual(p2)
  })

  it('never places two nodes at the exact same coordinates', () => {
    const positions = seedPositions(ids, clusterByTerm, 'session-1:abc')
    const coords = Object.values(positions).map((p) => `${p.x},${p.y}`)
    expect(new Set(coords).size).toBe(coords.length)
  })

  it('separates clusters so same-cluster nodes sit closer together than different-cluster nodes', () => {
    const positions = seedPositions(ids, clusterByTerm, 'session-1:abc')
    const dist = (a: string, b: string) => Math.hypot(positions[a].x - positions[b].x, positions[a].y - positions[b].y)
    const withinClusterA = dist('a', 'b')
    const acrossClusters = dist('a', 'd')
    expect(acrossClusters).toBeGreaterThan(withinClusterA)
  })

  it('handles a single node without dividing by zero', () => {
    const positions = seedPositions(['solo'], { solo: 0 }, 'k')
    expect(Number.isFinite(positions.solo.x)).toBe(true)
    expect(Number.isFinite(positions.solo.y)).toBe(true)
  })

  // Regression: evenly-spacing cluster centers around a circle puts exactly
  // 2 clusters at angles 0°/180° — both sin=0 — which collapsed the whole
  // graph onto a single horizontal line whenever clusters were also
  // singletons (angle 0 within their own ring too). Caught via a real
  // browser repro, not by the other tests above, which all use 2+ members
  // per cluster.
  it('never collapses to a flat line with exactly 2 singleton clusters', () => {
    const positions = seedPositions(['x', 'y'], { x: 0, y: 1 }, 'debug:small')
    expect(isDegenerateLayout(positions)).toBe(false)
    expect(Math.abs(bboxHeight(positions))).toBeGreaterThan(1)
  })

  it('never collapses to a flat line across a sweep of cluster/member-count shapes', () => {
    for (let clusterCount = 1; clusterCount <= 6; clusterCount++) {
      for (let perCluster = 1; perCluster <= 4; perCluster++) {
        const nodeIds: string[] = []
        const clusterByTerm: Record<string, number> = {}
        for (let c = 0; c < clusterCount; c++) {
          for (let i = 0; i < perCluster; i++) {
            const id = `c${c}n${i}`
            nodeIds.push(id)
            clusterByTerm[id] = c
          }
        }
        if (nodeIds.length < 2) continue
        const positions = seedPositions(nodeIds, clusterByTerm, `sweep:${clusterCount}:${perCluster}`)
        expect(isDegenerateLayout(positions)).toBe(false)
      }
    }
  })
})

describe('isDegenerateLayout', () => {
  it('flags every node collapsed onto the same point', () => {
    const positions = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, c: { x: 0, y: 0 } }
    expect(isDegenerateLayout(positions)).toBe(true)
  })

  it('flags a tiny bounding box even without exact overlaps', () => {
    const positions = { a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, c: { x: 0, y: 1 }, d: { x: 1, y: 1 } }
    expect(isDegenerateLayout(positions)).toBe(true)
  })

  it('does not flag a well-spread layout', () => {
    const positions = { a: { x: 0, y: 0 }, b: { x: 150, y: 0 }, c: { x: 0, y: 150 }, d: { x: 150, y: 150 }, e: { x: 75, y: 75 } }
    expect(isDegenerateLayout(positions)).toBe(false)
  })

  it('does not flag a single node or empty input', () => {
    expect(isDegenerateLayout({})).toBe(false)
    expect(isDegenerateLayout({ a: { x: 0, y: 0 } })).toBe(false)
  })
})
