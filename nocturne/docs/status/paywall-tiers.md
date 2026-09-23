## Purpose

This file maps every user-facing feature found in the codebase to its tier. Updated 2026-09-22 to reflect actual code state.

## Tiers

| Tier | Label | Description |
|---|---|---|
| **Dusk** | Free | Core lecture capture and Red Zone analysis |
| **Midnight** | Mid | Full study system — flashcards, notes, momentum, community |
| **Eclipse** | Top | AI-powered layer — RAG chat, quiz mode, AI notes, priority processing |

## Feature Map

| Feature | Description | Tier |
|---|---|---|
| Vault creation (passphrase + PBKDF2 + AES-GCM) | Zero-knowledge encrypted vault setup | All |
| Recovery kit download | Offline backup for vault passphrase | All |
| Change passphrase | Re-wrap master key with new passphrase | All |
| Google OAuth sign-in | Sign in via Google account | All |
| Settings → Security section | Change passphrase, re-derive recovery key | All |
| Legal pages (terms, privacy, cookies, security, help) | Legal and informational pages | All |
| Marketing landing page | Public home page with hero, features, pricing, FAQ | All |
| Billing page | View real subscription tier, status, period end; manage via Stripe Customer Portal | All |
| Stripe checkout (disabled in beta) | Create Stripe Checkout Session, 7-day trial | Midnight / Eclipse |
| Stripe Customer Portal (disabled in beta) | Upgrade, downgrade, cancel, update payment method | Midnight / Eclipse |
| Session creation (new session) | Upload audio + PDF and create a session | Dusk |
| Audio upload (pre-recorded) | Upload an existing recording to a session | Dusk |
| Live recording (mic → in-browser Whisper) | Record lecture in real time; tier-gated at mic request | **Midnight** |
| PDF upload (slide deck) | Upload lecture slides for slide extraction | Dusk |
| In-browser Whisper transcription | Client-side audio-to-text using Whisper wasm | Dusk |
| Transcript display (ribbon) | View transcript tokens synchronized with audio playback | Dusk |
| Slide PDF viewer | Render and navigate lecture slides | Dusk |
| Slide nav strip (outline rail) | Thumbnail sidebar for all slides | Dusk |
| Audio scrubber + playhead | Seek audio with slide tick marks | Dusk |
| Slide–transcript sync (syncMap) | Automatic alignment of audio time to slide index | Dusk |
| Keyword extraction (LLM, claude-haiku) | Extract study terms from slides/transcript/guide via AI | Dusk |
| Study guide upload (plain text) | Upload a study guide to seed Red Zone keywords | Dusk |
| Anki .apkg import | Import Anki deck card fronts as keyword seeds | Dusk |
| Red Zone / Likely Zone scoring | Score keywords by lecture emphasis + slide density | Dusk |
| Slide density heatmap (ribbon mode) | Visualize keyword density per slide in the timeline | Dusk |
| Red Zone / Likely Zone chip on slide | Per-slide zone indicator in the viewer | Dusk |
| Keyword side panel | Basic view (mentions, dwell, confidence, slide list) in Dusk; progress/mastery column unlocked at Midnight | Dusk |
| Session title (editable) | Inline-edit the encrypted session title | Dusk |
| Course tag picker | Assign a subject tag to a session | Dusk |
| Keyboard shortcuts | Space/arrows/[]/]/E/P/? hotkeys in the session view | Dusk |
| Flashcard generation (sentence extraction) | Auto-generate flashcards from Red/Likely Zone keywords | Dusk |
| Anki .apkg export | Export session flashcards as a downloadable Anki deck | Dusk |
| Vault dashboard | Session card grid with filter, sort, and search | Dusk |
| Session card grid | Browse all sessions with thumbnail and status | Dusk |
| Vault search | Search across session titles | Dusk |
| Filter chips (by status, course) | Filter sessions in the vault | Dusk |
| Sort control (newest, oldest, title) | Sort sessions in the vault | Dusk |
| Getting started checklist | Onboarding checklist with dismiss and export tracking | Dusk |
| Storage indicator (in sidebar) | Show used vs. total storage in the nav | Dusk |
| Storage settings section | View and manage vault storage | Dusk |
| Account settings | View email, manage account | Dusk |
| Preferences settings (silence threshold) | Configure silence detection threshold | Dusk |
| Delete account | Danger-zone account deletion | Dusk |
| PWA install banner | Prompt to install Nocturne as a progressive web app | Dusk |
| Offline page | Shown when the app is offline | Dusk |
| Flashcard panel (flip + SM-2 rating) | Study flashcards with again/hard/good/easy ratings (Study tab) | Midnight |
| Spaced repetition (SM-2 algorithm) | Due-today queue and next-review scheduling | Midnight |
| Flashcard back enhancement (Claude) | AI-improved flashcard backs via `/api/generate/flashcards` | Midnight |
| Keyword side panel — progress/mastery column | Per-keyword flashcard review progress and due count | Midnight |
| Notes editor (Tiptap WYSIWYG, toolbar, bubble menu, slide-ref chips, keyword highlight, version history) | Rich-text notes per session, AES-GCM encrypted (Notes tab) | Midnight |
| Momentum ribbon (vault dashboard) | Streak + balance summary linking to Momentum page | Midnight |
| Momentum page (streak hero, heatmap, milestones, wallet) | Full Momentum gamification dashboard | Midnight |
| Streak tracking (current + best) | Daily study streak computed from `user_activity` | Midnight |
| Activity heatmap (17 weeks) | GitHub-style contribution grid | Midnight |
| Momentum points (earn on sessions + card reviews) | Point accrual via DB triggers | Midnight |
| Momentum wallet (redeem items) | Spend points on features (UI only; items not yet unlocked) | Midnight |
| Milestone system (5 milestones) | Earn badges for streak, sessions, cards, course mastery | Midnight |
| Course mastery by subject | % of flashcards reviewed per `course_tag` | Midnight |
| Course circle (cohort study) | Anonymous opt-in cohort panel (UI placeholder only) | Midnight |
| Community rooms (join/leave) | Join anonymous course rooms gated by institution email domain | Midnight |
| Community keyword pool (anonymized) | Contribute and view keyword counts pooled across the room | Midnight |
| Community study threads (create + list) | Post and browse discussion threads in a room | Midnight |
| Shared deck (community) | View and import a room's shared flashcard deck to vault | Midnight |
| Room presence (active count) | See how many classmates are active in the room now | Midnight |
| YouTube caption ingestion | Import captions from a YouTube video | Midnight |
| YouTube panel (search + captions) | Search YouTube and import captions for a session | Midnight |
| Hotword injection | Inject study guide terms into Whisper vocab bias | Midnight |
| Server ASR + diarization | Server-side transcription with speaker separation | Midnight |
| Cross-session keyword convergence | Merge keyword weights across related sessions | Midnight |
| Exam Urgency Mode | Boost Red Zone weights as exam date approaches | Midnight |
| Push notifications (notification strip) | In-app notification system (NotificationStore) | Midnight |
| Ask tab (RAG Q&A) | Ask questions grounded in this session's transcript and slides | Eclipse |
| Ask consent modal | Per-session consent gate before sending content server-side | Eclipse |
| Ask conversation history (encrypted) | Persist and reload Q&A history per session | Eclipse |
| AI note generation | Generate structured notes from lecture content via Claude | Eclipse |
| Practice quiz mode | Auto-generated quiz from session content | Eclipse |
| Cross-session deck merging | Merge flashcard decks across multiple sessions | Eclipse |
| Markdown notes export | Export session notes as a `.md` file | Eclipse |
| Priority processing queue | Jump the transcription + extraction queue | Eclipse |

## Enforcement

### RLS (migration 018)
`public.get_user_tier()` (STABLE, SECURITY DEFINER) is used in `AS RESTRICTIVE` policies — AND'd with existing "own row" policies, not replacing them.

| Table | Minimum tier |
|---|---|
| `flashcard_reviews` | Midnight |
| `session_notes` | Midnight |
| `user_activity` | Midnight |
| `momentum_ledger` | Midnight |
| `community_rooms` | Midnight |
| `room_memberships` | Midnight |
| `community_keyword_pool` | Midnight |
| `community_threads` | Midnight |
| `community_replies` | Midnight |
| `shared_decks` | Midnight |
| `room_presence` | Midnight |
| `ask_conversations` | Eclipse |
| `ask_messages` | Eclipse |

### API routes
All LLM calls check the user's subscription row before firing. Non-LLM routes (keyword extraction, session CRUD) are ungated.

| Route | Gate | Behavior on fail |
|---|---|---|
| `POST /api/generate/flashcards` | Midnight | 403 `tier_required` |
| `POST /api/generate/notes` | Eclipse | 403 `tier_required` |
| `POST /api/ask` | Eclipse | 403 `tier_required` |

### UI
Gated tabs and pages show a `LockedFeature` upsell panel (lock icon + "Upgrade to X" CTA) rather than being hidden. The tab button remains visible with a small lock icon.

| Surface | Gate | Behavior |
|---|---|---|
| Session study tab | Midnight | LockedFeature panel |
| Session notes tab | Midnight | LockedFeature panel |
| Session ask tab | Eclipse | LockedFeature panel |
| Momentum page | Midnight | LockedFeature panel |
| Community page | Midnight | LockedFeature panel |
| `enhanceFlashcards` call in SessionClient | Midnight | Skipped client-side; Dusk users keep auto-generated backs |

## Notes

- "Billing page" is a static stub for all tiers — shown as "Nocturne Pro — coming soon" with no Stripe integration.
- Momentum wallet redeem items (Priority transcription, 9B ASR boost, 1 week of Pro) deduct points via `redeem_momentum()` RPC but do not unlock any actual feature behavior yet.
- Community course circle is a UI placeholder with hardcoded data; it is not backed by real cohort queries.
- Keyword side panel has a split behavior: basic lecture intel (mentions, dwell, confidence, slide list) is visible at Dusk within the lecture tab; the mastery/progress column tied to flashcard review state requires Midnight.
- Live recording tier is tentatively Dusk — to be confirmed once the recording flow is finalized.
- Dusk users can generate flashcards and export to Anki but cannot review them in-app (Study tab is Midnight).
