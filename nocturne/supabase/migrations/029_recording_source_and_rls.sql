-- Track how an audio file was produced so tier can be enforced at the RLS
-- layer for live-recorded audio without affecting uploaded-audio transcription.
--
-- files.source = 'upload'    → uploaded by the user (default; free-tier allowed)
-- files.source = 'recording' → captured via Record Live (midnight+ only)
--
-- The transcript_words policy uses IS DISTINCT FROM so that rows written
-- during an active live-recording session — before the files row is committed —
-- fall through to the server-action gate at handleStartRecording rather than
-- being blocked here.  Once a files row with source='recording' exists, any
-- attempt to insert transcript_words referencing it requires midnight+.

-- ─── 1. source column on files ────────────────────────────────────────────────

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload'
  CONSTRAINT files_source_check CHECK (source IN ('upload', 'recording'));

-- ─── 2. RLS INSERT policy on transcript_words ─────────────────────────────────
-- RESTRICTIVE: ANDs with the existing permissive "own row" policy.
-- Passes when:
--   • file_id IS NULL (legacy / batch-Whisper rows — no source to check)
--   • the files row does not exist yet (live-recording window; NULL IS DISTINCT FROM 'recording' = true)
--   • the files row has source = 'upload' (uploaded-audio transcription, ungated)
--   • the files row has source = 'recording' AND user is midnight+

CREATE POLICY "transcript_words: recording source requires midnight+"
  ON public.transcript_words AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    file_id IS NULL
    OR (SELECT source FROM public.files WHERE id = file_id) IS DISTINCT FROM 'recording'
    OR public.user_has_tier(auth.uid(), 'midnight')
  );
