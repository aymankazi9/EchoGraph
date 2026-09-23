## Status

| Sub-feature | Status |
|---|---|
| PDF viewer (decrypt + render + page navigation) | Done |
| Slide nav strip (outline rail with thumbnails) | Done |
| Multi-file PDF support (global slide index, file boundaries in strip) | Done |
| Audio player (headless decrypt + store integration) | Done |
| Multi-take audio (multiple audio files per session) | Done |
| Transcript ribbon (inline keyword-highlighted tokens) | Done |
| Density ribbon (per-slide bar chart in timeline) | Done |
| Scrubber / seek bar with slide tick marks | Done |
| Live recording (mic → Whisper → stream words) | Done |
| Record Live tier gate (checked at start of recording, before mic access) | Done |
| Auto-sync on recording completion | Done |
| "Analyze slides" manual sync trigger (handleAnalyze → startSync) | Done |
| Red Zone / Likely Zone chip on current slide | Done |
| Study guide upload (GuideUpload with text/Anki paths) | Done |
| Session title (editable inline) | Done |
| Course tag picker | Done |
| Keyboard shortcuts (space, arrows, [, ], ?, e, p) | Done |
| Keyboard shortcut overlay (? key) | Done |
| Decryption overlay (vault-locked guard on mount) | Done |
| Domain prompt (field banner, dismissible) | Done |
| Keyword side panel (KeywordSidePanel component) | Needs verification — component exists; wiring in SessionClient unconfirmed |
| Keyword chip row (KeywordChipRow component) | Needs verification — same |
| Export button (top bar) | Not Started |
| Transcript search (top bar input) | Not Started |

## What Exists

- `nocturne/src/app/(workspace)/session/[id]/SessionClient.tsx` — main session orchestrator: 4-tab layout (lecture/study/notes/ask), all data loading, scoring trigger, live recording. Imports and calls `startSync` from sync-engine for both auto-sync on recording stop and manual "Analyze slides" trigger.
- `nocturne/src/app/(workspace)/session/[id]/page.tsx` — server component fetching session row + files.
- `nocturne/src/components/pdf/pdf-viewer.tsx` — decrypts PDF, renders via pdfjs-dist, extracts slide text; all pages have a `global_slide_index` that is session-wide consistent across multiple PDF files.
- `nocturne/src/components/pdf/slide-nav-strip.tsx` — scrollable thumbnail rail; supports multi-file sessions with visual file-boundary dividers; race-condition fix applied (`cancelled` flag in effect scope, try-catch on destroyed `pdfDoc`).
- `nocturne/src/components/audio/audio-player.tsx` — supports multiple audio files per session.
- `nocturne/src/components/session/session-title.tsx` — inline-editable encrypted session title.
- `nocturne/src/components/session/course-tag-picker.tsx` — dropdown to set `sessions.course_tag`.
- `nocturne/src/lib/live-transcription.ts` — orchestrates mic capture + chunked Whisper inference; yields `TranscriptWordEntry` objects streamed to the store.
- `nocturne/src/app/actions/record-live.ts` — `assertCanRecordLive()` server action; tier-checks before mic access is ever requested.

## What's Missing

- **Keyword chip row and side panel** — `keyword-chip-row.tsx` and `keyword-side-panel.tsx` exist but their wiring in SessionClient is unconfirmed. The lecture-tab sidebar that previously hosted them may have been removed in the redesign.
- **Export button** — non-functional stub in top bar.
- **Transcript search** — non-functional stub in top bar.

## Recent Decisions

- 2026-09-xx: Record Live tier gate moved to `handleStartRecording` (before mic/worker). Dusk users are rejected before any audio is captured. Source column `files.source = 'recording'` added; RLS insert policy on `transcript_words` enforces Midnight as defense-in-depth.
- 2026-09-xx: `handleAnalyze` fixed to call `loadSyncMap` and `setLiveSessionStatus('synced')` in the `onComplete` callback, so manually triggered slide analysis populates the sync map.
- 2026-09-xx: `ThumbnailCanvas.useEffect` race condition fixed — `cancelled` flag moved to effect scope; `getPage()` wrapped in try-catch for destroyed-transport case.
- 2026-09-xx: Multi-file PDF and multi-take audio support — `global_slide_index` is session-wide; the nav strip renders file boundary markers.

## Tier

- Core lecture tab (PDF, audio, transcript, Red Zone, scrubber): **Dusk**
- Live recording: **Midnight** (server action `assertCanRecordLive()` checks tier before mic)
- Study tab (flashcard panel): **Midnight**
- Notes tab (Tiptap editor): **Midnight**
- Ask tab (RAG Q&A): **Eclipse**
