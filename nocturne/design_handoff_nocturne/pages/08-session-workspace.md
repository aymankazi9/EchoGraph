# Session Workspace

- **Design reference:** `reference/source/Session Workspace.dc.html`
- **Target route:** `src/app/(workspace)/session/` + `src/components/{session,transcript,study-guide,pdf,audio}/*`
- **Status:** Route + most components exist. Restyle to match the mock; wire the four modes to the
  real engines in `src/lib/{sync,scoring,study-guide}`.

## Purpose
The core study surface for one lecture: replay synced audio + slides + transcript, drill Red Zone
flashcards, read the study guide, and ask the lecture questions. Full-height app (no page scroll;
internal panels scroll).

## Top bar (54px, `bg-rail`, bottom hairline)
Breadcrumb (← back to vault · session title — `session-title.tsx`) · transcript/keyword search
(208px) · **mode tabs**: **Lecture · Study · Notes · Ask** (`tab` state) · export/actions.

## Mode 1 — LECTURE (`isLecture`, default)
Slide viewer (PDF.js via `pdf-viewer.tsx`, `slide-nav-strip.tsx`, `page-controls.tsx`) over a
**unified timeline spine** (`bg:#0A0A0F`, top hairline) that locks audio + transcript + slides:
- Ribbon toggle: **Transcript** | **Red Zone density** (`ribbon` state).
- Transcript ribbon: live transcript tokens; Red Zone terms highlighted
  (`color:#FDA4AF; bg:rgba(251,113,133,0.12); rounded:4px`).
- Density ribbon: Red Zone heat across the lecture.
- Scrub bar with slide **ticks**, an indigo **fill** (`linear-gradient(90deg,#6366F1,#818CF8)`,
  5px) and a **playhead** dot (13px, `#A5B4FC`, 4px halo). Audio via `audio-player.tsx` +
  `seek-bar.tsx`; sync via `src/lib/sync/{playhead-tracker,sync-engine}.ts`.
- Current-slide **zone chip**: Red Zone (rose) / Likely Zone (amber) / none.
- Caption: "Scrub the timeline or pick a slide — audio, transcript and slides stay locked together."

## Mode 2 — STUDY (`isStudy`) — "night-before-the-exam mode"
Header: "Red Zone focus — N of M Red Zone keywords mastered" + overall progress.
- Left: filter rail — **All · Red Zone · Likely · Needs work** (`studyFilter`, with counts).
- Center: **flashcard drill** (`flashcard-panel.tsx`) — "Flashcard X / N", zone chip, flip
  interaction, **SM-2 rating buttons**: Again / Hard / Good / Easy
  (`244,63,94` / `251,191,36` / `99,102,241` / `45,212,191`). Cards from
  `src/lib/scoring/flashcard-generator.ts`; export (Anki) via `src/lib/study-guide/anki-export.ts`.

## Mode 3 — NOTES (`isNotes`) — Study guide
`h2` "Study guide" — auto-generated sections (`guideCount`) from slides + transcript. Each section:
number, title, Red Zone tag, "jump to slide" link (`onJump` → Lecture mode at that slide). A note
draft area pinned to a slide. Built by `src/lib/study-guide/parser.ts` / `synthetic.ts`.

## Mode 4 — ASK (`isAsk`) — grounded Q&A
"Ask this lecture anything" — answers grounded in this lecture's transcript/slides, **every claim
cites the slide** (`cites[]`). Suggestion chips (`askSuggestions`). Answers from a local
retrieval bank (`askBank` in the mock); in code, ground against the decrypted transcript.

## Tokens
Dense app surfaces; rose Red Zone (`#FDA4AF` text on `rgba(251,113,133,…)`), amber Likely Zone,
indigo timeline. Buttons `rounded-md` 8–9px.
