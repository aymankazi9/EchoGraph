# Product Facts

Every user-facing capability, verified against source code. **Nothing here is derived from marketing copy.**

**Status legend**
- **Built** — code ships and the path is exercised end-to-end
- **Beta** — code exists but a known blocker limits real-world use
- **Planned** — not in code; intentional roadmap item

**Tier legend:** Dusk (free) · Midnight · Eclipse

> ⚠️ **Marketing flag** = a claim in the pricing page or landing copy that does not match the `Built` status below. All flagged items are listed at the bottom.

---

## Ingestion

| Capability | Status | Tier | Description |
|---|---|---|---|
| PDF slide upload | Built | Dusk | Upload a lecture PDF; slides are encrypted and stored, then rendered page-by-page inside the session. |
| Audio upload | Built | Dusk | Upload any audio file (MP3, M4A, WAV, etc.); client-side FFmpeg WASM transcodes to Opus before encrypting. |
| Live recording | Built | Midnight | Record the mic while in a session; audio uploads on stop and feeds into extraction alongside existing slides. Source: `assertCanRecordLive` + `upload.ts` `source: 'recording'`. |
| Study guide upload (PDF / .txt) | Built | Dusk | Attach a PDF or plain-text study guide; its content is cross-referenced with lecture keywords during scoring. |
| Anki .apkg import | Built | Dusk | Upload an Anki deck as a study guide; card fronts become guide terms fed into extraction. Source: `src/lib/study-guide/anki-import.ts`. |
| Handwritten notes OCR | Built | Dusk | Upload images (JPEG, PNG, WebP) or a handwritten PDF; Claude Haiku transcribes the text, which becomes an additional guide source. Source: `src/app/api/ocr/route.ts`. |
| YouTube captions | **Beta** | Eclipse | Searches YouTube for videos matching Red Zone keywords and reads their auto-generated captions. **CORS blocks the VTT fetch in the browser**; the server-side proxy (Edge Function) is not yet deployed. Partially functional only. Source: `src/lib/youtube/captions.ts`. |
| PPTX / PowerPoint | **Not supported** | — | No PPTX parser exists in the codebase. Upload the exported PDF instead. |

---

## AI Analysis

| Capability | Status | Tier | Description |
|---|---|---|---|
| Red Zone scoring | Built | Dusk | Ranks lecture content by exam likelihood using audio dwell time, keyword mention count, and emphasis signals; marks slides and keywords as Red Zone or Likely Zone. Source: `SessionClient.tsx` `executeRescore`, `src/lib/scoring/`. |
| Likely Zone scoring | Built | Dusk | Secondary tier of emphasis — slides and keywords that cross a lower threshold than Red Zone. Both zones feed into flashcard prioritization and the study-guide view. |
| AI flashcard generation | Built | Dusk | Generates front/back flashcard pairs for every scored keyword via Claude. Source: `src/app/api/generate/flashcards/route.ts`. |
| AI flashcard enhancement | Built | Dusk | After generation, Claude improves the back of each card; already-enhanced and manually-created cards are never re-processed. Source: `src/lib/scoring/flashcard-enhancer.ts`. |
| AI notes generation | Built | Midnight | Generates structured markdown notes from slides and transcript via Claude. Source: `src/app/api/generate/notes/route.ts`. |
| AI notes fact-check | Built | Midnight | Checks saved notes against the actual lecture content and highlights factual errors or unsupported claims. Source: `src/app/api/fact-check/route.ts`. |
| AI quiz generation | Built | Eclipse | Generates multiple-choice questions with AI-crafted plausible distractors drawn from the lecture deck. Source: `src/app/api/generate/quiz/route.ts`. |

---

## Flashcard Study

| Capability | Status | Tier | Description |
|---|---|---|---|
| Spaced repetition (SM-2 variant) | Built | Midnight | Tracks `ease_factor`, `interval_days`, and `due_at` per card in `flashcard_reviews`; due cards surface first. Source: `src/lib/scoring/srs.ts`. |
| Four ratings | Built | Midnight | Again / Hard / Good / Easy; each updates the ease factor and next-due interval following an SM-2 formula. Source: `srs.ts` `computeNextReview()`. |
| Due dates | Built | Midnight | Every review row stores a `due_at` timestamp; the flashcard panel sorts by most-overdue first. |
| Mastery states | Built | Midnight | Cards progress through new → learning → mastered as `interval_days` grows; mastery is never stored, always derived live. |
| Exam-date prioritization | Built | Dusk | Setting an exam date on a course enables proximity weighting: cards sort Red Zone → due date when the exam is ≤ 7 days away. Source: `flashcard-panel.tsx` `sortFlashcards()`. |
| Exam Urgency Mode | Built | Midnight | "⚡ Cram mode" button (auto-activates at ≤ 48 h to exam) locks the filter to Red Zone only and shows a live countdown banner. Source: `flashcard-panel.tsx` `urgencyMode` state. |
| Manual card creation | Built | Dusk | Users can add their own flashcards from the flashcard panel; manual cards are excluded from AI enhancement. |
| Anki .apkg export | Built | Dusk | Exports the current deck as a standard `.apkg` file, spaced-rep compatible. Source: `src/lib/study-guide/anki-export.ts`. |
| CSV export | Built | Dusk | Exports flashcards as a CSV file from the flashcard panel. |
| PDF export | Built | Dusk | Exports flashcards as a formatted PDF from the flashcard panel. |
| Quiz mode | Built | Eclipse | Generates multiple-choice questions from the current deck; scores are tracked separately from spaced repetition in `quiz_attempts`. Source: `src/components/study-guide/quiz-panel.tsx`. |

---

## Notes

| Capability | Status | Tier | Description |
|---|---|---|---|
| WYSIWYG notes editor | Built | Midnight | TipTap-based rich text editor with headings, lists, links, highlights, underline, and inline math (KaTeX). Source: `src/components/notes/notes-editor.tsx`. |
| Math support in notes | Built | Midnight | Inline LaTeX via `$...$` rendered with KaTeX; round-trips through tiptap-markdown. Source: `src/components/notes/math-extension.tsx`. |
| Notes version history | Built | Midnight | View and restore previous versions of notes. Source: `src/components/notes/NotesVersionHistory.tsx`. |
| AI fact-check in notes | Built | Midnight | See [AI Analysis → AI notes fact-check] above. |

---

## Ask (AI Chat)

| Capability | Status | Tier | Description |
|---|---|---|---|
| Per-session Ask | Built | Eclipse | Ask questions about a single session's lecture content; Claude answers using the decrypted transcript and slides as context. Source: `src/app/api/ask/route.ts` (`ask/session`). |
| Per-course Ask | Built | Eclipse | Ask across all sessions in a course; Claude aggregates context from every lecture in the course. Source: `src/app/api/ask/route.ts` (`ask/course`). |
| Vault Ask | Built | Eclipse | Ask questions across the entire vault — all courses and sessions; answers synthesize from all your lecture content. Source: `src/app/api/vault-ask/route.ts`, `/vault/ask` page. |

---

## Momentum & Progress

| Capability | Status | Tier | Description |
|---|---|---|---|
| Study streaks | Built | Midnight | Tracks consecutive days with any study activity; targets at 7, 14, 21, 30, 60, 100 days; badges awarded on unlock. Source: `MomentumClient.tsx` `computeStreaks()`. |
| Best streak display | Built | Midnight | Shows the user's all-time best streak alongside the current streak. |
| Mastery progress per course | Built | Midnight | Percentage of Red Zone flashcards with at least one review; drives weak-spot detection. |
| Weak spot detection | Built | Midnight | Identifies courses with the lowest mastery on Red Zone cards; sorted by exam urgency = (1 − mastery) × exam-proximity factor. Source: `MomentumClient.tsx` `computeUrgency()`. |
| Exam date per course | Built | Dusk | Set an ISO date on any course; used for urgency scoring and pre-exam prioritization. |
| Review activity heatmap | Built | Midnight | Calendar grid of daily study activity (last 17 weeks). Source: `MomentumClient.tsx` activity grid rendering. |

---

## Community

| Capability | Status | Tier | Description |
|---|---|---|---|
| Community rooms | Built | Midnight | Join a course-code room to see anonymized Red Zone keyword frequency data from classmates. Source: `src/app/(app)/community/CommunityClient.tsx`. |
| Discussion threads | Built | Midnight | Start and reply to threads within a community room. |
| Shared flashcard decks | Built | Midnight | Browse or download shared flashcard decks contributed by room members. |

---

## Security & Privacy

| Capability | Status | Tier | Description |
|---|---|---|---|
| Zero-knowledge encryption | Built | Dusk (all) | All lecture content is encrypted client-side before upload using AES-256-GCM; Nocturne's servers never receive a decryption key or plaintext. |
| PBKDF2 key derivation | Built | Dusk (all) | Vault passphrase is stretched via PBKDF2-SHA-256 at 310,000 iterations to derive the Key Encryption Key; the master key is AES-256 non-extractable. Source: `src/lib/crypto/worker.ts`. |
| Session-cached vault unlock | Built | Dusk (all) | After unlocking, an ephemeral AES-256-KW key wraps the master key in sessionStorage so the user isn't re-prompted on tab refresh within the same browser session. |
| Recovery kit | Built | Dusk (all) | A random 128-bit backup key wraps the master key independently of the passphrase; downloading the recovery kit is offered at vault setup. Source: `src/lib/crypto/recovery.ts`. |

---

## Storage

| Tier | Encrypted storage cap |
|---|---|
| Dusk | 500 MB |
| Midnight | 5 GB |
| Eclipse | 20 GB |

Source: `src/lib/tiers/features.ts` `STORAGE_CAPS_BYTES`.

---

## ⚠️ Marketing Flag

Items appearing in pricing or landing copy that are **not fully Built**:

| Claim (source) | Actual status | Gap |
|---|---|---|
| "YouTube Red Zone search" (`pricing-section.tsx`, `pricing.tsx`) | **Beta** | The browser-side VTT fetch is CORS-blocked. A server-side proxy (Edge Function) is needed for reliable operation; it is not yet deployed. Searching for videos via the YouTube Data API works; fetching and reading captions does not. |

---

*Last verified: 2026-10-13. Update this file whenever a capability ships, changes tier, or is removed.*
