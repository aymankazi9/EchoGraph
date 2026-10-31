## Status

| Sub-feature | Status |
|---|---|
| `buildGraph` pure graph-model function (nodes/edges, weighted blend, pruning) | Done |
| `buildGraphMemoized` scheduling + cache wrapper | Done |
| Map tab registration (Tab union, TAB_GATES, nav, LockedFeature gate) | Done |
| Cytoscape canvas (lifecycle, theming, layout cache, click/select/dim) | Done |
| Node detail drawer (bottom sheet mobile / side drawer desktop) | Done |
| Search autocomplete with pan+zoom | Done |
| Red Zone only filter (dim, not remove) | Done |
| Importance / Mastery lens toggle | Done |
| List-view accessible alternative | Done |
| Embeddings signal (`EMBED` worker message, gated off Whisper/sync) | Done |
| Loading / not-scored / enhancing / too-few-terms / error states | Done |
| `prefers-reduced-motion` handling | Done |
| Edge persistence | Not Started — intentionally, see Recent Decisions |

## What Exists

- `nocturne/src/lib/graph/buildGraph.ts` — pure, synchronous graph builder. Blends slide Jaccard, transcript co-occurrence, and embedding cosine (each renormalized per-pair over whichever signals are actually available); prunes below a weight threshold, caps each node at its top 4 remaining edges (union across both endpoints, not intersection), then rescues any node left isolated with its single strongest edge regardless of threshold. `buildGraphMemoized(sessionId, input)` schedules the computation via `requestIdleCallback` (falls back to `setTimeout`) and memoizes by `sessionId:hash(keywords)` — transcript/embeddings are intentionally excluded from the cache key.
- `nocturne/src/lib/graph/buildGraph.test.ts` — fixtures for slides-only, audio (transcript co-occurrence), and fewer-than-5-term sessions, plus dedicated pruning/embedding tests.
- `nocturne/src/lib/graph/embed-terms.ts` — spins up `bert.worker.ts`'s new `EMBED` message to get raw per-term vectors (mirrors `bert-scorer.ts`'s existing worker-wrapping pattern). Caller-gated to never run while Whisper/sync/live-recording are active (`CONTEXT.md` §10 rule 10) — the gate lives in `map-tab.tsx`, not the worker itself.
- `nocturne/src/lib/graph/layout-cache.ts` — in-memory Cytoscape node-position cache, keyed the same way as `buildGraphMemoized`, so fcose only ever runs once per `(sessionId, keyword-hash)` and every later mount/filter/select/embeddings-enrichment reuses the same positions via a `preset` layout.
- `nocturne/src/lib/use-media-query.ts` — net-new `useMediaQuery`/`useIsMobile` hook (no prior breakpoint-detection convention existed in this codebase). Built on `useSyncExternalStore`, not an effect + setState.
- `nocturne/src/components/map/map-tab.tsx` — tab body. Reads keywords/flashcards/transcriptWords/review-intervals from the store only (no fetch of its own); builds the graph in two passes (instant base pass, then an embeddings-enriched pass once ready); owns lens/filter/search/selection state; renders all the loading/empty/error states.
- `nocturne/src/components/map/cytoscape-graph.tsx` — the actual Cytoscape wrapper, dynamically imported with `ssr:false`. One lifecycle effect creates the instance, wires every event handler, and runs (or restores cached) layout, all before returning its own `destroy()` cleanup — no module-level singleton, so Strict Mode's dev double-mount is harmless. Separate effects restyle on lens/mastery/filter/theme change without touching layout or positions.
- `nocturne/src/components/map/node-drawer.tsx` — built on Radix's raw `Dialog` primitive directly (no Sheet/Drawer primitive existed anywhere in this codebase before this). Detects `flashcard-generator.ts`'s two non-enhanced fallback templates (`"Covered on slide…"`, `"Term from study guide: …"`) by exact prefix and shows "Go to slide N" instead of rendering the template as a real definition.
- `nocturne/src/components/map/map-search.tsx`, `map-list-view.tsx` — autocomplete (mirrors `session-search-bar.tsx`'s dropdown pattern) and the keyboard-navigable accessibility alternative to the canvas.
- `nocturne/src/lib/workers/bert.worker.ts` — gained a second message type, `EMBED`, alongside the existing `SCORE`, reusing the same `getExtractor()` singleton.
- `nocturne/src/store/session-store.ts` — gained `reviewIntervalsByFlashcardId` + `loadReviewIntervals`, populated by `flashcard-panel.tsx`'s existing review query (no new network call) so the Mastery lens has data without the Map tab fetching anything itself.

## What's Missing

- **Edges are not persisted** — recomputed client-side every load. Deliberate v1 scope, not a gap to close reflexively; revisit only if recomputation cost becomes a real problem.
- **Mastery lens before any Study visit** — if the user opens Map before ever opening Study this session, every card reads as "new" (the review-interval store field is still empty). Resolves itself once Study has been visited once.
- **No real-device verification yet** — the bottom-sheet-vs-side-drawer breakpoint, `prefers-reduced-motion` behavior, and the dynamic-import + `forwardRef` combination (`next/dynamic` wrapping a `forwardRef` component) should be spot-checked in an actual browser; type-checking alone can't confirm runtime ref-forwarding behavior.

## Recent Decisions

- 2026-10-30: Likely Zone renders amber (`--color-graph-likely-zone`) on the map specifically, diverging from the gray `THEME_SURGICAL.md` §1.5 uses everywhere else for Likely Zone. Scoped to this one feature via a dedicated token — not a reversal of the broader Surgical semantic remapping.
- 2026-10-30: Mastery-lens colors reuse the exact 3-shade grayscale already established for per-card mastery bars in `flashcard-panel.tsx` (`new`→`--color-text-disabled`, `learning`→`--color-text-secondary`, `mastered`→`--color-text-primary`) rather than introducing a new hue scheme — brightness-as-memory-strength was already the existing convention.
- 2026-10-30: Click-to-select never recenters the viewport (dims everything outside the tapped node's closed neighborhood in place); search-to-node *does* pan+zoom. These are deliberately different interactions, not an inconsistency — search exists specifically to reach a node you can't already see.

## Tier

- Map tab: **Midnight** (same gate as Study/Notes)
