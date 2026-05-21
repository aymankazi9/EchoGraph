<!-- App renamed from Nocturne to Nocturne — 2026-05-19 -->

# Nocturne — Project Context
> Read this file at the start of every Claude Code session before touching any code, component, or schema.

---

## 1. Product Vision

**Nocturne** is a *study intelligence system* — not a note-taker. It is purpose-built for students in high-density, high-stakes fields: pre-med, engineering, law, and graduate STEM programs.

The core insight: generic AI study tools summarize content. Nocturne analyzes *what the professor actually emphasized* and surfaces the highest-yield material relative to the student's own study guide or a synthetically generated one.

### Positioning
- **Not for:** the student who wants to paste a YouTube link and get flashcards in 30 seconds.
- **For:** the student whose lecture content is too dense, too technical, and too high-stakes for a generic AI summary to matter.
- **Tagline:** *"Not a note-taker. A study intelligence system."*
- **Exclusivity angle:** An app for the serious student. Complexity of the pipeline is a feature, not a bug, for this audience.

### Primary target personas
| Persona | Key pain |
|---|---|
| Pre-med / medical student | 3-hour pathophysiology lectures, 60-slide decks, needs to know what was *emphasized* not just what was *said* |
| Engineering / PhD student | Dense notation, derivations spoken aloud, terminology that breaks generic ASR |
| Law student | Sensitive case materials, institutional IP concerns, needs cross-session keyword tracking across a full semester |

---

## 2. Core Architecture

### Philosophy: Zero-Knowledge Cloud
The server stores data but **cannot read it**. This is a legal and privacy position, not just a technical one.

- Encrypted `.bin` blobs stored in Supabase Storage — opaque to the server
- Master Key never touches the server in plaintext — ever
- PDFs, audio, transcripts, keywords: all encrypted client-side before upload
- Only plaintext on server: `fileId`, `sessionId`, `size`, `uploadedAt`, `mimeType hint`
- Row-Level Security (RLS) enforced on all Supabase tables and storage buckets

### 3-Tier Key Hierarchy
```
Password (user's head — never stored anywhere)
    ↓ PBKDF2 · 310,000 iterations · SHA-256 · salt from server
KEK (Key-Encryption-Key) — memory only, discarded after unwrap
    ↓ AES-KW unwrap of encrypted Master Key blob
Master Key (MK) — memory only, non-extractable CryptoKey object
    ↓ AES-GCM 256 · unique 96-bit IV per file
File ciphertext (.bin blob) — stored in Supabase Storage
```

### Auth Strategy
- **Identity:** Google OAuth via Supabase Auth (JWT session)
- **Encryption:** Separate vault passphrase — PBKDF2-derived KEK in browser only
- **Critical:** The vault passphrase NEVER touches Supabase. Auth and encryption are completely separate flows.
- **Salt:** Stored in plaintext on server (non-secret). Fetched on login to re-derive KEK.

### Login Flow (returning user)
1. Google OAuth → Supabase session token
2. `GET /auth/salt?userId=…` → server returns PBKDF2 salt
3. User enters vault passphrase → `PBKDF2` in Web Worker → KEK derived
4. Fetch encrypted Master Key blob from Supabase
5. `subtle.unwrapKey(AES-KW, encryptedMK, KEK)` → MK as non-extractable CryptoKey
6. KEK discarded from memory. MK held in module-scoped variable for session.
7. On logout: MK set to null, page unload clears memory.

### Signup Flow (first time)
1. Google OAuth → Supabase session
2. High-friction warning modal (two mandatory checkboxes — cannot skip)
3. User sets vault passphrase → PBKDF2 derives KEK
4. Browser generates random 256-bit Master Key
5. KEK wraps MK (AES-KW) → wrapped blob uploaded to Supabase
6. Recovery Kit generated (MK wrapped with recovery KEK from random salt) → forced download before vault opens
7. Vault opens

### Recovery Kit
- Format: `EG-v1:<base64(MK wrapped with recovery KEK)>`
- The recovery KEK is derived from a random 128-bit salt shown once at signup
- Stored only by the user — never the server
- Acts as a parallel unwrap path if vault passphrase is lost
- **No password reset exists.** Loss of passphrase + Recovery Kit = permanent data loss. By design.

### File Encryption Pipeline
1. Audio → `ffmpeg.wasm` (Web Worker) → Mono Opus 64kbps (~40MB from 500MB WAV)
2. Generate random 96-bit IV: `crypto.getRandomValues(new Uint8Array(12))`
3. `subtle.encrypt({name: 'AES-GCM', iv}, masterKey, fileArrayBuffer)` — chunked at 64MB for large files
4. Package as `.bin`: `[12-byte IV][4-byte chunk count][ciphertext]`
5. Upload to Supabase Storage: `/{userId}/{sessionId}/{fileId}.bin`
6. Write metadata row to Supabase DB (plaintext: size, date; encrypted: filename, keywords, slide text)

> **IV safety:** Each chunk uses a derived IV (base-IV XOR chunk-index). IV reuse under AES-GCM is catastrophic — this path requires explicit unit tests before shipping.

---

## 3. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js (static export) | `next export` — no server runtime. Deploys as static site or `npx serve`. |
| State | Zustand | Single source of truth for playhead, session, vault unlock state |
| Styling | Tailwind CSS | "Clinical / productivity" aesthetic — clean, minimal, high information density |
| Auth | Supabase Auth | Google OAuth only for MVP |
| Database | Supabase PostgreSQL | RLS enforced. Stores encrypted metadata and wrapped keys |
| Storage | Supabase Storage | S3-compatible. Stores `.bin` blobs. Per-user prefix RLS |
| Encryption | Web Crypto API | `window.crypto.subtle` — PBKDF2, AES-KW, AES-GCM |
| PDF rendering | PDF.js | Client-side render + text extraction per slide |
| Audio processing | ffmpeg.wasm | Web Worker — transcode before encryption |
| ML — Transcription | Transformers.js + Whisper-base | Browser WASM. Web Worker. Model cached in CacheStorage after first download |
| ML — Keywords | Transformers.js + BERT | TF-IDF × slide density scoring. Web Worker |
| Server-side ASR | Microsoft VibeVoice-ASR (9B) | Scholar/Pro tier only. Consent-gated. Audio briefly decrypted, transcribed, discarded. |
| Flashcard I/O | Custom apkg parser/writer | Import and export Anki `.apkg` files |
| External APIs | YouTube Data API v3 | v2+ only. Consent-gated. Red Zone search + caption extraction |
| Optional AI | OpenAI GPT-4 | Pro tier only. Per-session explicit consent gate |
| Edge functions | Supabase Edge Functions | Salt delivery, wrapped key delivery |

---

## 4. Feature Map by Tier

### MVP — Free Tier (Sprint 1–3)
Core pipeline, fully functional, no paywalled basics.

**Auth & Security**
- Google OAuth + vault passphrase setup
- PBKDF2 key derivation (Web Worker)
- Master Key generation, AES-KW wrapping, server storage
- Recovery Kit generation + forced download
- High-friction onboarding modal (2 mandatory checkboxes, no skip path)
- Privacy status bar ("Local Mode" / "Syncing" indicator)
- Vault size indicator + per-session delete

**Ingestion**
- Drag-and-drop zone (PDF + audio)
- URL audio ingestion (public URLs only — CORS-open endpoints)
- ffmpeg.wasm audio downsampling (WAV/M4A → Mono Opus 64kbps, Web Worker)
- AES-GCM chunked file encryption
- Supabase Storage upload with progress bar
- Resumable uploads (local IndexedDB write-ahead buffer before Supabase sync)

**Study Guide**
- Study Guide upload (PDF or plain text paste)
- Anki `.apkg` import → card fronts seed Study Guide automatically
- Domain field selector (Pre-med, Engineering, Law) — boosts domain-corpus keyword scores
- Synthetic Study Guide generation when no guide provided (see §6)

**PDF + Transcript**
- PDF.js viewer with page navigation + text layer overlay
- Per-slide text extraction → encrypted metadata storage
- Whisper-base transcription (Transformers.js, Web Worker, streamed word-level timestamps)
- Silence-gap slide sync engine (amplitude analysis + BERT text overlap scoring)
- Bidirectional synchronized playback (transcript ↔ PDF ↔ audio, Zustand state)

**Analysis**
- Real Red Zone scoring (Study Guide × slide text × transcript frequency)
- Synthetic "Likely Zone" (when no study guide — see §6)
- Slide density heatmap (keyword density overlay on PDF nav strip)
- BERT keyword extraction (TF-IDF × slide density)
- Red Zone keyword hot-linking in transcript (click → side panel)
- Professor Emphasis Detection (dwell time per slide × verbal repetition count)
- Lecture Confidence Score (per Red Zone keyword: slide density + verbal mentions)

**Flashcards**
- Red Zone flashcard generation (keyword front + transcript sentence back + slide reference)
- Anki `.apkg` export (tagged by Red Zone, spaced-rep compatible)

**Limits**
- 500MB encrypted storage
- 3 sessions/month

---

### v1 — Scholar Tier ($8/mo, post-beta)

Everything in Free, plus:

- VibeVoice-ASR server-side transcription (Microsoft, 9B param) — consent-gated, audio discarded after transcription
- Speaker diarization (professor vs. student Q&A separation)
- Hotword injection from Study Guide into VibeVoice-ASR before transcription
- USMLE / domain corpus keyword boost (pre-med: First Aid / Pathoma high-yield list integration)
- Cross-session keyword convergence (keywords appearing across multiple sessions ranked by frequency)
- Exam Urgency Mode (set exam date → auto-prioritize sessions by Red Zone density + time remaining)
- YouTube Red Zone search (Red Zone keywords → YouTube Data API → ranked embeds)
- YouTube URL → caption → flashcard pipeline (fetch captions, match Red Zone terms, generate cards)
- 5GB encrypted storage
- Unlimited sessions

---

### v2 — Pro Tier ($18/mo)

Everything in Scholar, plus:

- GPT-4 summarization (per-session explicit consent — only plaintext transcript leaves device, no files)
- Practice quiz mode (fill-in-the-blank from Red Zone transcript sentences)
- Silence threshold tuning (settings slider — default 1.5s pause, adjustable)
- Markdown notes export (user notes + keyword list — original PDF/audio never exportable)
- Priority processing queue
- Cross-session Anki deck merging
- Synthetic Study Guide refinement suggestions ("These terms appeared in 4 sessions but aren't in your Study Guide — add them?")
- 20GB encrypted storage

---

### Post-v2 / Future (Unscheduled)

- Mobile app (iOS + Android) — after beta
- Real-time collaboration — after mobile
- Browser extension for LMS audio capture (Panopto, Kaltura, Canvas — unblocks URL CORS wall)
- Institutional / university licensing (B2B2C channel)
- Native Anki sync via AnkiConnect API
- Speaker diarization v2 (student question tagging, Q&A extraction)
- Flashcard generation from GPT-4 explanations

---

## 5. Adaptive Input Pipeline

Nocturne adapts its output to whatever inputs the student provides. The session dashboard must communicate available vs. locked features based on what's uploaded.

| Inputs | What's available | Key missing unlock |
|---|---|---|
| **Slides only** | PDF viewer, slide text, Synthetic Guide, basic flashcards, YouTube search | Upload recording for sync + richer guide |
| **Recording only** | Whisper transcript, Synthetic Guide from speech, emphasis detection (partial), flashcards | Upload slides for sync + heatmap |
| **Study Guide only** | Keyword index, YouTube search immediately, hotword list primed | Upload slides and/or recording |
| **Slides + Recording** | Full sync engine, Professor Emphasis Detection, Lecture Confidence Score, high-confidence Synthetic Guide | Add Study Guide to promote Likely Zone → Red Zone |
| **Slides + Study Guide** | Real Red Zone scoring, slide heatmap, keyword hot-links, YouTube search | Upload recording for full sync |
| **Recording + Study Guide** | Hotword-primed ASR, Red Zone in transcript, Lecture Confidence Score, rich flashcards | Upload slides for sync + heatmap |
| **All three** | Full experience — every feature unlocked | — |

**UX requirement:** The session dashboard must show a visual "unlock next" prompt for each missing input type. Never show a locked feature without explaining exactly what to add to unlock it.

---

## 6. Synthetic Study Guide

When no study guide is provided, Nocturne generates one automatically. It powers a **"Likely Zone"** (purple) rather than a **"Red Zone"** (red) — visually distinct to communicate it's inferred, not professor-prescribed.

### Generation sources (in descending confidence)
1. **Slides + Recording (best):** Slide header weight × verbal repetition count × professor dwell time per slide. High-confidence.
2. **Slides only:** TF-IDF on slide text. Headers, bold text, and repeated terms across slides weighted highest.
3. **Recording only:** BERT keyword extraction on transcript. Most-repeated + longest-dwelled terms.

### Domain corpus boost
When student selects their field, domain-specific weights apply:
- **Pre-med:** USMLE Step 1/2 high-yield term list (First Aid, Pathoma, Sketchy concepts). A term matching USMLE high-yield gets a score boost even if lightly covered in the lecture.
- **Engineering:** Standard IEEE/ACM concept taxonomy.
- **Law:** Bar exam high-frequency doctrine list.

### Upgrade path
- Likely Zone automatically upgrades to Red Zone if the student later adds a real Study Guide.
- Likely Zone automatically upgrades to Red Zone if student imports an Anki deck (card fronts = keyword list).
- A Pro-tier suggestion engine surfaces: *"These Likely Zone terms appeared in 4+ sessions — consider adding them to your Study Guide."*

---

## 7. Anki Integration

### Import (`.apkg`)
- Parse the SQLite database inside the `.apkg` zip
- Extract card fronts as the keyword list
- Automatically seed the Study Guide with these keywords
- All downstream scoring (Red Zone, heatmap, hotwords) activates immediately

### Export (`.apkg`)
- Generate a valid Anki `.apkg` from the session's Red Zone flashcard set
- Card front: Red Zone keyword
- Card back: transcript sentence where professor explained it + slide number reference
- Deck name = session name
- Tags = Red Zone keywords
- Compatible with Anki desktop, AnkiDroid, AnkiMobile

### YouTube → Flashcard Pipeline (Scholar/Pro)
- **Mode A (Search):** Red Zone keywords → YouTube Data API search → ranked video embeds in side panel
- **Mode B (URL):** Student pastes YouTube URL → Nocturne fetches auto-generated captions via YouTube Data API → matches captions against Red Zone keywords → generates flashcards from caption context
- No video download. Caption text only. Consent gate required (external API call).
- Pre-med focus: Sketchy, Ninja Nerd, Osmosis channels have auto-captions and are de facto pre-med study libraries.

---

## 8. Supabase Schema (Target)

```sql
-- Users (managed by Supabase Auth, extended here)
users (
  id uuid PRIMARY KEY,           -- Supabase Auth UID
  email text,                     -- plaintext, needed for auth
  pbkdf2_salt text,              -- plaintext, public, needed for KEK derivation
  encrypted_master_key text,     -- AES-KW wrapped MK, opaque to server
  field text,                    -- 'premed' | 'engineering' | 'law' | 'other'
  tier text,                     -- 'free' | 'scholar' | 'pro'
  storage_used_bytes bigint,
  created_at timestamptz
)

-- Study sessions
sessions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  title_encrypted text,          -- encrypted
  status text,                   -- 'ingesting' | 'processing' | 'ready'
  has_slides boolean,
  has_audio boolean,
  has_study_guide boolean,
  guide_type text,               -- 'real' | 'synthetic' | 'anki_import'
  created_at timestamptz,
  exam_date date                 -- for Exam Urgency Mode, plaintext ok
)

-- Files
files (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES sessions(id),
  user_id uuid REFERENCES users(id),
  file_type text,                -- 'pdf' | 'audio' | 'guide'
  storage_path text,             -- Supabase Storage path to .bin blob
  size_bytes bigint,             -- plaintext
  mime_hint text,                -- plaintext
  iv text,                       -- base64 IV for decryption
  uploaded_at timestamptz
)

-- Slides (per PDF page)
slides (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES sessions(id),
  page_number integer,
  text_encrypted text,           -- slide text, encrypted
  density_score real,            -- 0-100, plaintext ok (no content revealed)
  is_red_zone boolean,
  is_likely_zone boolean
)

-- Transcript words
transcript_words (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES sessions(id),
  word_encrypted text,           -- encrypted
  start_time_ms integer,         -- plaintext (no content revealed)
  end_time_ms integer,
  slide_index integer            -- mapped slide at this timestamp
)

-- Keywords
keywords (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES sessions(id),
  term_encrypted text,           -- encrypted
  source text,                   -- 'real_guide' | 'synthetic' | 'anki'
  zone text,                     -- 'red' | 'likely'
  confidence_score real,
  mention_count integer,
  dwell_time_ms integer
)
```

**RLS policies:** Every table has `user_id = auth.uid()` row-level security. Storage bucket has per-user prefix policy: users can only read/write `/{their userId}/`.

---

## 9. Build Order

Follow this sequence strictly — each step is a hard dependency for the next.

| Step | Task | Est. |
|---|---|---|
| 1 | Supabase project setup, schema, RLS policies, Storage bucket | 1 day |
| 2 | Google OAuth + vault passphrase flow, PBKDF2 in Web Worker, KEK → MK unwrap | 2–3 days |
| 3 | Recovery Kit generation + forced download, high-friction onboarding modal | 1 day |
| 4 | Drag-and-drop ingestion, ffmpeg.wasm downsampling (Web Worker), AES-GCM chunked encryption, Supabase upload | 3–4 days |
| 5 | PDF.js viewer, per-slide text extraction, encrypted metadata write | 2 days |
| 6 | Whisper-base transcription (Transformers.js, Web Worker), word-level timestamp streaming | 3–4 days |
| 7 | Silence-gap slide detector + BERT overlap scoring → timestamp-to-slide map | 3 days |
| 8 | Bidirectional synchronized playback UI (Zustand, three-pane layout) | 3–4 days |
| 9 | Study Guide upload + Anki `.apkg` import, BERT keyword scoring, Red Zone/Likely Zone flagging | 3 days |
| 10 | Slide density heatmap, keyword hot-linking in transcript, flashcard generation + Anki export | 2–3 days |

---

## 10. Critical Design Rules

These are non-negotiable. Do not deviate without explicit discussion.

1. **The vault passphrase never touches Supabase.** Auth and encryption are entirely separate flows. PBKDF2 runs browser-only.
2. **All ML runs in Web Workers.** Whisper, BERT, and ffmpeg.wasm must never block the main thread. Non-negotiable for UX on student hardware.
3. **Non-extractable CryptoKey.** Master Key is always created with `extractable: false`. It is never passed to `exportKey()`.
4. **Local-first writes.** IndexedDB as a write-ahead buffer before Supabase sync. A tab close or network drop must never lose session data.
5. **IV uniqueness.** Every file chunk gets a unique IV (base-IV XOR chunk-index). This code path requires unit tests before the upload pipeline ships.
6. **Locked features explain themselves.** Every locked feature in the UI shows exactly which input (slides / recording / study guide) will unlock it. Never show a dead end.
7. **Free tier is a complete product.** The full core loop (ingest → transcribe → sync → score → flag → flashcards) is free. Paid tiers add better ASR and more storage — not access to basics.
8. **Synthetic Guide is always visually distinct from a real one.** "Likely Zone" (purple) ≠ "Red Zone" (red). Never conflate them in UI or copy.
9. **Consent gates are mandatory for all external API calls.** YouTube, GPT-4, VibeVoice-ASR — every outbound call requires explicit per-session user consent. No implicit calls.
10. **Sequential ML processing.** Never run Whisper and BERT simultaneously. Transcribe first, then score. Prevents memory pressure on student laptops.

---

## 11. Open Questions (Resolve Before Relevant Sprint)

| Question | Relevant at |
|---|---|
| Passphrase change flow — re-wrap MK with new KEK, or passphrase is permanent? | Sprint 2 |
| Remember-this-device option (30-day MK cache) — security vs. UX trade-off? | Sprint 2 |
| Silence threshold default — 1.5s fixed, user-adjustable slider, or auto-calibrate from first 60s? | Sprint 7 |
| Pricing model finalized — $8/$18 placeholders, benchmark against Otter.ai / Notion before locking | Pre-launch |
| GDPR/CCPA compliance surface — email + timestamps in plaintext = obligations. Need privacy policy + deletion endpoint | Pre-launch |
| USMLE corpus — build internally or license from a third party? | Sprint 9 |
| Anki `.apkg` parser — build from scratch or use an existing JS library? | Sprint 9 |

---

## 12. Competitive Context

**Primary competitor:** Turbo AI (turbo.ai) — 5M users, $9.99–$19.99/mo, generalist note-taker.

**Their documented weaknesses (our structural advantages):**
- Inconsistent ASR accuracy on STEM vocabulary → we use Study Guide hotword priming
- App crashes / failed saves → we are local-first with IndexedDB write-ahead buffer
- Limited note customization → our output is shaped by the student's own Study Guide
- Steep paywall on free tier → our free tier is the complete core product

**What they do better (be honest about gaps):**
- Mobile apps (iOS/Android) — we are web-only until post-beta
- Real-time collaboration — out of scope until post-v2
- YouTube → instant flashcards (simpler UX) — our version is deeper but more involved
- 5M users, brand recognition — we are building trust through free tier honesty and word-of-mouth in med/law/engineering programs

---

*Last updated: 2026-05-01 — reflects full architecture, tier structure, Anki integration, Synthetic Study Guide, and adaptive input pipeline decisions.*
