'use client'

// Map tab body. Reads everything from the store — no fetch of its own (the
// Mastery lens' review-interval data is populated by FlashcardPanel's existing
// query, not refetched here). Builds the graph in two passes: an instant
// base pass (slide Jaccard + transcript co-occurrence only) via buildGraphMemoized,
// then an embeddings-enriched pass once embed-terms.ts resolves — gated so it
// never runs while Whisper/sync/live-recording are active (CONTEXT.md §10 rule 10).

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSessionStore } from '@/store/session-store'
import { useEnhancementStore } from '@/store/enhancement-store'
import { useMotion } from '@/lib/motion'
import { buildGraphMemoized, hashKeywords, type GraphResult, type GraphNode } from '@/lib/graph/buildGraph'
import { embedTerms } from '@/lib/graph/embed-terms'
import { detectClusters } from '@/lib/graph/detect-clusters'
import { computeMastery, type MasteryState } from '@/lib/scoring/srs'
import { EnhancementOverlay } from '@/components/study-guide/enhancement-overlay'
import { MapSearch } from './map-search'
import { MapListView } from './map-list-view'
import { MapLegend } from './map-legend'
import { NodeDrawer, type DrawerNode } from './node-drawer'
import type { CytoscapeGraphHandle, Lens } from './cytoscape-graph'

const CLUSTER_PALETTE_SIZE = 6

const CytoscapeGraph = dynamic(
  () => import('./cytoscape-graph').then((m) => m.CytoscapeGraph),
  {
    ssr: false,
    loading: () => (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>Loading map…</span>
      </div>
    ),
  },
)

const MIN_TERMS = 3
// Exact templates from flashcard-generator.ts's non-enhanced fallback backs —
// rendering these as if they were real definitions would look broken.
const FALLBACK_PREFIXES = ['Covered on slide', 'Term from study guide:']

function mapControlButtonStyle(hasBorderTop: boolean): React.CSSProperties {
  return {
    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', borderTop: hasBorderTop ? '1px solid var(--color-border-default)' : 'none',
    background: 'var(--color-bg-overlay)', color: 'var(--color-text-secondary)', fontSize: 14, cursor: 'pointer',
  }
}

interface Props {
  sessionId: string
  hasSlides: boolean
  isScoring: boolean
  /** Whisper/sync/live-recording active — gates embedding computation. */
  bertBusy: boolean
  onScoreNow: () => void
  onGoToSlide: (slideIndex: number) => void
  onGoToFlashcard: (flashcardId: string) => void
}

export function MapTab({ sessionId, hasSlides, isScoring, bertBusy, onScoreNow, onGoToSlide, onGoToFlashcard }: Props) {
  const keywords = useSessionStore((s) => s.keywords)
  const flashcards = useSessionStore((s) => s.flashcards)
  const transcriptWords = useSessionStore((s) => s.transcriptWords)
  const reviewIntervals = useSessionStore((s) => s.reviewIntervalsByFlashcardId)
  const enhancementRunning = useEnhancementStore((s) => s.isRunning && s.sessionId === sessionId)
  const { reduced } = useMotion()

  const [lens, setLens] = useState<Lens>('importance')
  const [redZoneOnly, setRedZoneOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listView, setListView] = useState(false)
  const [baseGraph, setBaseGraph] = useState<GraphResult | null>(null)
  const [embedGraph, setEmbedGraph] = useState<GraphResult | null>(null)
  const [embedLoading, setEmbedLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const graphRef = useRef<CytoscapeGraphHandle>(null)

  const graphInput = useMemo(() => ({
    keywords: keywords.map((k) => ({ term: k.term, zone: k.zone, confidence: k.confidenceScore, slideIndices: k.slideIndices })),
    cards: flashcards.map((fc) => ({ keywordTerm: fc.keywordTerm, back: fc.back, slideIndex: fc.slideIndex })),
    transcriptWords: transcriptWords.length > 0 ? transcriptWords.map((w) => ({ word: w.word, startMs: w.startMs })) : undefined,
  }), [keywords, flashcards, transcriptWords])

  const cacheKey = useMemo(() => `${sessionId}:${hashKeywords(graphInput.keywords)}`, [sessionId, graphInput.keywords])

  // Base graph — instant first pass, slide Jaccard + transcript co-occurrence only.
  // Every setState below runs inside a .then/.catch callback, never synchronously
  // in the effect body itself (avoids the cascading-render lint rule) — the
  // keywords.length < MIN_TERMS case needs no reset: the render logic below
  // already hides stale baseGraph/error state once that branch takes over.
  useEffect(() => {
    if (keywords.length < MIN_TERMS) return
    let cancelled = false
    buildGraphMemoized(`${sessionId}:base`, graphInput)
      .then((g) => { if (!cancelled) { setBaseGraph(g); setError(null) } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [sessionId, graphInput, keywords.length])

  // Embeddings — enriches the same graph once ready. A failure here is silent:
  // embeddings are optional in buildGraph's contract, so it just keeps the base graph.
  useEffect(() => {
    if (keywords.length < MIN_TERMS || bertBusy) return
    let cancelled = false
    Promise.resolve()
      .then(() => { if (!cancelled) setEmbedLoading(true) })
      .then(() => embedTerms(graphInput.keywords.map((k) => k.term)))
      .then((embeddings) => buildGraphMemoized(`${sessionId}:embed`, { ...graphInput, embeddings }))
      .then((g) => { if (!cancelled) setEmbedGraph(g) })
      .catch(() => { /* optional signal — base graph stays authoritative */ })
      .finally(() => { if (!cancelled) setEmbedLoading(false) })
    return () => { cancelled = true }
  }, [sessionId, graphInput, keywords.length, bertBusy])

  const graph = embedGraph ?? baseGraph

  const masteryByTerm = useMemo(() => {
    const result: Record<string, MasteryState> = {}
    for (const fc of flashcards) {
      result[fc.keywordTerm] = computeMastery(reviewIntervals[fc.id]).state
    }
    return result
  }, [flashcards, reviewIntervals])

  // Recomputed only when the graph itself changes (not on lens/filter toggles) —
  // same memo boundary buildGraphMemoized already uses.
  const clusterByTerm = useMemo(() => {
    if (!graph) return {}
    return detectClusters(graph.nodes, graph.edges)
  }, [graph])

  const clusterSlots = useMemo(() => {
    const slots = new Set(Object.values(clusterByTerm).map((i) => i % CLUSTER_PALETTE_SIZE))
    return [...slots].sort((a, b) => a - b)
  }, [clusterByTerm])

  function resolveDrawerNode(id: string): DrawerNode | null {
    if (!graph) return null
    const node = graph.nodes.find((n) => n.id === id)
    if (!node) return null
    const keyword = keywords.find((k) => k.term === id)
    const card = flashcards.find((fc) => fc.keywordTerm === id)
    const isFallback = !card || FALLBACK_PREFIXES.some((p) => card.back.startsWith(p))
    const slideIndex = card?.slideIndex ?? keyword?.slideIndices[0] ?? null
    const neighborIds = graph.edges
      .filter((e) => e.source === id || e.target === id)
      .map((e) => (e.source === id ? e.target : e.source))
    const byId = new Map(graph.nodes.map((n): [string, GraphNode] => [n.id, n]))
    return {
      id: node.id,
      label: node.label,
      zone: node.zone,
      score: node.score,
      definition: isFallback ? '' : card!.back,
      slideIndex,
      flashcardId: card?.id ?? null,
      neighbors: neighborIds.map((nid) => byId.get(nid)).filter((n): n is GraphNode => !!n).map((n) => ({ id: n.id, label: n.label })),
    }
  }

  function handleZoomIn() { graphRef.current?.zoomBy(0.3) }
  function handleZoomOut() { graphRef.current?.zoomBy(-0.3) }
  function handleFit() { graphRef.current?.fit() }
  function handleResetView() {
    setSelectedId(null)
    graphRef.current?.reset()
  }

  function handleResetLayout() {
    setSelectedId(null)
    graphRef.current?.resetLayout()
  }

  function handleSearchSelect(id: string) {
    setSelectedId(id)
    graphRef.current?.panToNode(id)
  }

  const drawerNode = selectedId ? resolveDrawerNode(selectedId) : null

  // ── States ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Map unavailable — {error}</p>
      </div>
    )
  }

  if (keywords.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>No keywords scored yet — the map builds from your Red/Likely Zone terms.</span>
        {hasSlides && (
          <button
            type="button"
            onClick={onScoreNow}
            disabled={isScoring}
            style={{ height: 32, padding: '0 16px', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', fontSize: 12, cursor: isScoring ? 'not-allowed' : 'pointer', opacity: isScoring ? 0.5 : 1 }}
          >
            {isScoring ? 'Scoring…' : 'Score now'}
          </button>
        )}
      </div>
    )
  }

  if (keywords.length < MIN_TERMS) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Not enough terms yet for a useful map — need at least {MIN_TERMS}.</span>
      </div>
    )
  }

  if (!graph) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>Building map…</span>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {enhancementRunning && <EnhancementOverlay sessionId={sessionId} onDismiss={() => useEnhancementStore.getState().dismiss()} />}

      {/* Toolbar */}
      <div style={{ flexShrink: 0, height: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderBottom: '1px solid var(--color-border-default)' }}>
        <div style={{ display: 'flex', gap: 3, padding: 3, border: '1px solid var(--color-border-default)' }}>
          {(['importance', 'mastery'] as Lens[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLens(l)}
              style={{
                height: 24, padding: '0 10px', border: 'none', cursor: 'pointer', fontSize: 11.5,
                background: lens === l ? 'var(--color-bg-subtle)' : 'transparent',
                color: lens === l ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              }}
            >
              {l === 'importance' ? 'Importance' : 'Mastery'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setRedZoneOnly((v) => !v)}
          style={{
            height: 30, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11.5,
            border: `1px solid ${redZoneOnly ? 'color-mix(in srgb, var(--color-severity) 45%, transparent)' : 'var(--color-border-default)'}`,
            background: redZoneOnly ? 'color-mix(in srgb, var(--color-severity) 10%, transparent)' : 'transparent',
            color: redZoneOnly ? 'var(--color-severity)' : 'var(--color-text-secondary)',
          }}
        >
          Red Zone only
        </button>

        {embedLoading && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-text-tertiary)' }}>Enhancing connections…</span>
        )}

        {!listView && (
          <button
            type="button"
            onClick={handleResetLayout}
            title="Clear the cached layout and re-run it from scratch"
            style={{ height: 30, padding: '0 12px', border: '1px solid var(--color-border-default)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: 11.5, cursor: 'pointer' }}
          >
            Reset layout
          </button>
        )}

        <div style={{ flex: 1 }} />

        {!listView && <MapSearch nodes={graph.nodes.map((n) => ({ id: n.id, label: n.label }))} onSelect={handleSearchSelect} />}

        <button
          type="button"
          onClick={() => setListView((v) => !v)}
          style={{ height: 30, padding: '0 12px', border: '1px solid var(--color-border-default)', background: listView ? 'var(--color-bg-subtle)' : 'transparent', color: 'var(--color-text-secondary)', fontSize: 11.5, cursor: 'pointer' }}
        >
          {listView ? 'Map view' : 'List view'}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: listView ? 'auto' : 'hidden', padding: listView ? 16 : 0 }}>
        {listView ? (
          <MapListView nodes={graph.nodes} lens={lens} masteryByTerm={masteryByTerm} redZoneOnly={redZoneOnly} onSelect={setSelectedId} />
        ) : (
          <>
            <CytoscapeGraph
              ref={graphRef}
              graph={graph}
              cacheKey={cacheKey}
              lens={lens}
              masteryByTerm={masteryByTerm}
              clusterByTerm={clusterByTerm}
              redZoneOnly={redZoneOnly}
              selectedId={selectedId}
              onSelect={setSelectedId}
              reduced={reduced}
            />
            <MapLegend lens={lens} clusterSlots={clusterSlots} />
            <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 4, display: 'flex', flexDirection: 'column', border: '1px solid var(--color-border-default)' }}>
              <button type="button" title="Zoom in" onClick={handleZoomIn} style={mapControlButtonStyle(false)}>+</button>
              <button type="button" title="Zoom out" onClick={handleZoomOut} style={mapControlButtonStyle(true)}>–</button>
              <button type="button" title="Fit to view" onClick={handleFit} style={mapControlButtonStyle(true)}>⤢</button>
              <button type="button" title="Reset view" onClick={handleResetView} style={mapControlButtonStyle(true)}>↺</button>
            </div>
          </>
        )}
      </div>

      <NodeDrawer
        node={drawerNode}
        onClose={() => setSelectedId(null)}
        onSelectNeighbor={setSelectedId}
        onGoToSlide={onGoToSlide}
        onGoToFlashcard={onGoToFlashcard}
      />
    </div>
  )
}
