## Status

| Sub-feature | Status |
|---|---|
| Flashcard generation from scored keywords (transcript sentence extraction) | Done |
| Flashcard back enhancement via Claude (`/api/generate/flashcards`) | Done |
| Flashcard panel UI (flip + SM-2 rating buttons) | Done |
| SRS queue (due-today filter at session load) | Done |
| SM-2 algorithm (`computeNextReview`) | Done |
| `flashcard_reviews` insert (fire-and-forget) | Done |
| Progress bar across due queue | Done |
| "All caught up / Session complete" end states | Done |
| Anki `.apkg` export (sql.js + JSZip) | Done |
| Zone coloring on card face (red / likely) | Done |
| Anki import (read `.apkg`, extract card fronts) | Done |
| Community deck import to vault (as flashcards session) | Done |
| Keyword-side-panel flashcard preview | Done (component exists, panel not wired) |
| `zone: null` in community deck import | Needs verification |

## What Exists

- `nocturne/src/lib/scoring/flashcard-generator.ts` — `generateFlashcards()`: groups transcript words into sentences (by punctuation or >800 ms gap), picks the longest sentence containing each keyword as the back, falls back to slide references or source label
- `nocturne/src/lib/scoring/flashcard-enhancer.ts` — `enhanceFlashcards()`: sends keyword + transcript/slide context snippets to `/api/generate/flashcards`; on success re-encrypts and upserts enhanced backs to DB; runs non-blocking after initial save
- `nocturne/src/app/api/generate/flashcards/route.ts` — server route: batch-enhances card backs using Claude; returns `{ results: [{term, back}] }`
- `nocturne/src/lib/scoring/srs.ts` — `computeNextReview(rating, easeFactor, intervalDays)`: SM-2 variant producing `{ easeFactor, intervalDays, dueAt }`; ratings: again / hard / good / easy
- `nocturne/src/components/study-guide/flashcard-panel.tsx` — full study tab UI: loads due cards from `flashcard_reviews`, builds due-today queue, flip interaction, 4-button rating row, progress bar, Anki export button
- `nocturne/src/lib/study-guide/anki-export.ts` — `generateApkg()`: creates a valid Anki `.apkg` using sql.js (in-browser SQLite) and JSZip; tags cards with `red-zone` or `likely-zone`
- `nocturne/src/lib/study-guide/anki-import.ts` — parses `.apkg` file, extracts card fronts from the `notes` table
- `nocturne/src/lib/study-guide/synthetic.ts` — synthetic keyword generation (TF-IDF path, pre-LLM era; may be unused now)
- `nocturne/supabase/migrations/006_create_flashcards.sql` — `flashcards` table: `front_encrypted`, `back_encrypted`, `slide_index`, `zone` (`'red'|'likely'`)
- `nocturne/supabase/migrations/010_create_flashcard_reviews.sql` — `flashcard_reviews` table: `rating`, `ease_factor`, `interval_days`, `due_at`; DB trigger accrues 2 momentum points per review

## What's Missing

- **`zone: null` in community deck import** — `CommunityClient.handleAddToVault()` inserts flashcards with `zone: null`, but the DB constraint requires `zone IN ('red', 'likely')`. This will cause an insert error when a user tries to add a community deck to their vault. The fix is to default `zone` to `'likely'` for imported community cards.
- **No cross-session flashcard review** — the FlashcardPanel only shows cards from the current session. There is no consolidated review queue across all sessions (e.g., for daily SRS review across the whole vault).
- **Enhancement is fire-and-forget with no retry** — if `/api/generate/flashcards` fails silently, the enhanced backs are never stored. The user sees original sentence-extraction backs with no indication that enhancement failed.
- **`synthetic.ts` usage is unclear** — the file exists but `keyword-scorer.ts` and `SessionClient` only reference the LLM extraction path. It may be dead code from a prior TF-IDF era.

## Recent Decisions

_(none in this session — see study-tab.md and paywall-tiers.md for the SM-2 scoring and tier gating work)_

## Tier

- Flashcard panel (study tab, SRS review): **Midnight** — gated by `TAB_GATES.study = 'midnight'` in `SessionClient`; tab button shows lock icon for Dusk/Eclipse users.
- AI back enhancement (`/api/generate/flashcards`): **Midnight** — route returns 403 `tier_required` if `!hasAccess(userTier, 'midnight')`.
- Anki export / import, zone coloring, community deck import: **Midnight** (accessed only from within the study tab, which is already gated).
- Flashcard generation itself (sentence extraction, `flashcard-generator.ts`): runs whenever the score phase runs; the results are stored at Dusk but cannot be reviewed until Midnight is unlocked.
