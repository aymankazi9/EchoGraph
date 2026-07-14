# Wiring, Routing & Functionality

The redesign must land **without interrupting the workflow**. Below is the route map, navigation
graph, and the functional hookups each page needs.

## Route map (page → Next route → existing status)
| Page | Route | Status |
|---|---|---|
| Landing | `src/app/page.tsx` `(marketing)` | exists, partially built |
| Login / Sign in | `src/app/login/page.tsx`; unlock `(vault)/unlock` | exists |
| Sign Up / vault setup | `src/app/(vault)/setup` | exists |
| Legal (privacy/terms/cookies/security) | `(marketing)/{privacy,terms,cookies,security}` | exist |
| Help Center | `(marketing)/help` | exists |
| 404 | `(app)/not-found.tsx` + root + `(marketing)` not-found | exist |
| 500 | `error.tsx` in `(app)` & `(marketing)` | exist |
| Vault Dashboard | `(app)/vault` | exists |
| Session Workspace | `(workspace)/session/[id]` | exists |
| **Momentum** | **`(app)/momentum`** | **NEW** |
| **Community** | **`(app)/community`** | **NEW** |

> Heed `AGENTS.md`: this is Next.js 16 with breaking changes from training data — read
> `node_modules/next/dist/docs/` before touching routing/params/error conventions.

## Navigation graph
- **Sidebar** (app shell): Vault · Momentum · Community · New session · Help · Billing · Settings.
- **Vault → Session:** session card → `/session/[id]`.
- **Vault → Momentum:** ambient ribbon → `/momentum`.
- **Momentum → Community:** Course Circle "Open the full course room" → `/community`.
- **Session ↔ Vault:** top-bar breadcrumb back to `/vault`.
- **Marketing → auth:** nav "Sign in" → `/login`, "Get started" → `/setup`.
- **Errors:** 404 → `/vault` + `/help`; 500 → `reset()` + `/help`.
- **Legal/Help top nav:** Home → `/`, cross-links between Legal & Help.

## Functional hookups (don't break these)
- **Auth + vault unlock:** `src/lib/crypto/*` (vault.ts, encrypt/decrypt, recovery, worker),
  `src/lib/supabase*.ts`, `middleware.ts`. Sign Up derives the key (PBKDF2 → Master Key) and
  generates the Recovery Kit; Login unlocks. No password reset — preserve that contract.
- **Storage:** Dexie (`src/lib/db/dexie.ts`) local cache; Supabase Storage for encrypted blobs;
  `schema.sql` + `supabase/migrations`. Storage indicator reads real usage.
- **Ingestion → session:** `ffmpeg`, `pdfjs-dist`, workers (`ffmpeg/whisper/encrypt/silence`).
- **Transcription/sync:** `src/lib/sync/{playhead-tracker,sync-engine,silence-detector}.ts`,
  `bert-scorer`; the timeline spine binds to these.
- **Scoring:** `src/lib/scoring/{keyword-scorer,flashcard-generator}.ts` produce Red Zone
  keywords + flashcards (drive Study mode + mastery rings).
- **Study guide:** `src/lib/study-guide/{parser,synthetic,anki-export,anki-import}.ts`.
- **State stores:** `src/store/` (zustand) — extend, don't replace.

## New backend for NEW features
- **Momentum** is local-first: compute streak/heatmap/mastery from existing session + scoring
  data on-device. Momentum balance needs a small accrual+ledger (define rule; can be local or a
  Supabase table). Redeem items map to real entitlements (transcription priority, ASR tier, Pro
  days) — gate via the billing/entitlement layer.
- **Community** needs server aggregation: a `course_rooms` model + **counts-only** keyword pooling
  (never raw content), `.edu` domain room verification, thread storage with moderation
  (report/mute), anonymized membership. Treat as pre-launch requirements; ship Momentum first.

## Rollout suggestion (non-breaking)
1. Adopt the `globals.css` token changes (`DESIGN_SYSTEM.md` §0) — restyles everything at once.
2. Reconcile existing pages (landing, vault, session, auth, legal, help, errors) component-by-
   component against mocks behind the current routes.
3. Add the sidebar Momentum/Community items + the Vault ambient ribbon.
4. Build `/momentum` (local-first) — shippable without new infra.
5. Build `/community` last, with the backend + safety work.
