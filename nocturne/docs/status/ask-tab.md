## Status

| Sub-feature | Status |
|---|---|
| Ask consent gate (inline prompt + modal) | Done |
| Consent modal (AskConsentModal) | Done |
| Chat UI (message list, user/assistant bubbles) | Done |
| Slide citation badges on assistant messages | Done |
| Input textarea with Enter-to-send / Shift+Enter newline | Done |
| Conversation history persistence (encrypted) | Done |
| Consent persistence across navigation (DB-row detection) | Done |
| RAG retrieval (TF-IDF keyword-scored transcript chunks + slides) | Done |
| `/api/ask` route (Anthropic claude-haiku-4-5) | Done |
| Optimistic user message (with temp ID) | Done |
| Error display in chat | Done |
| Markdown rendering of assistant responses | Done |
| Streaming responses | Not Started |
| Multiple conversations per session | Not Started |
| Context window management for very long transcripts | Needs verification |

## What Exists

- `nocturne/src/components/ask/ask-panel.tsx` — full Ask tab UI. On mount, queries `ask_conversations` for a prior row; if found, grants consent in the Zustand store and loads history (no modal shown again). If not found, shows the consent gate. Consent is therefore persistent — the modal only fires once per session. Includes TF-IDF context retrieval, POST to `/api/ask`, encrypt-before-store on both user and assistant messages, slide citations.
- `nocturne/src/components/ask/ask-consent-modal.tsx` — modal explaining that content is sent to a server for this query only, allow/deny buttons.
- `nocturne/src/app/api/ask/route.ts` — authenticated POST handler. Two-pass retrieval: (1) keyword-overlap scoring over transcript chunks (150-word windows), (2) TF-IDF scoring over remaining chunks and top 3 relevant slides. Builds system prompt + calls `claude-haiku-4-5-20251001`; returns `{ answer, citedSlideIndices }`.
- `nocturne/supabase/migrations/012_create_ask_conversations.sql` — `ask_conversations` (one per session) and `ask_messages` (role, content_encrypted, cited_slide_indices) tables with RLS; messages owned via parent conversation.

## What's Missing

- **No streaming** — the `/api/ask` route waits for the full Anthropic response before returning. Long answers cause a blank period in the UI. Streaming via ReadableStream + SSE would improve perceived latency.
- **Only one conversation per session** — the UI looks up `ask_conversations` with `.maybeSingle()`. If a user wants a fresh conversation, there is no mechanism to start one; the old history is re-loaded.
- **Transcript context is capped** — retrieval is two-pass (keyword then TF-IDF) over a fixed window. For very long transcripts the highest-scored chunks may still miss the exact relevant passage. There is no fallback to increase `topK` or send the entire (small) transcript.

## Recent Decisions

- 2026-09-xx: Consent persistence fixed. The panel now queries `ask_conversations` on mount to detect a prior conversation; if found, consent is silently re-granted and history reloaded — the modal only fires once.
- 2026-09-xx: TF-IDF scoring added to `/api/ask/route.ts` as a second retrieval pass, improving chunk ranking for queries that don't exactly match keyword terms.
- 2026-09-xx: Slide-reference retrieval wired — top 3 slides by TF-IDF score are included in the system prompt alongside transcript chunks.
- 2026-09-xx: Markdown rendering added to assistant bubbles via `react-markdown` + `remark-gfm`.

## Tier

Eclipse (gated by RLS on `ask_conversations` and `ask_messages` tables).
