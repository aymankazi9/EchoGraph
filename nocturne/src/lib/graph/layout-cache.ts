// In-memory node-position cache for the Map tab's Cytoscape graph — sibling to
// buildGraph.ts's own memoization, keyed the same way (sessionId + a cache
// namespace). fcose/cose only ever runs once per key; every subsequent mount,
// filter toggle, or selection reuses these positions via a 'preset' layout so
// the graph never visibly re-shuffles.
//
// Lost on a full page reload by design — no persistence, matching buildGraph's
// "nothing is sent to any server, edges are not persisted" constraint. A fresh
// layout on reload is an acceptable, expected cost for a v1 feature with no
// storage surface.

export type NodePositions = Record<string, { x: number; y: number }>

const cache = new Map<string, NodePositions>()

// Bumped because v1 entries could be written by the preset layout's
// `positions(node)` callback being keyed on the wrong lookup (the function
// receives the NodeSingular itself, not its id — see cytoscape-graph.tsx),
// which silently collapsed every node to {x:0,y:0} on cache restore. Bumping
// this discards any such entry outright; combined with the read-time
// validation in cytoscape-graph.tsx, a stale/bad cache can't cause this again.
const CACHE_VERSION = 'v2'
const versionedKey = (cacheKey: string) => `${cacheKey}:${CACHE_VERSION}`

export function getCachedLayout(cacheKey: string): NodePositions | undefined {
  return cache.get(versionedKey(cacheKey))
}

export function setCachedLayout(cacheKey: string, positions: NodePositions): void {
  cache.set(versionedKey(cacheKey), positions)
}

export function clearCachedLayout(cacheKey: string): void {
  cache.delete(versionedKey(cacheKey))
}

export function clearLayoutCache(sessionId?: string): void {
  if (!sessionId) { cache.clear(); return }
  for (const key of cache.keys()) {
    if (key.startsWith(`${sessionId}:`)) cache.delete(key)
  }
}
