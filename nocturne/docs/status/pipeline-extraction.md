## Status

| Sub-feature | Status |
|---|---|
| PDF slide text extraction (client-side pdfjs) | Done |
| Slide text encryption + upsert to `slides` table | Done |
| Multi-file global slide indexing (`global_slide_index`) | Done |
| Audio transcription via Whisper (in-browser worker) | Done |
| Live transcription (mic → Whisper chunks) | Done |
| ffmpeg decode worker (audio pre-processing) | Done |
| Silence detection worker | Done |
| Silence threshold setting (user-configurable, settings page) | Done |
| Keyword extraction LLM (`/api/extract/keywords`) | Done |
| Source tagging: `guide` / `inferred` / `both` in LLM prompt | Done |
| `keywords.source` constraint widened to include `'both'` | Done |
| `+0.1` confidence bonus for `source === 'both'` | Done |
| Keyword scoring algorithm (mention, dwell, emphasis, lecture_confidence) | Done |
| Slide density computation + `is_red_zone` upsert | Done |
| Chunked extraction for very long sessions (>100 k words) | Done |
| Sync-map computation via `startSync` (BERT slide–transcript alignment) | Done — called from `handleAnalyze` and auto-triggered on recording stop |
| Automatic re-scoring after slide extraction (`handleSlidesExtracted`) | Done |
| Transcript word storage (`transcript_words` table, encrypted) | Done |
| `files.source` column (`'upload' \| 'recording'`) | Done — migration 029 |
| RLS on `transcript_words` for recording-source rows | Done — migration 029 |
| Study guide parser (text + Anki .apkg) | Done |
| Synthetic keyword path (no guide → LLM infers from lecture only) | Done |
| USMLE high-yield corpus (`usmle-highyield.json`) | Exists, not yet wired into scorer |

## What Exists

- `nocturne/src/app/api/extract/keywords/route.ts` — authenticated POST; builds prompt with guide/slides/transcript; calls `claude-haiku-4-5-20251001`; supports single-pass and chunked (>100 k words) modes; returns `{ keywords: [{term, source}] }`; source values: `'guide'`, `'inferred'`, `'both'`.
- `nocturne/src/lib/scoring/keyword-scorer.ts` — pure scorer: `scoreKeywords()` computes mentionCount, dwellTimeMs (from syncMap), emphasisScore, lectureConfidence; applies +0.1 bonus for `source === 'both'`; assigns zone; `computeSlideDensity()` returns per-slide density.
- `nocturne/src/lib/workers/whisper.worker.ts` — `@xenova/transformers` Whisper model in a Web Worker; word-level timestamped output.
- `nocturne/src/lib/workers/ffmpeg.worker.ts` — decodes audio via ffmpeg.wasm.
- `nocturne/src/lib/workers/silence.worker.ts` — silence boundary detection.
- `nocturne/src/lib/workers/bert.worker.ts` — BERT-based semantic similarity for sync engine.
- `nocturne/src/lib/live-transcription.ts` — mic capture → ffmpeg → Whisper pipeline.
- `nocturne/src/lib/sync/sync-engine.ts` — `startSync()` drives slide–transcript alignment; called by `handleAnalyze` in SessionClient and auto-triggered on live recording stop.
- `nocturne/src/lib/sync/bert-scorer.ts` — BERT cosine-similarity scoring.
- `nocturne/src/lib/sync/playhead-tracker.ts` — maps audio time → current slide via SyncSegment list.
- `nocturne/supabase/migrations/029_recording_source_and_rls.sql` — adds `files.source` column (`'upload' | 'recording'`); restrictive RLS on `transcript_words` requiring Midnight tier for recording-source rows.

## What's Missing

- **Per-word `slide_index` before sync** — `transcript_words.slide_index` is null until sync runs. Playhead tracking works off the `sync_map` blob, not per-word indices.
- **`usmle-highyield.json` is not wired into the scorer** — exists in `src/lib/corpus/` but `keyword-scorer.ts` does not import it. Likely dead code from a prior era.
- **No server-side Whisper route** — transcription is entirely client-side (in-browser wasm). No fallback for low-memory browsers.
- **Chunked extraction dedup uses Claude as a merge pass** — if the Claude merge call fails (network error), falls through to string-level dedup only.

## Recent Decisions

- 2026-09-xx: `files.source` column added (migration 029); RLS on `transcript_words` uses `IS DISTINCT FROM 'recording'` (NULL-safe for live-recording window before files row is committed).
- 2026-09-09: Silence threshold slider re-gated on `hasAccess(tier, 'midnight')` from `subscriptions.tier`. Was previously gated on `users.tier === 'pro'` which was always false.
- 2026-07-24: `keywords.source` constraint widened; `source === 'both'` gets +0.1 confidence.
- 2026-07-24: `/api/extract/keywords/route.ts` created; uses `claude-haiku-4-5-20251001`.

## Tier

- Core pipeline (PDF extraction, browser Whisper, keyword scoring, Red Zone, heatmap): **Dusk**
- Live recording: **Midnight**
- Silence threshold customization: **Midnight**
- Server ASR + diarization: **Midnight** (not yet built)
