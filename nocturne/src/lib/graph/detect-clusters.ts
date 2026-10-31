// Community detection for the Map tab's cluster coloring. Pure and synchronous,
// same shape as buildGraph.ts — no dependency, directly unit-testable.
//
// Implements only the "local moving" phase of Louvain (repeatedly move each
// node to whichever neighboring community most increases modularity) without
// the multi-level recursive aggregation step. At the tens-to-~200-node scale
// these graphs run at, that gives visualization-grade community quality
// without pulling in a graph library or adopting a different data model.

interface ClusterEdge {
  source: string
  target: string
  weight: number
}

/** Node id -> dense cluster index, 0 = largest cluster. */
export function detectClusters(
  nodes: { id: string }[],
  edges: ClusterEdge[],
): Record<string, number> {
  if (nodes.length === 0) return {}

  const ids = nodes.map((n) => n.id)
  if (edges.length === 0) {
    // No structure to cluster on — every node is its own singleton community.
    return Object.fromEntries(ids.map((id, i) => [id, i]))
  }

  // Adjacency as weight maps for O(degree) gain lookups.
  const neighborWeights = new Map<string, Map<string, number>>()
  for (const id of ids) neighborWeights.set(id, new Map())
  let totalWeight = 0
  for (const e of edges) {
    if (!neighborWeights.has(e.source) || !neighborWeights.has(e.target)) continue
    neighborWeights.get(e.source)!.set(e.target, (neighborWeights.get(e.source)!.get(e.target) ?? 0) + e.weight)
    neighborWeights.get(e.target)!.set(e.source, (neighborWeights.get(e.target)!.get(e.source) ?? 0) + e.weight)
    totalWeight += e.weight
  }
  const twoM = 2 * totalWeight
  if (twoM === 0) {
    return Object.fromEntries(ids.map((id, i) => [id, i]))
  }

  // Weighted degree per node (k_i) — constant across the local-moving phase.
  const degree = new Map<string, number>()
  for (const id of ids) {
    let k = 0
    for (const w of neighborWeights.get(id)!.values()) k += w
    degree.set(id, k)
  }

  const community = new Map<string, string>(ids.map((id) => [id, id]))
  const communityWeight = new Map<string, number>(ids.map((id) => [id, degree.get(id) ?? 0]))

  const stableOrder = [...ids].sort()
  const MAX_PASSES = 10

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false

    for (const id of stableOrder) {
      const currentComm = community.get(id)!
      const kI = degree.get(id) ?? 0

      // Weight from this node into each neighboring community (k_i,in per candidate).
      const weightToComm = new Map<string, number>()
      for (const [neighbor, w] of neighborWeights.get(id)!) {
        const c = community.get(neighbor)!
        weightToComm.set(c, (weightToComm.get(c) ?? 0) + w)
      }
      if (weightToComm.size === 0) continue

      // Remove node from its current community before evaluating moves.
      communityWeight.set(currentComm, (communityWeight.get(currentComm) ?? 0) - kI)

      let bestComm = currentComm
      let bestGain = 0
      for (const [candidateComm, kIIn] of weightToComm) {
        const sigmaTot = communityWeight.get(candidateComm) ?? 0
        const gain = kIIn - (kI * sigmaTot) / twoM
        if (gain > bestGain) {
          bestGain = gain
          bestComm = candidateComm
        }
      }

      community.set(id, bestComm)
      communityWeight.set(bestComm, (communityWeight.get(bestComm) ?? 0) + kI)
      if (bestComm !== currentComm) moved = true
    }

    if (!moved) break
  }

  // Dense re-numbering by descending community size, stable tiebreak by id.
  const sizeByComm = new Map<string, number>()
  for (const c of community.values()) sizeByComm.set(c, (sizeByComm.get(c) ?? 0) + 1)
  const ranked = [...sizeByComm.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const indexByComm = new Map(ranked.map(([c], i) => [c, i]))

  const result: Record<string, number> = {}
  for (const id of ids) result[id] = indexByComm.get(community.get(id)!)!
  return result
}
