-- ── 1. Allow multiple audio takes per session ────────────────────────────────
-- The one-audio-per-session partial unique index was a temporary simplification.
-- Multi-take recordings (record, stop, record more) require multiple audio rows
-- per session; each session_files row has its own unique file_id primary key,
-- so rows remain individually identifiable.
DROP INDEX IF EXISTS public.session_files_one_audio_per_session;


-- ── 2. Scope transcript_words to the audio file that produced them ────────────
-- New column: file_id — the files.id of the audio take this word came from.
-- Nullable for backward compatibility; existing rows (batch Whisper + legacy live)
-- retain file_id = NULL and continue working unchanged. New live-recording words
-- have file_id set from the moment they are written.
--
-- Used by sync-engine.ts to scope the slide_index backfill to a single take,
-- and by any future per-take transcript view.

ALTER TABLE public.transcript_words
  ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transcript_words_file_id_idx
  ON public.transcript_words (file_id);


-- ── 3. Scope sync_map to (session_id, file_id) ────────────────────────────────
-- Each sync map row now belongs to a specific audio take, not just a session.
-- This allows BERT sync to run independently per take and lets the playhead
-- tracker resolve the correct take's segment list.
--
-- Nullable for backward compatibility; the existing session-level rows keep
-- file_id = NULL and upsert correctly via the composite NULLS NOT DISTINCT index.

ALTER TABLE public.sync_map
  ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES public.files(id) ON DELETE SET NULL;

-- Replace the session-only unique index with a composite (session_id, file_id).
-- NULLS NOT DISTINCT means (session_id='X', NULL) conflicts with another
-- (session_id='X', NULL) — preserving the one-sync-per-session constraint for
-- legacy NULL rows while enforcing one-sync-per-(session, take) for new rows.
DROP INDEX IF EXISTS public.sync_map_session_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS sync_map_session_file_key
  ON public.sync_map (session_id, file_id) NULLS NOT DISTINCT;
