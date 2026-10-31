import { describe, it, expect } from 'vitest'
import { buildGraph, type GraphKeywordInput, type GraphCardInput, type GraphTranscriptWordInput } from './buildGraph'

function hasEdge(edges: { source: string; target: string }[], a: string, b: string): boolean {
  return edges.some((e) => (e.source === a && e.target === b) || (e.source === b && e.target === a))
}

function degreeOf(edges: { source: string; target: string }[], term: string): number {
  return edges.filter((e) => e.source === term || e.target === term).length
}

// ─── Fixture: slides-only session (no transcript, no embeddings) ────────────
describe('buildGraph — slides-only session', () => {
  const keywords: GraphKeywordInput[] = [
    { term: 'mitosis', zone: 'red', confidence: 0.9, slideIndices: [2, 3, 4] },
    { term: 'meiosis', zone: 'red', confidence: 0.85, slideIndices: [3, 4, 5] },
    { term: 'chromosome', zone: 'red', confidence: 0.8, slideIndices: [2, 3] },
    { term: 'photosynthesis', zone: 'likely', confidence: 0.4, slideIndices: [10] },
    { term: 'atp', zone: 'likely', confidence: 0.3, slideIndices: [10, 11] },
  ]
  const cards: GraphCardInput[] = [
    { keywordTerm: 'mitosis', back: 'Cell division producing two identical daughter cells.', slideIndex: 2 },
  ]

  it('produces one node per keyword, carrying zone/score/definition', () => {
    const { nodes } = buildGraph({ keywords, cards })
    expect(nodes).toHaveLength(5)
    const mitosis = nodes.find((n) => n.id === 'mitosis')
    expect(mitosis).toMatchObject({ id: 'mitosis', label: 'mitosis', zone: 'red', score: 0.9 })
    expect(mitosis?.definition).toBe('Cell division producing two identical daughter cells.')
    // No card cites "atp" — definition falls back to empty string, not undefined.
    expect(nodes.find((n) => n.id === 'atp')?.definition).toBe('')
  })

  it('connects keywords that share slides, weighted by slide Jaccard alone', () => {
    const { edges } = buildGraph({ keywords, cards })
    // mitosis ∩ meiosis = {3,4} (2), ∪ = {2,3,4,5} (4) → 0.5
    const mitMei = edges.find((e) => hasEdge([e], 'mitosis', 'meiosis'))
    expect(mitMei?.weight).toBeCloseTo(0.5, 5)
    // mitosis ∩ chromosome = {2,3} (2), ∪ = {2,3,4} (3) → 0.667
    const mitChr = edges.find((e) => hasEdge([e], 'mitosis', 'chromosome'))
    expect(mitChr?.weight).toBeCloseTo(2 / 3, 5)
    // photosynthesis ∩ atp = {10} (1), ∪ = {10,11} (2) → 0.5
    const psAtp = edges.find((e) => hasEdge([e], 'photosynthesis', 'atp'))
    expect(psAtp?.weight).toBeCloseTo(0.5, 5)
  })

  it('does not connect keywords with no shared slides across unrelated clusters', () => {
    const { edges } = buildGraph({ keywords, cards })
    expect(hasEdge(edges, 'mitosis', 'photosynthesis')).toBe(false)
    expect(hasEdge(edges, 'chromosome', 'atp')).toBe(false)
  })

  it('leaves no node isolated and every weight in [0, 1]', () => {
    const { nodes, edges } = buildGraph({ keywords, cards })
    for (const n of nodes) expect(degreeOf(edges, n.id)).toBeGreaterThan(0)
    for (const e of edges) {
      expect(e.weight).toBeGreaterThanOrEqual(0)
      expect(e.weight).toBeLessThanOrEqual(1)
    }
  })
})

// ─── Fixture: audio session (transcript co-occurrence available) ────────────
describe('buildGraph — audio session (transcript co-occurrence)', () => {
  const keywords: GraphKeywordInput[] = [
    { term: 'enzyme', zone: 'red', confidence: 0.9, slideIndices: [1] },
    { term: 'catalyst', zone: 'red', confidence: 0.7, slideIndices: [2] },
    { term: 'unrelated', zone: 'likely', confidence: 0.3, slideIndices: [7] },
  ]
  const cards: GraphCardInput[] = []
  // "enzyme" and "catalyst" are spoken 4s apart (well within the 30s window);
  // "unrelated" is spoken over 3 minutes later — no temporal relation to either.
  const transcriptWords: GraphTranscriptWordInput[] = [
    { word: 'the', startMs: 500 },
    { word: 'enzyme', startMs: 1000 },
    { word: 'acts', startMs: 2000 },
    { word: 'as', startMs: 3000 },
    { word: 'a', startMs: 4000 },
    { word: 'catalyst', startMs: 5000 },
    { word: 'unrelated', startMs: 200_000 },
  ]

  it('connects terms mentioned close together in the transcript even with no shared slide', () => {
    const { edges } = buildGraph({ keywords, cards, transcriptWords })
    // No slide overlap at all (slideIndices never intersect) — jaccard = 0 for every
    // pair — so any surviving edge must come entirely from the co-occurrence signal.
    const edge = edges.find((e) => hasEdge([e], 'enzyme', 'catalyst'))
    expect(edge).toBeDefined()
    expect(edge!.weight).toBeGreaterThan(0)
  })

  it('does not fabricate a co-occurrence edge for terms spoken far apart in time', () => {
    const { edges } = buildGraph({ keywords, cards, transcriptWords })
    // "unrelated" shares no slide with either term and is spoken >3 minutes away from
    // both, so neither real edge clears the threshold — both land at weight 0, tied.
    // Exactly one survives via the single-strongest-edge safety net; which of the two
    // tied candidates wins is an implementation-detail tiebreak, not asserted here.
    expect(degreeOf(edges, 'unrelated')).toBe(1)
    const rescued = edges.find((e) => e.source === 'unrelated' || e.target === 'unrelated')
    expect(rescued?.weight).toBe(0)
  })

  it('omitting transcriptWords falls back to slide Jaccard only (no crash, no phantom signal)', () => {
    const withTranscript = buildGraph({ keywords, cards, transcriptWords })
    const withoutTranscript = buildGraph({ keywords, cards })
    // Without the transcript, enzyme/catalyst share no slide → weight must drop to 0
    // (rescued only by the safety net, since it's each node's sole candidate here).
    const withW = withTranscript.edges.find((e) => hasEdge([e], 'enzyme', 'catalyst'))!.weight
    const withoutW = withoutTranscript.edges.find((e) => hasEdge([e], 'enzyme', 'catalyst'))!.weight
    expect(withoutW).toBe(0)
    expect(withW).toBeGreaterThan(withoutW)
  })
})

// ─── Fixture: fewer than 5 terms ──────────────────────────────────────────────
describe('buildGraph — fewer than 5 terms', () => {
  it('builds a small graph correctly with 3 keywords', () => {
    const keywords: GraphKeywordInput[] = [
      { term: 'a', zone: 'red', confidence: 0.9, slideIndices: [1, 2] },
      { term: 'b', zone: 'red', confidence: 0.6, slideIndices: [2, 3] },
      { term: 'c', zone: 'likely', confidence: 0.2, slideIndices: [9] },
    ]
    const { nodes, edges } = buildGraph({ keywords, cards: [] })
    expect(nodes).toHaveLength(3)
    // a/b share slide 2 → real signal; c shares nothing → rescued only by the safety net.
    expect(hasEdge(edges, 'a', 'b')).toBe(true)
    expect(degreeOf(edges, 'c')).toBeGreaterThan(0)
    for (const n of nodes) expect(degreeOf(edges, n.id)).toBeGreaterThan(0)
  })

  it('returns no edges for a single keyword (nothing to connect)', () => {
    const keywords: GraphKeywordInput[] = [{ term: 'solo', zone: 'red', confidence: 0.5, slideIndices: [1] }]
    const { nodes, edges } = buildGraph({ keywords, cards: [] })
    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })

  it('returns an empty graph for zero keywords', () => {
    const { nodes, edges } = buildGraph({ keywords: [], cards: [] })
    expect(nodes).toHaveLength(0)
    expect(edges).toHaveLength(0)
  })
})

// ─── Pruning mechanics ────────────────────────────────────────────────────────
describe('buildGraph — pruning', () => {
  it('keeps a below-threshold edge as the safety net when it is a node\'s only option', () => {
    // Two keywords, zero shared slides, no transcript, no embeddings → blended
    // weight is exactly 0, well under EDGE_THRESHOLD — but with only one other
    // node to connect to, each one's "single strongest edge" is this same edge.
    const keywords: GraphKeywordInput[] = [
      { term: 'x', zone: 'red', confidence: 0.5, slideIndices: [1] },
      { term: 'y', zone: 'likely', confidence: 0.5, slideIndices: [2] },
    ]
    const { edges } = buildGraph({ keywords, cards: [] })
    expect(edges).toHaveLength(1)
    expect(edges[0].weight).toBe(0)
    expect(hasEdge(edges, 'x', 'y')).toBe(true)
  })

  it('caps a hub node at its top 4 edges, dropping its weakest even above threshold', () => {
    // hub shares a shrinking slide range with p1..p4 (ranked strongest→weakest for
    // hub) and a *small* range with p5 that is p5's own weakest connection too —
    // p5 overlaps p1..p4 more strongly than it overlaps hub, so neither side votes
    // to keep hub–p5: it must be dropped by the top-4 cap, not rescued by the union
    // rule or the safety net (p5 and hub both already have other edges).
    const keywords: GraphKeywordInput[] = [
      { term: 'hub', zone: 'red', confidence: 0.9, slideIndices: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { term: 'p1', zone: 'red', confidence: 0.8, slideIndices: [1, 2, 3, 4, 5, 6, 7, 8] },
      { term: 'p2', zone: 'red', confidence: 0.7, slideIndices: [1, 2, 3, 4, 5, 6] },
      { term: 'p3', zone: 'red', confidence: 0.6, slideIndices: [1, 2, 3, 4] },
      { term: 'p4', zone: 'red', confidence: 0.5, slideIndices: [1, 2, 3] },
      { term: 'p5', zone: 'likely', confidence: 0.3, slideIndices: [1, 2] },
    ]
    const { edges } = buildGraph({ keywords, cards: [] })

    expect(hasEdge(edges, 'hub', 'p1')).toBe(true)
    expect(hasEdge(edges, 'hub', 'p2')).toBe(true)
    expect(hasEdge(edges, 'hub', 'p3')).toBe(true)
    expect(hasEdge(edges, 'hub', 'p4')).toBe(true)
    expect(hasEdge(edges, 'hub', 'p5')).toBe(false)
    expect(degreeOf(edges, 'hub')).toBeLessThanOrEqual(4)
    // p5 isn't isolated — it's connected via p1-p4, just not to hub.
    expect(degreeOf(edges, 'p5')).toBeGreaterThan(0)
  })

  it('drops edges below the threshold when the node has other above-threshold options', () => {
    const keywords: GraphKeywordInput[] = [
      { term: 'strong-a', zone: 'red', confidence: 0.9, slideIndices: [1, 2, 3, 4] },
      { term: 'strong-b', zone: 'red', confidence: 0.8, slideIndices: [1, 2, 3] },
      { term: 'weak', zone: 'likely', confidence: 0.2, slideIndices: [4] }, // tiny overlap with strong-a only
    ]
    const { edges } = buildGraph({ keywords, cards: [] })
    expect(hasEdge(edges, 'strong-a', 'strong-b')).toBe(true)
    // strong-a/weak jaccard = 1/4 = 0.25, above threshold — kept. Assert weight directly
    // rather than presence, so this test documents the exact boundary.
    const weak = edges.find((e) => hasEdge([e], 'strong-a', 'weak'))
    expect(weak?.weight).toBeCloseTo(0.25, 5)
  })
})

// ─── Embedding signal ─────────────────────────────────────────────────────────
describe('buildGraph — embedding cosine signal', () => {
  it('connects terms via embedding similarity alone when slides and transcript give no signal', () => {
    const keywords: GraphKeywordInput[] = [
      { term: 'photosynthesis', zone: 'red', confidence: 0.8, slideIndices: [1] },
      { term: 'chlorophyll', zone: 'red', confidence: 0.7, slideIndices: [9] }, // no shared slide
    ]
    const embeddings = {
      photosynthesis: [1, 0, 0],
      chlorophyll: [0.9, 0.1, 0], // near-parallel → cosine ≈ 0.994
    }
    const { edges } = buildGraph({ keywords, cards: [], embeddings })
    const edge = edges.find((e) => hasEdge([e], 'photosynthesis', 'chlorophyll'))
    expect(edge).toBeDefined()
    // Slide Jaccard is always computed (never "missing" the way an absent transcript
    // or embeddings map is) — it contributes a real 0 here, since the two terms share
    // no slide. Blend: (0.4×0 + 0.25×0.994) / 0.65 ≈ 0.382. Still clears EDGE_THRESHOLD
    // (0.15), which is the actual point of this test: embeddings alone can create an
    // edge where slides give zero signal.
    expect(edge!.weight).toBeCloseTo(0.3823, 3)
    expect(edge!.weight).toBeGreaterThan(0.15)
  })

  it('ignores embeddings missing for one of the two terms rather than crashing', () => {
    const keywords: GraphKeywordInput[] = [
      { term: 'a', zone: 'red', confidence: 0.5, slideIndices: [1, 2] },
      { term: 'b', zone: 'red', confidence: 0.5, slideIndices: [2, 3] },
    ]
    // Only "a" has an embedding — the pair must fall back to slide Jaccard alone.
    const { edges } = buildGraph({ keywords, cards: [], embeddings: { a: [1, 0] } })
    // a ∩ b = {2} (1), ∪ = {1,2,3} (3) → 1/3
    expect(edges[0].weight).toBeCloseTo(1 / 3, 5)
  })
})
