'use client'

// The actual Cytoscape canvas. Dynamically imported with ssr:false by map-tab.tsx
// (Cytoscape touches the DOM at construction time — no business running server-side).
//
// Strict-Mode safety: cytoscape.use(fcose)/cytoscape.use(layoutUtilities) run
// exactly once, at module scope (confirmed below — not inside the component or
// any effect). The lifecycle effect creates the instance and destroys it in
// cleanup; `destroyedRef` is flipped in that same cleanup, before `cy.destroy()`
// runs, and every async callback (ResizeObserver, layoutstop) checks it first so
// a callback that fires after unmount is a no-op instead of touching a dead
// instance. The running layout is stopped in cleanup too.
//
// Initialization sequence (why nodes never visibly stack or re-settle):
// elements are built with deterministic seeded positions already baked in (see
// layout-seed.ts) — no node is ever created at a shared default coordinate.
// The canvas stays at opacity 0 behind a loading state until: the container
// reports a non-zero size (one-shot ResizeObserver), cy.resize() runs, fcose
// lays out the (already pre-spread) graph, and the result passes a
// degenerate-layout check. A degenerate result retries once with a fresh
// random start; if that also fails, the deterministic seed itself becomes the
// final layout (guaranteed non-degenerate by construction). Only then does
// cy.fit() run and the canvas reveal.

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import cytoscape from 'cytoscape'
import type { Core, ElementDefinition, NodeSingular, Layouts, LayoutOptions } from 'cytoscape'
import fcose from 'cytoscape-fcose'
import layoutUtilities from 'cytoscape-layout-utilities'

// cytoscape's own `Stylesheet` type alias is missing its `export` keyword in
// the installed @types/cytoscape version (its two halves, StylesheetStyle and
// StylesheetCSS, import fine) — reconstructed locally rather than patching
// node_modules.
type Stylesheet = cytoscape.StylesheetStyle | cytoscape.StylesheetCSS
import type { GraphResult, GraphNode } from '@/lib/graph/buildGraph'
import type { MasteryState } from '@/lib/scoring/srs'
import { getCachedLayout, setCachedLayout, clearCachedLayout } from '@/lib/graph/layout-cache'
import { seedPositions, isDegenerateLayout, type SeededPosition } from '@/lib/graph/layout-seed'
import { useIsMobile } from '@/lib/use-media-query'

cytoscape.use(fcose)
cytoscape.use(layoutUtilities)

export type Lens = 'importance' | 'mastery'

export interface CytoscapeGraphHandle {
  /** Pans/zooms to a node — used by map-search.tsx. Distinct from the no-recenter click rule below. */
  panToNode: (id: string) => void
  zoomBy: (delta: number) => void
  fit: () => void
  /** Clears hover focus and fits the view. Selection itself is parent state — the caller clears it separately. */
  reset: () => void
  /** Clears this session's cached layout and re-runs the full strict init sequence from a fresh seed. */
  resetLayout: () => void
}

interface Props {
  graph: GraphResult
  cacheKey: string
  lens: Lens
  masteryByTerm: Record<string, MasteryState>
  /** Dense cluster index per node id, from detect-clusters.ts. */
  clusterByTerm: Record<string, number>
  redZoneOnly: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
  reduced: boolean
}

interface ThemeColors {
  severity: string
  clusters: string[]
  borderStrong: string
  textPrimary: string
  textSecondary: string
  textDisabled: string
  bgBase: string
}

function readThemeColors(): ThemeColors {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
  return {
    severity: v('--color-severity', '#FF3B30'),
    clusters: [
      v('--color-graph-cluster-1', '#6B8CAE'),
      v('--color-graph-cluster-2', '#7FA88C'),
      v('--color-graph-cluster-3', '#9381A8'),
      v('--color-graph-cluster-4', '#B08C78'),
      v('--color-graph-cluster-5', '#7FA3A3'),
      v('--color-graph-cluster-6', '#A8A072'),
    ],
    borderStrong: v('--color-border-strong', 'rgba(255,255,255,0.14)'),
    textPrimary: v('--color-text-primary', '#EDEDED'),
    textSecondary: v('--color-text-secondary', '#9A9A9F'),
    textDisabled: v('--color-text-disabled', '#4A4A4E'),
    bgBase: v('--color-bg-base', '#0A0A0A'),
  }
}

/** Nodes at or above this importance rank always show a label, regardless of zoom. */
const TOP_LABEL_COUNT = 8
const LABEL_MAX_CHARS = 18

function truncateLabel(label: string): string {
  return label.length > LABEL_MAX_CHARS ? `${label.slice(0, LABEL_MAX_CHARS - 1)}…` : label
}

/** 0-100 rank, ties share the same percentile. Pure, no Cytoscape dependency. */
function rankPercentiles(scores: number[]): number[] {
  const n = scores.length
  if (n <= 1) return scores.map(() => 100)
  const sorted = [...scores].sort((a, b) => a - b)
  return scores.map((s) => {
    const rank = sorted.findIndex((v) => v === s)
    return Math.round((rank / (n - 1)) * 100)
  })
}

interface NodeFields {
  percentile: number
  clusterIndex: number
  topLabel: boolean
}

/**
 * Composite importance (score percentile averaged with degree percentile),
 * cluster assignment, and top-N label eligibility — derived fresh from the
 * current graph+clusters every time, shared by the full build and the
 * incremental new-node path so both stay in sync.
 */
function computeNodeFields(graph: GraphResult, clusterByTerm: Record<string, number>): Map<string, NodeFields> {
  const degreeByTerm = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]))
  for (const e of graph.edges) {
    degreeByTerm.set(e.source, (degreeByTerm.get(e.source) ?? 0) + 1)
    degreeByTerm.set(e.target, (degreeByTerm.get(e.target) ?? 0) + 1)
  }
  const scorePercentiles = rankPercentiles(graph.nodes.map((n) => n.score))
  const degreePercentiles = rankPercentiles(graph.nodes.map((n) => degreeByTerm.get(n.id) ?? 0))
  const importance = graph.nodes.map((_, i) => (scorePercentiles[i] + degreePercentiles[i]) / 2)
  const importancePercentiles = rankPercentiles(importance)
  const topLabelIds = new Set(
    graph.nodes
      .map((n, i) => ({ id: n.id, importance: importance[i] }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, TOP_LABEL_COUNT)
      .map((n) => n.id),
  )
  const fields = new Map<string, NodeFields>()
  graph.nodes.forEach((n, i) => {
    fields.set(n.id, {
      percentile: importancePercentiles[i],
      clusterIndex: clusterByTerm[n.id] ?? 0,
      topLabel: topLabelIds.has(n.id),
    })
  })
  return fields
}

function nodeElement(n: GraphNode, fields: NodeFields, position?: SeededPosition): ElementDefinition {
  return {
    data: {
      id: n.id,
      label: n.label,
      fullLabel: truncateLabel(n.label),
      zone: n.zone,
      percentile: fields.percentile,
      clusterIndex: fields.clusterIndex,
      score: n.score,
      topLabel: fields.topLabel,
    },
    position,
  }
}

function edgeElements(edges: GraphResult['edges']): ElementDefinition[] {
  return edges.map((e) => ({
    data: { id: `${e.source}__${e.target}`, source: e.source, target: e.target, weight: e.weight },
  }))
}

/** Shorter edges and gentler repulsion as the graph grows, so a 100+ node
 *  session doesn't sprawl to a footprint that forces an unreadably tiny fit. */
function tunedIdealEdgeLength(nodeCount: number): number {
  return Math.min(90, Math.max(40, 300 / Math.sqrt(nodeCount) + 30))
}
function tunedNodeRepulsion(nodeCount: number): number {
  return Math.max(1500, 8000 / Math.sqrt(nodeCount))
}

function buildStylesheet(colors: ThemeColors, lens: Lens, masteryByTerm: Record<string, MasteryState>): Stylesheet[] {
  const nodeColor = (ele: NodeSingular): string => {
    if (lens === 'mastery') {
      const state = masteryByTerm[ele.id()] ?? 'new'
      return state === 'mastered' ? colors.textPrimary : state === 'learning' ? colors.textSecondary : colors.textDisabled
    }
    if (ele.data('zone') === 'red') return colors.severity
    const idx = (ele.data('clusterIndex') as number) % colors.clusters.length
    return colors.clusters[idx]
  }

  // underlay-* are real Cytoscape.js 3.x style properties (confirmed against the
  // installed runtime's source — node_modules/cytoscape/dist/cytoscape.cjs.js) that
  // @types/cytoscape simply doesn't declare, the same class of gap as the missing
  // `Stylesheet` export above. Not annotating this object's type lets the extra
  // keys through structurally when it's handed to the typed array below.
  const nodeStyle = {
    'background-color': nodeColor,
    'underlay-color': nodeColor,
    'underlay-opacity': 0.25,
    'underlay-padding': 6,
    'underlay-shape': 'ellipse',
    'overlay-opacity': 0,
    'border-width': 1,
    'border-color': colors.borderStrong,
    width: 'mapData(percentile, 0, 100, 8, 20)',
    height: 'mapData(percentile, 0, 100, 8, 20)',
    label: 'data(fullLabel)',
    color: colors.textSecondary,
    'font-size': 9,
    'font-family': 'var(--font-sans), sans-serif',
    'text-halign': 'right',
    'text-valign': 'center',
    'text-margin-x': 6,
    'text-max-width': 90,
    'text-wrap': 'none',
    'text-outline-color': colors.bgBase,
    'text-outline-width': 2,
    'text-outline-opacity': 1,
    'min-zoomed-font-size': 9,
    'transition-property': 'opacity, background-color, border-color',
    'transition-duration': 175,
  }

  return [
    { selector: 'node', style: nodeStyle },
    {
      selector: 'edge',
      style: {
        width: 'mapData(weight, 0, 1, 0.5, 2)',
        'line-color': colors.borderStrong,
        'curve-style': 'bezier',
        opacity: 'mapData(weight, 0, 1, 0.15, 0.5)',
        'transition-property': 'opacity, line-color',
        'transition-duration': 175,
      },
    },
    {
      selector: 'node[?topLabel], node.labeled',
      style: { 'min-zoomed-font-size': 0 },
    },
    {
      selector: '.dimmed',
      style: { opacity: 0.08 },
    },
    {
      selector: 'edge.highlighted',
      style: { opacity: 0.9, 'line-color': colors.textSecondary, width: 'mapData(weight, 0, 1, 1, 2.5)' },
    },
    {
      selector: 'node.selected',
      style: { 'border-width': 2, 'border-color': colors.textPrimary },
    },
    {
      selector: '.filtered-out',
      style: { opacity: 0.1 },
    },
  ] as Stylesheet[]
}

/** Dims everything outside focusId's closed neighborhood; highlights its edges and labels. */
function applyFocus(cy: Core, focusId: string | null) {
  cy.elements().removeClass('dimmed labeled')
  cy.edges().removeClass('highlighted')
  if (!focusId) return
  const node = cy.getElementById(focusId)
  if (node.empty()) return
  const neighborhood = node.closedNeighborhood()
  cy.elements().addClass('dimmed')
  neighborhood.removeClass('dimmed').addClass('labeled')
  node.connectedEdges().addClass('highlighted')
}

function panAndZoomToNode(cy: Core, node: NodeSingular, reduced: boolean) {
  if (reduced) {
    cy.center(node)
    cy.zoom({ level: 1.4, position: node.position() })
  } else {
    cy.animate({ center: { eles: node }, zoom: 1.4 }, { duration: 400, easing: 'ease-out' })
  }
}

/** Drawer occlusion rect in the container's own rendered-pixel space (matches node-drawer.tsx's layout). */
function drawerOcclusionRect(width: number, height: number, isMobile: boolean) {
  return isMobile
    ? { left: 0, right: width, top: height * 0.25, bottom: height }
    : { left: width - 380, right: width, top: 0, bottom: height }
}

/** fit()'s own computed zoom is clamped against whatever minZoom/maxZoom is
 *  already in effect when it runs — so bounds are derived AFTER fit(), from
 *  its result, instead of being fixed beforehand. That way fit() is never
 *  fighting a static cap, regardless of how large or small the graph's
 *  natural footprint turns out to be. */
function applyZoomRange(cy: Core) {
  const fitZoom = cy.zoom()
  cy.minZoom(fitZoom * 0.3)
  cy.maxZoom(fitZoom * 5)
}

/** One-shot: fires `cb` as soon as `el` reports a non-zero size, then stops
 *  observing. Returns a disconnect function for Strict-Mode cleanup. */
function waitForNonZeroSize(el: HTMLElement, cb: () => void): () => void {
  if (el.clientWidth > 0 && el.clientHeight > 0) {
    cb()
    return () => {}
  }
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        ro.disconnect()
        cb()
        return
      }
    }
  })
  ro.observe(el)
  return () => ro.disconnect()
}

function currentPositions(cy: Core): Record<string, SeededPosition> {
  const out: Record<string, SeededPosition> = {}
  cy.nodes().forEach((n) => { out[n.id()] = n.position() })
  return out
}

interface StrictInitParams {
  cy: Core
  nodeIds: string[]
  clusterByTerm: Record<string, number>
  seedKey: string
  cacheKey: string
  destroyedRef: { current: boolean }
  currentLayoutRef: { current: Layouts | null }
  onSettled: () => void
}

/** Runs fcose, validates the result, retries once from a fresh random start
 *  on a degenerate outcome, and falls back to the deterministic seed itself
 *  (guaranteed non-degenerate) if the retry also fails. Caches positions and
 *  fits only once a non-degenerate result is in hand, so a stacked graph is
 *  never cached and never reaches the screen. */
function runStrictInit(params: StrictInitParams) {
  const { cy, nodeIds, clusterByTerm, seedKey, cacheKey, destroyedRef, currentLayoutRef, onSettled } = params

  function finish() {
    if (destroyedRef.current) return
    setCachedLayout(cacheKey, currentPositions(cy))
    cy.fit(undefined, 40)
    applyZoomRange(cy)
    onSettled()
  }

  function fallbackToSeed() {
    if (destroyedRef.current) return
    const seeded = seedPositions(nodeIds, clusterByTerm, seedKey)
    cy.nodes().forEach((n) => { const p = seeded[n.id()]; if (p) n.position(p) })
    finish()
  }

  function attempt(randomize: boolean, isRetry: boolean) {
    const layout = cy.layout({
      name: 'fcose',
      animate: false,
      randomize,
      quality: 'proof',
      nodeRepulsion: tunedNodeRepulsion(nodeIds.length),
      idealEdgeLength: tunedIdealEdgeLength(nodeIds.length),
      packComponents: true,
      componentSpacing: 40,
    } as LayoutOptions)
    currentLayoutRef.current = layout
    layout.one('layoutstop', () => {
      if (destroyedRef.current) return
      const positions = currentPositions(cy)
      const degenerate = isDegenerateLayout(positions)
      if (degenerate) {
        if (!isRetry) attempt(true, true)
        else fallbackToSeed()
        return
      }
      finish()
    })
    layout.run()
  }

  attempt(false, false)
}

export const CytoscapeGraph = forwardRef<CytoscapeGraphHandle, Props>(function CytoscapeGraph(
  { graph, cacheKey, lens, masteryByTerm, clusterByTerm, redZoneOnly, selectedId, onSelect, reduced },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const destroyedRef = useRef(false)
  const currentLayoutRef = useRef<Layouts | null>(null)
  const builtNodeIdsRef = useRef<Set<string>>(new Set())
  const isMobile = useIsMobile()
  const [ready, setReady] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ term: string; zone: 'red' | 'likely'; x: number; y: number } | null>(null)

  function runFullInit() {
    const cy = cyRef.current
    if (!cy) return
    destroyedRef.current = false
    setReady(false)
    const nodeIds = graph.nodes.map((n) => n.id)
    runStrictInit({
      cy,
      nodeIds,
      clusterByTerm,
      seedKey: cacheKey,
      cacheKey,
      destroyedRef,
      currentLayoutRef,
      onSettled: () => setReady(true),
    })
  }

  useImperativeHandle(ref, () => ({
    panToNode: (id: string) => {
      const cy = cyRef.current
      if (!cy) return
      const node = cy.getElementById(id)
      if (node.empty()) return
      panAndZoomToNode(cy, node, reduced)
    },
    zoomBy: (delta: number) => {
      const cy = cyRef.current
      if (!cy) return
      const level = Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() + delta))
      cy.zoom({ level, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
    },
    fit: () => { cyRef.current?.fit(undefined, 40) },
    reset: () => {
      setHoveredId(null)
      setTooltip(null)
      cyRef.current?.fit(undefined, 40)
    },
    resetLayout: () => {
      clearCachedLayout(cacheKey)
      currentLayoutRef.current?.stop()
      runFullInit()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [reduced, cacheKey, clusterByTerm])

  // ── Lifecycle: create, wait for real size, lay out, validate, destroy ───
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    destroyedRef.current = false
    const colors = readThemeColors()
    const nodeIds = graph.nodes.map((n) => n.id)
    const fields = computeNodeFields(graph, clusterByTerm)

    const cached = getCachedLayout(cacheKey)
    const cacheIsValid = !!cached && nodeIds.every((id) => id in cached) && !isDegenerateLayout(
      Object.fromEntries(nodeIds.map((id) => [id, cached[id]])),
    )
    const seeded = cacheIsValid ? undefined : seedPositions(nodeIds, clusterByTerm, cacheKey)

    const elements: ElementDefinition[] = [
      ...graph.nodes.map((n) => nodeElement(n, fields.get(n.id)!, cacheIsValid ? cached![n.id] : seeded![n.id])),
      ...edgeElements(graph.edges),
    ]

    const cy = cytoscape({
      container,
      elements,
      style: buildStylesheet(colors, lens, masteryByTerm),
      wheelSensitivity: 0.15,
      // Cytoscape defaults to running a 'grid' layout at construction when no
      // `layout` option is given — which silently overrides every element's
      // explicit `position` (confirmed via node_modules/cytoscape/dist/
      // cytoscape.cjs.js: `options.layout = extend({name: head?'grid':'null'},
      // options.layout)`). 'preset' means "use exactly the positions given,
      // run nothing automatically" — required for the seeded/cached positions
      // above to actually take effect.
      layout: { name: 'preset' },
    })
    cyRef.current = cy
    builtNodeIdsRef.current = new Set(nodeIds)

    const disconnectResize = waitForNonZeroSize(container, () => {
      if (destroyedRef.current) return
      cy.resize()
      if (cacheIsValid) {
        cy.fit(undefined, 40)
        applyZoomRange(cy)
        setReady(true)
      } else {
        runStrictInit({
          cy,
          nodeIds,
          clusterByTerm,
          seedKey: cacheKey,
          cacheKey,
          destroyedRef,
          currentLayoutRef,
          onSettled: () => setReady(true),
        })
      }
    })

    cy.on('tap', 'node', (evt) => onSelect(evt.target.id()))
    cy.on('tap', (evt) => { if (evt.target === cy) onSelect(null) })
    cy.on('dbltap', 'node', (evt) => panAndZoomToNode(cy, evt.target, reduced))
    cy.on('mouseover', 'node', (evt) => {
      const n = evt.target as NodeSingular
      setHoveredId(n.id())
      setTooltip({ term: n.data('label') as string, zone: n.data('zone') as 'red' | 'likely', x: evt.renderedPosition.x, y: evt.renderedPosition.y })
    })
    cy.on('mouseout', 'node', () => { setHoveredId(null); setTooltip(null) })

    return () => {
      destroyedRef.current = true
      disconnectResize()
      currentLayoutRef.current?.stop()
      currentLayoutRef.current = null
      cy.destroy()
      cyRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]) // session/keyword-set identity only — a full rebuild. Late data
  // (embeddings, node-set growth) is handled incrementally below, never here.

  // ── Late data: incremental patch, never a full rebuild or re-layout of
  // existing nodes. Runs on every graph change, but is a no-op unless the
  // node set actually grew (edge weights refining via embeddings, or
  // existing-node data like score/cluster changing, don't move anything). ──
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    const fields = computeNodeFields(graph, clusterByTerm)
    const currentIds = new Set(graph.nodes.map((n) => n.id))
    const newIds = graph.nodes.map((n) => n.id).filter((id) => !builtNodeIdsRef.current.has(id))
    const removedIds = [...builtNodeIdsRef.current].filter((id) => !currentIds.has(id))

    // Refresh data (score/cluster/label eligibility) on nodes that already existed.
    cy.nodes().forEach((n) => {
      const f = fields.get(n.id())
      if (f) n.data({ percentile: f.percentile, clusterIndex: f.clusterIndex, topLabel: f.topLabel })
    })

    // Edges carry no position state of their own — cheapest to refresh wholesale.
    cy.edges().remove()
    cy.add(edgeElements(graph.edges))

    for (const id of removedIds) cy.getElementById(id).remove()

    if (newIds.length > 0) {
      const existing = cy.nodes().filter((n) => !newIds.includes(n.id()))
      existing.lock()
      const seeded = seedPositions([...currentIds], clusterByTerm, cacheKey)
      cy.add(newIds.map((id) => {
        const n = graph.nodes.find((gn) => gn.id === id)!
        return nodeElement(n, fields.get(id)!, seeded[id])
      }))
      const layout = cy.layout({
        name: 'fcose',
        animate: false,
        randomize: false,
        quality: 'proof',
        nodeRepulsion: tunedNodeRepulsion(currentIds.size),
        idealEdgeLength: tunedIdealEdgeLength(currentIds.size),
      } as LayoutOptions)
      currentLayoutRef.current = layout
      layout.one('layoutstop', () => {
        if (destroyedRef.current) return
        existing.unlock()
        const positions = currentPositions(cy)
        if (!isDegenerateLayout(positions)) setCachedLayout(cacheKey, positions)
      })
      layout.run()
    }

    builtNodeIdsRef.current = currentIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  // ── Lens / mastery / cluster / Red-Zone-only restyle — classes and style only, no layout ──
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    const colors = readThemeColors()
    cy.style(buildStylesheet(colors, lens, masteryByTerm))
    cy.nodes().forEach((n) => {
      const hidden = redZoneOnly && n.data('zone') !== 'red'
      n.toggleClass('filtered-out', hidden)
    })
    cy.edges().forEach((e) => {
      const hidden = redZoneOnly && (e.source().data('zone') !== 'red' || e.target().data('zone') !== 'red')
      e.toggleClass('filtered-out', hidden)
    })
  }, [lens, masteryByTerm, redZoneOnly])

  // No live theme-change effect: (workspace)/layout.tsx never mounts ThemeProvider
  // or AppShell (the component that actually sets data-theme), so this route always
  // renders the base :root tokens regardless of the user's chosen preset — the same
  // pre-existing limitation every other still-literal-hex file in the Session
  // Workspace has (the deferred Tier 2 retrofit). The one-time getComputedStyle
  // read in the lifecycle effect above is already correct for that reality; there
  // is no live value this effect could ever react to in this route.

  // ── Hover/selection focus: dim everything outside the active neighborhood ──
  // Hover takes precedence while active; moving off falls back to the current
  // click-selection (or clears, if nothing is selected).
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    applyFocus(cy, hoveredId ?? selectedId)
  }, [hoveredId, selectedId])

  // ── Click-selection only: border ring + pan-into-view when the drawer would occlude it ──
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().removeClass('selected')
    if (!selectedId) return
    const node = cy.getElementById(selectedId)
    if (node.empty()) return
    node.addClass('selected')

    const box = node.renderedBoundingBox()
    const width = cy.width()
    const height = cy.height()
    const rect = drawerOcclusionRect(width, height, isMobile)
    const margin = 24
    const occluded = box.x2 > rect.left && box.x1 < rect.right && box.y2 > rect.top && box.y1 < rect.bottom
    if (!occluded) return
    const delta = isMobile
      ? { x: 0, y: rect.top - box.y2 - margin }
      : { x: rect.left - box.x2 - margin, y: 0 }
    cy.panBy(delta)
  }, [selectedId, isMobile])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--color-bg-base)' }}>
      <div
        style={{
          width: '100%', height: '100%',
          opacity: ready ? 1 : 0,
          transition: reduced ? 'none' : 'opacity 300ms ease-out',
        }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>Laying out map…</span>
        </div>
      )}
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(ellipse at center, transparent 0%, transparent 60%, color-mix(in srgb, var(--color-bg-base) 40%, black) 100%)',
        }}
      />
      {tooltip && (
        <div
          style={{
            position: 'absolute', left: tooltip.x + 14, top: tooltip.y + 10, pointerEvents: 'none', zIndex: 5,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 9px', background: 'var(--color-bg-overlay)', border: '1px solid var(--color-border-default)',
            fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-primary)', whiteSpace: 'nowrap',
          }}
        >
          {tooltip.term}
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '1px 5px',
            color: tooltip.zone === 'red' ? 'var(--color-severity)' : 'var(--color-text-secondary)',
            border: `1px solid ${tooltip.zone === 'red' ? 'color-mix(in srgb, var(--color-severity) 45%, transparent)' : 'var(--color-border-strong)'}`,
          }}>
            {tooltip.zone === 'red' ? 'Red Zone' : 'Likely'}
          </span>
        </div>
      )}
    </div>
  )
})
