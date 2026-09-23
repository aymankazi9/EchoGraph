## Status

| Sub-feature | Status |
|---|---|
| Plain-text note editor (textarea) | Superseded by Tiptap |
| Rich text / Tiptap WYSIWYG editor | Done |
| Toolbar (bold, italic, underline, h1/h2, code, lists) | Done |
| Bubble menu (inline formatting on selection) | Done |
| Highlight extension | Done |
| Keyword highlighting (auto-highlight scoring terms) | Done |
| Slide-citation links (`/` slash-command → slide ref chip) | Done |
| Slash command menu (`/`) | Done |
| Load existing note on mount (decrypt from DB) | Done |
| Auto-save with debounce | Done |
| Save status indicator (Idle / Saving / Saved / Error) | Done |
| AI note generation via `/api/generate/notes` | Done |
| "Regenerate" button when note exists | Done |
| Generating spinner state | Done |
| Version history snapshots (auto + manual) | Done |
| Export note as PDF or text file | Not Started |

## What Exists

- `nocturne/src/components/notes/notes-editor.tsx` — full Tiptap editor: loads from `session_notes`, debounced AES-GCM re-encrypt + upsert, AI generation button. Extensions: StarterKit, Markdown (tiptap-markdown), Highlight, SlideRefExtension, KeywordHighlightExtension, SlashCommandExtension.
- `nocturne/src/components/notes/NotesToolbar.tsx` — `NotesToolbar` (heading, bold, italic, underline, code, bullet/ordered list, highlight) + `NotesBubbleMenu` (inline formatting on selection via BubbleMenu).
- `nocturne/src/components/notes/SlashCommandMenu.tsx` — `/` command palette: currently exposes slide-picker command.
- `nocturne/src/components/notes/SlideRefChip.tsx` — inline chip node showing slide number; clicking calls `onGoToSlide` prop to seek the PDF viewer.
- `nocturne/src/components/notes/extensions/slide-ref.ts` — Tiptap Node extension for slide-ref chips.
- `nocturne/src/components/notes/extensions/keyword-highlight.ts` — Tiptap Mark extension that auto-underlines/colors terms from the session keyword list.
- `nocturne/src/components/notes/extensions/slash-command.ts` — Tiptap Extension registering the `/` slash menu.
- `nocturne/src/components/notes/NotesVersionHistory.tsx` — version history panel: lists auto-snapshots and manual saves, diff view, restore.
- `nocturne/src/app/api/generate/notes/route.ts` — server route that builds a prompt from decrypted slide/transcript context and calls the Anthropic API; returns a plaintext notes string.
- `nocturne/supabase/migrations/011_create_session_notes.sql` — `session_notes` table: one row per session, `content_encrypted` (AES-GCM "ctB64:ivB64"), `updated_at`, unique index on `session_id`.

## What's Missing

- **No export** — notes cannot be downloaded as a file. The export button visible in the session top bar is a stub and does not include notes.
- **No conflict resolution** — if the same session is open in two tabs and both tabs save, the last write wins silently. An `updated_at` check before upsert would prevent silent overwrites.
- **AI generation overwrites without confirmation** — clicking "Generate notes from lecture" replaces any existing note immediately. There is no diff preview or "merge with existing" path.

## Recent Decisions

- 2026-08-xx: Notes editor rebuilt with Tiptap WYSIWYG, replacing the plain `<textarea>`. Added toolbar, bubble menu, slide-ref chips (via slash command), keyword highlighting, and version history.

## Tier

Midnight (gated by RLS on `session_notes` table, which requires `user_has_tier(auth.uid(), 'midnight')`).
