## Status

| Sub-feature | Status |
|---|---|
| Momentum ribbon on vault dashboard | Done |
| Streak calculation (current + best, client-side from `user_activity`) | Done |
| 7-day dot strip (this week's study days) | Done |
| Activity heatmap (17-week GitHub-style grid) | Done |
| Momentum points balance (from `users.momentum_points`) | Done |
| Momentum wallet redeem items UI | Done |
| `redeem_momentum()` DB function call | Done |
| Weekly earnings display | Done |
| Course mastery donut charts per `course_tag` | Done |
| Milestone definitions (5 seeded in DB) | Done |
| Milestone progress display + earned state | Done |
| Course circle panel (opt-in toggle, cohort teaser) | Done (UI only) |
| `upsert_user_activity` called on first audio play per session per day | Done |
| DB trigger: +10 pts per active day, +25 pts per session | Done |
| DB trigger: +2 pts per flashcard review | Done |
| DB trigger: milestone check after each activity / review event | Done |
| `/app/momentum/` page | Done |
| Course circle backend integration | Not Started |
| Streak freeze / protection | Not Started |
| Points history / ledger view | Not Started |

## What Exists

- `nocturne/src/app/(app)/momentum/MomentumClient.tsx` — full Momentum page: streak hero band, 7-day dot strip, activity heatmap, momentum wallet with redeem items (calls `redeem_momentum` RPC), mastery by subject (per `course_tag`), milestones panel, course circle opt-in panel
- `nocturne/src/app/(app)/momentum/page.tsx` — server component wrapper; passes `userId` to MomentumClient
- `nocturne/src/components/dashboard/momentum-ribbon.tsx` — compact ribbon on vault dashboard: flame chip, streak count + best, 7-day dots, top course mastery %, balance chip; links to `/momentum`
- `nocturne/supabase/migrations/013_momentum_tracking.sql` — `user_activity` (one row per user per date), `momentum_ledger` (append-only audit log), `accrue_momentum()`, `redeem_momentum()`, `upsert_user_activity()`, triggers on `flashcard_reviews` INSERT and `user_activity` INSERT/UPDATE
- `nocturne/supabase/migrations/014_create_user_milestones.sql` — `milestone_definitions` (5 seeded: streak_14, subject_mastered, sessions_25, cards_500, subjects_3), `user_milestones`, `check_and_award_milestones()`, trigger on `sessions` INSERT

## What's Missing

- **Course circle is entirely stubbed** — The course circle panel in MomentumClient renders hardcoded data ("14 classmates reviewing for Midterm 2", "47 predicted keywords"). The opt-in toggle writes to localStorage only (`nocturne-cohort`). There is no backend query that fetches real cohort data or links to the community keyword pool. This section is a design placeholder.
- **Redeem items are cosmetic** — "Priority transcription", "9B ASR boost", and "1 week of Pro" appear as redeemable items with costs (400, 650, 1000 pts). The `redeem_momentum` RPC deducts points, but no actual feature is unlocked on success. The effect of redemption is tracked only in local `redeemed[]` state and does not persist across sessions.
- **No momentum ledger view** — `momentum_ledger` records all point events, but there is no UI to browse or audit them. The user can only see the current balance and "earned this week" total.
- **Course mastery calculation is N+1 queries** — for each `course_tag`, MomentumClient fires two separate Supabase queries (flashcards, then flashcard_reviews). This will become slow as the number of courses grows.

## Recent Decisions

- 2026-09-22: Midnight tier gate added. `MomentumClient` now accepts `userTier: Tier` prop (fetched by `page.tsx` via `getUserTier`). When `!hasAccess(userTier, 'midnight')`, the component returns a `LockedFeature` panel instead of rendering the momentum dashboard.

## Tier

**Midnight** — the entire `/momentum` page is gated. Dusk and Eclipse users see a `LockedFeature` upsell panel ("Momentum — available on Midnight").
