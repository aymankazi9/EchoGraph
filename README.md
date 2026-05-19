# EchoGraph

![Next.js 16.2.4](https://img.shields.io/badge/Next.js-16.2.4-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Beta](https://img.shields.io/badge/status-beta-orange)
![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-green)

EchoGraph is a study intelligence system for high-stakes learners in pre-med, engineering, law, and graduate STEM programs. It is not a note-taker. It analyzes what a professor emphasized — cross-referencing lecture recordings, slide decks, and the student's own study guide — and surfaces the highest-yield material for exam preparation.

The core differentiator is privacy. All content (audio, PDFs, transcripts, keywords) is encrypted client-side before it touches the server. The server stores opaque `.bin` blobs it cannot read. The student's vault passphrase never leaves the browser.

---

## Core Features

**Study intelligence**
- Red Zone scoring: intersects Study Guide keywords × slide text density × transcript mention frequency
- Likely Zone (purple): synthetic study guide generated from slides and/or recording when no guide is provided
- Professor Emphasis Detection: dwell time per slide × verbal repetition count
- BERT keyword extraction with TF-IDF weighting and domain corpus boost (USMLE, engineering, law)
- Bidirectional synchronized playback — transcript, PDF, and audio all locked to the same timestamp

**Privacy and security**
- Zero-knowledge model: server stores encrypted blobs, never plaintext content
- 3-tier key hierarchy: password → PBKDF2-derived KEK (browser-only) → AES-KW-wrapped Master Key → AES-GCM-encrypted files
- Auth (Google OAuth) and encryption (vault passphrase) are entirely separate flows
- Recovery Kit: MK wrapped with a second KEK derived from a random salt, forced download at signup
- No password reset — loss of passphrase and Recovery Kit means permanent data loss, by design

**File processing**
- ffmpeg.wasm audio transcoding: WAV/M4A → Mono Opus 64kbps in a Web Worker
- Whisper-base transcription via Transformers.js in a Web Worker, word-level timestamps
- Silence-gap slide sync: amplitude analysis + BERT text overlap scoring maps transcript to slide index
- PDF.js rendering and per-slide text extraction
- Chunked AES-GCM encryption at 64MB chunks; each chunk gets a derived IV (base XOR index)
- IndexedDB write-ahead buffer (Dexie) before Supabase upload — tab close or network drop loses nothing

**Flashcards and Anki**
- Red Zone flashcard generation: keyword front, transcript sentence back, slide reference
- Anki `.apkg` import — card fronts seed the Study Guide immediately; all downstream scoring activates
- Anki `.apkg` export — valid deck with tags, compatible with Anki desktop, AnkiDroid, AnkiMobile
- YouTube Red Zone search and caption-to-flashcard pipeline (Scholar/Pro, consent-gated)

---

## Architecture

### Zero-knowledge key hierarchy

```
Password (never stored)
    ↓ PBKDF2 · 310,000 iterations · SHA-256 · salt from server
KEK (Key-Encryption-Key) — memory only, discarded after unwrap
    ↓ AES-KW unwrap of encrypted Master Key blob
Master Key — memory only, non-extractable CryptoKey
    ↓ AES-GCM 256 · unique 96-bit IV per chunk
.bin ciphertext — stored in Supabase Storage
```

The vault passphrase never touches Supabase. Salt is stored in plaintext on the server (it is non-secret). Master Key is always `extractable: false`.

### Tech stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^4 |
| Animation | Framer Motion | ^12.38.0 |
| State | Zustand | ^5.0.12 |
| Auth + DB | Supabase (`@supabase/supabase-js`) | ^2.105.1 |
| Server components | `@supabase/ssr` | ^0.10.2 |
| PDF rendering | pdfjs-dist | ^5.7.284 |
| ML inference | `@huggingface/transformers` (Whisper + BERT) | ^4.2.0 |
| Audio processing | `@ffmpeg/ffmpeg` (wasm) | ^0.12.15 |
| Local storage | Dexie (IndexedDB) | ^4.4.2 |
| Anki parser | sql.js + jszip | ^1.14.1 / ^3.10.1 |
| UI primitives | radix-ui | ^1.4.3 |
| Icons | lucide-react | ^1.14.0 |
| State helpers | immer | ^11.1.4 |
| PWA | @ducanh2912/next-pwa | ^10.2.9 |
| Tests | vitest | ^4.1.5 |
| Email | Resend REST API (Edge Functions only) | — |

### Processing pipeline

```
Upload (drag-drop or URL)
    → ffmpeg.wasm (Web Worker): transcode to Mono Opus 64kbps
    → AES-GCM chunked encryption (Web Worker), unique IV per chunk
    → IndexedDB write-ahead buffer (Dexie)
    → Supabase Storage upload, metadata row written

Whisper-base (Web Worker): word-level transcript with timestamps
    → Silence detector (amplitude analysis): gap candidates
    → BERT scorer (Web Worker): text overlap per slide candidate
    → Sync map: timestamp → slide index

BERT keyword extraction (TF-IDF × slide density)
    → Red Zone scoring: keywords × slide density × verbal mentions
    → Flashcard generation
```

ML workers run strictly sequentially — Whisper finishes before BERT starts — to prevent memory pressure on student hardware.

---

## Project structure

```
EchoGraph/
├── echograph/                        # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/                # Auth guard — redirects to /login
│   │   │   │   └── vault/            # Session dashboard + settings
│   │   │   ├── (marketing)/          # NavBar + Footer layout
│   │   │   │   ├── about/
│   │   │   │   ├── accessibility/
│   │   │   │   ├── blog/
│   │   │   │   ├── changelog/
│   │   │   │   ├── confirm-subscription/   # Double opt-in landing
│   │   │   │   ├── contact/
│   │   │   │   ├── cookies/
│   │   │   │   ├── help/
│   │   │   │   ├── pricing/
│   │   │   │   ├── privacy/
│   │   │   │   ├── roadmap/
│   │   │   │   ├── security/
│   │   │   │   └── terms/
│   │   │   ├── (vault)/              # Vault setup, unlock, new session
│   │   │   │   ├── setup/            # First-time passphrase + Recovery Kit
│   │   │   │   ├── unlock/           # Returning user passphrase entry
│   │   │   │   └── session/new/
│   │   │   ├── (workspace)/          # Three-pane session view
│   │   │   │   └── session/[id]/
│   │   │   ├── auth/callback/        # Supabase OAuth callback route
│   │   │   ├── login/
│   │   │   ├── offline/              # PWA offline fallback
│   │   │   └── page.tsx              # Marketing landing page
│   │   ├── components/
│   │   │   ├── audio/                # Audio player, seek bar
│   │   │   ├── dashboard/            # Session cards, filters, search, sort
│   │   │   ├── ingestion/            # Drop zone, URL input, upload panel, progress
│   │   │   ├── marketing/            # Landing page sections + subpage components
│   │   │   ├── nav/                  # App shell, side nav, privacy badge, storage indicator
│   │   │   ├── onboarding/           # Recovery modal (forced download)
│   │   │   ├── pdf/                  # PDF viewer, page controls, slide nav strip
│   │   │   ├── pwa/                  # Install banner, Apple meta tags
│   │   │   ├── session/              # Decryption overlay, guided empty state, keyboard shortcuts
│   │   │   ├── settings/             # Account, passphrase change, storage, danger zone
│   │   │   ├── study-guide/          # Flashcard panel, guide upload, keyword chips + side panel
│   │   │   ├── transcript/           # Transcript pane, word spans, transcription controls
│   │   │   ├── ui/                   # shadcn primitives (accordion, checkbox, dialog, etc.)
│   │   │   └── youtube/              # YouTube search panel, caption input, consent modal
│   │   ├── lib/
│   │   │   ├── corpus/               # usmle-highyield.json
│   │   │   ├── crypto/               # vault.ts, encrypt.ts, decrypt.ts, recovery.ts, worker.ts
│   │   │   ├── db/                   # dexie.ts (IndexedDB schema)
│   │   │   ├── pdf/                  # PDF text extractor
│   │   │   ├── scoring/              # keyword-scorer.ts, flashcard-generator.ts
│   │   │   ├── study-guide/          # parser, synthetic, anki-import, anki-export
│   │   │   ├── sync/                 # silence-detector, bert-scorer, sync-engine, playhead-tracker
│   │   │   ├── workers/              # whisper, bert, ffmpeg, encrypt, silence Web Workers
│   │   │   ├── youtube/              # search, captions, config, youtube-flashcards
│   │   │   ├── newsletter.ts         # Client-side newsletter subscribe helper
│   │   │   ├── supabase.ts           # Browser Supabase client
│   │   │   ├── supabase-server.ts    # Server component Supabase client
│   │   │   ├── transcription.ts
│   │   │   └── upload.ts
│   │   ├── store/                    # Zustand stores: session, dashboard, notifications
│   │   └── middleware.ts             # Auth guard redirects
│   └── supabase/
│       ├── functions/
│       │   ├── subscribe-newsletter/ # Rate-limit, upsert token, send confirmation email
│       │   └── confirm-newsletter/   # Verify token, mark confirmed, add to Resend audience
│       └── migrations/               # 001–008 (see Database schema)
├── CONTEXT.md                        # Product vision, architecture decisions
├── DESIGN_SYSTEM.md                  # Tokens, typography, color, spacing
├── LICENSE                           # AGPL-3.0
└── README.md
```

---

## Database schema

All tables enforce Row-Level Security (`user_id = auth.uid()`). Storage bucket uses a per-user prefix policy.

| Table | Purpose | Notes |
|---|---|---|
| `users` | Extended Supabase Auth users | Stores PBKDF2 salt, AES-KW-wrapped Master Key, tier, storage usage, preferences |
| `sessions` | Study sessions | `title_encrypted`; `status`: ingesting → processing → ready; `guide_type`: real / synthetic / anki_import |
| `files` | Uploaded file references | `storage_path` to `.bin` blob; `iv` (base64); `file_type`: pdf / audio / guide |
| `slides` | Per-slide metadata | `text_encrypted`; `density_score` (0–100, plaintext); `is_red_zone`, `is_likely_zone` |
| `transcript_words` | Word-level transcript | `word_encrypted`; `start_time_ms`, `end_time_ms`, `slide_index` (all plaintext) |
| `sync_map` | Timestamp → slide index | Output of silence detector + BERT scorer; used for bidirectional sync |
| `keywords` | Extracted keywords | `term_encrypted`; `source`: real_guide / synthetic / anki; `zone`: red / likely; confidence and mention counts |
| `flashcards` | Generated flashcards | Linked to session and keyword; front/back encrypted |
| `newsletter_rate_limits` | IP-based rate limiting | Stores SHA-256 hash of IP, not the IP itself; cleaned automatically (>1h old) |
| `newsletter_confirmations` | Double opt-in tokens | Token UUID, email, `confirmed` boolean, 24h expiry; upserted on re-subscribe |

### Migrations

| File | What it adds |
|---|---|
| `001_add_recovery_salt.sql` | `pbkdf2_salt`, `encrypted_master_key` columns on `users` |
| `002_add_filename_encrypted.sql` | `filename_encrypted` column on `files` |
| `003_create_slides.sql` | `slides` table |
| `004_create_sync_map.sql` | `sync_map` table |
| `005_create_keywords.sql` | `keywords` table |
| `006_create_flashcards.sql` | `flashcards` table |
| `007_add_user_preferences.sql` | User preferences (theme, silence threshold, domain) |
| `008_newsletter.sql` | `newsletter_rate_limits` and `newsletter_confirmations` tables |

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project with Google OAuth enabled
- A Resend account (for newsletter Edge Functions)
- Supabase CLI (`npm install -g supabase`)

### Environment variables

Create `echograph/.env.local`:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `NEXT_PUBLIC_APP_URL` | Yes | Full origin URL (e.g. `http://localhost:3000`) — used in confirmation email links |
| `NEXT_PUBLIC_YOUTUBE_API_KEY` | No | YouTube Data API v3 key — YouTube features are disabled if absent |

### Install and run

```bash
cd echograph
npm install
npm run dev
```

### Database setup

```bash
# Apply all migrations
supabase db push

# Or apply individually
supabase db push --file supabase/migrations/001_add_recovery_salt.sql
# ... repeat for 002–008
```

### Edge Function deployment

The newsletter functions require secrets set in Supabase:

```bash
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_AUDIENCE_ID=...

supabase functions deploy subscribe-newsletter
supabase functions deploy confirm-newsletter
```

`SUPABASE_SERVICE_ROLE_KEY` is injected automatically by the Supabase runtime — do not set it manually.

---

## Key implementation notes

**Vault passphrase isolation.** PBKDF2 key derivation runs inside a Web Worker (`lib/crypto/worker.ts`) and the derived KEK never crosses into the main thread. The Master Key is created as `extractable: false` and is discarded on logout or page unload.

**IV uniqueness.** Each 64MB file chunk uses a derived IV: base IV XOR chunk index. IV reuse under AES-GCM is catastrophic. The chunk encryption path (`lib/crypto/encrypt.ts`) has dedicated unit tests in `lib/crypto/__tests__/chunkEncrypt.test.ts`.

**Sequential ML processing.** Whisper finishes transcription before BERT begins keyword scoring. Both run in separate Web Workers (`lib/workers/whisper.worker.ts`, `lib/workers/bert.worker.ts`). Never run them simultaneously — memory pressure on student hardware causes crashes.

**Local-first writes.** Dexie (`lib/db/dexie.ts`) writes session data to IndexedDB before Supabase upload begins. A network drop or tab close cannot lose data that has already been processed.

**Double opt-in newsletter.** `subscribe-newsletter` stores a token and sends a confirmation email via Resend. It does not add the contact to the Resend audience. Only `confirm-newsletter` — after the user clicks the link — adds the contact with `unsubscribed: false`. This is GDPR-compliant.

**IP hashing.** Rate-limit rows store `SHA-256(ip)` as a hex string, never the raw IP. Stale rows (>1h old) are deleted at the start of each subscribe request.

**Resend not in `package.json`.** The newsletter Edge Functions call the Resend REST API directly via `fetch()`. There is no Resend SDK in the Next.js app — `RESEND_API_KEY` lives only in Supabase Edge Function secrets.

---

## Security

EchoGraph's security model is built on two guarantees:

1. **The server cannot read your content.** PDFs, audio, transcripts, keywords, and filenames are all encrypted client-side before upload. The server sees opaque `.bin` blobs, file sizes, and upload timestamps.

2. **The vault passphrase never leaves the browser.** It is used only to derive the KEK via PBKDF2 (310,000 iterations, SHA-256). The KEK wraps the Master Key via AES-KW. Neither the passphrase nor the KEK is ever sent to Supabase.

There is no password reset flow. If a user loses their passphrase and their Recovery Kit, their data is permanently inaccessible. This is a deliberate design decision documented in onboarding.

To report a security vulnerability: hello@echograph.app

---

## Browser support

| Browser | Supported | Notes |
|---|---|---|
| Chrome 112+ | Yes | Primary development target |
| Firefox 115+ | Yes | All Web Workers and WASM supported |
| Safari 17+ | Yes | Web Crypto, WASM, and SharedArrayBuffer available |
| Edge 112+ | Yes | Chromium-based |
| Mobile browsers | Partial | PWA installable; heavy ML processing not recommended on mobile |

Requires: `window.crypto.subtle`, `SharedArrayBuffer` (COOP/COEP headers set), WebAssembly, Web Workers.

---

## Roadmap

The current codebase is a beta of the Free tier. Planned work in order:

- Complete vault encryption pipeline (PBKDF2 → KEK → MK → AES-GCM upload)
- Whisper transcription end-to-end with word-level timestamp sync
- Red Zone scoring and slide heatmap
- Anki import/export
- Scholar tier: VibeVoice-ASR server-side transcription (consent-gated), cross-session keywords, YouTube pipeline
- Pro tier: GPT-4 summarization (consent-gated), practice quiz mode, markdown export
- Mobile apps (post-beta)

See `CONTEXT.md` for the full feature map and build order.

---

## Contributing

This is a pre-launch project. Before contributing:

1. Read `CONTEXT.md` in full — it covers the zero-knowledge model, key hierarchy, critical design rules, and build order.
2. Read `DESIGN_SYSTEM.md` — all UI work must use the defined tokens; no raw hex values or arbitrary spacing.
3. Open an issue before starting significant work.

---

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE).
