// Deterministic starting positions and degenerate-result detection for the Map
// tab's Cytoscape layout. Pure and synchronous — no Cytoscape dependency — so
// the actual placement math is unit-testable without a DOM.

export interface SeededPosition {
  x: number
  y: number
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  return h >>> 0
}

// Golden-angle "sunflower" spiral: point i sits at angle i*GOLDEN_ANGLE, radius
// scale*sqrt(i+1). Unlike evenly-spaced-on-a-circle placement — which puts
// cluster centers exactly on the x-axis (angles 0°/180°, both sin=0) whenever
// there happen to be exactly 2 clusters, collapsing the whole graph onto a
// single horizontal line — consecutive golden-angle points are never
// collinear with the origin for any count, so this can't degenerate the way
// a naive circular division can. Used at both the macro (cluster centers) and
// micro (nodes within a cluster) level, which is what makes the fallback
// actually non-degenerate by construction instead of just "usually fine."
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function sunflowerPoint(index: number, radiusScale: number): SeededPosition {
  const angle = index * GOLDEN_ANGLE
  const radius = radiusScale * Math.sqrt(index + 1)
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
}

/**
 * Deterministic, collision-free starting layout: cluster centers and each
 * cluster's own nodes are placed on golden-angle sunflower spirals. Same
 * seedKey + same node/cluster assignment -> identical output every time. Used
 * both as fcose's pre-layout seed and, unchanged, as the final
 * guaranteed-non-degenerate fallback if fcose can't produce a usable result.
 */
export function seedPositions(
  nodeIds: string[],
  clusterByTerm: Record<string, number>,
  seedKey: string,
): Record<string, SeededPosition> {
  const rand = mulberry32(hashSeed(seedKey))
  const byCluster = new Map<number, string[]>()
  for (const id of nodeIds) {
    const c = clusterByTerm[id] ?? 0
    if (!byCluster.has(c)) byCluster.set(c, [])
    byCluster.get(c)!.push(id)
  }
  const clusters = [...byCluster.keys()].sort((a, b) => a - b)
  const macroScale = clusters.length <= 1 ? 0 : 70

  const positions: Record<string, SeededPosition> = {}
  clusters.forEach((clusterIndex, ci) => {
    const members = byCluster.get(clusterIndex)!
    const center = clusters.length <= 1 ? { x: 0, y: 0 } : sunflowerPoint(ci, macroScale)
    members.forEach((id, i) => {
      const offset = sunflowerPoint(i, 24)
      // Small cosmetic wobble only — the spiral itself is what structurally
      // guarantees spread; this just keeps same-cluster members from reading
      // as a too-perfect rosette.
      const wobble = (rand() - 0.5) * 0.3
      const cosW = Math.cos(wobble)
      const sinW = Math.sin(wobble)
      positions[id] = {
        x: center.x + offset.x * cosW - offset.y * sinW,
        y: center.y + offset.x * sinW + offset.y * cosW,
      }
    })
  })
  return positions
}

const MIN_AREA_PER_NODE = 150
const MIN_SEPARATION = 8

/**
 * A layout counts as degenerate if it never actually spread out: either the
 * overall footprint is implausibly small for the node count, or a chunk of
 * nodes ended up within a hair of each other — the literal "stacked" symptom.
 */
export function isDegenerateLayout(positions: Record<string, SeededPosition>): boolean {
  const pts = Object.values(positions)
  if (pts.length <= 1) return false

  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
  if (area < pts.length * MIN_AREA_PER_NODE) return true

  let closePairs = 0
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < MIN_SEPARATION) closePairs++
    }
  }
  return closePairs > Math.max(2, pts.length * 0.1)
}
