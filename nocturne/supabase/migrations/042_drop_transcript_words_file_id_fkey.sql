-- Live-recording words are written to transcript_words in real time, chunk by
-- chunk, while the recording is still in progress — the corresponding files
-- row (source='recording') isn't created until the user clicks Stop and the
-- blob finishes uploading in addFilesToExistingSession.
--
-- Migration 029's RLS policy comment already documents this as an accepted,
-- designed-for state: "the files row does not exist yet (live-recording
-- window...)". But the plain FK constraint added in 028 has no such leniency —
-- Postgres enforces it immediately, so every transcript_words insert during
-- an active recording violates transcript_words_file_id_fkey until Stop runs,
-- which can be seconds to minutes later and is always a separate request.
-- A deferred constraint wouldn't help either: these two writes are in
-- different transactions, not just later in the same one.
--
-- Dropping the FK brings the schema in line with what the RLS policy already
-- assumes. No feature deletes an individual files row that already has
-- transcript_words pointing at it (the two `files` deletes in upload.ts are
-- same-request rollbacks on a row that was just created, before any
-- transcription could reference it), so the lost ON DELETE SET NULL cascade
-- has no practical effect. Session-level cleanup is unaffected — transcript_words
-- still cascades on session_id via a separate, untouched FK.

ALTER TABLE public.transcript_words
  DROP CONSTRAINT IF EXISTS transcript_words_file_id_fkey;
