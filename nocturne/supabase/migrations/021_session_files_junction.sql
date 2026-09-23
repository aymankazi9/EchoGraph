-- ── 1. Loosen files.session_id ───────────────────────────────────────────────
-- user_id stays NOT NULL — it remains the RLS ownership anchor.
-- session_id becomes nullable so a file can exist independently of any single
-- session (shared/reusable files set session_id = NULL; legacy rows keep their
-- existing value).

ALTER TABLE public.files
  ALTER COLUMN session_id DROP NOT NULL;

-- ── 2. session_files junction table ──────────────────────────────────────────
-- Links one file to one session with a named role and an explicit ordering.
-- A file may appear in multiple sessions; each membership is one row here.

CREATE TABLE IF NOT EXISTS public.session_files (
  session_id  uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  file_id     uuid        NOT NULL REFERENCES public.files(id)    ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('slide', 'audio', 'guide')),
  order_index integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, file_id)
);

-- Enforce at most one audio source per session.
CREATE UNIQUE INDEX IF NOT EXISTS session_files_one_audio_per_session
  ON public.session_files (session_id)
  WHERE role = 'audio';

CREATE INDEX IF NOT EXISTS session_files_file_id_idx
  ON public.session_files (file_id);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
-- A user can see a session_files row iff they own the session it belongs to.

ALTER TABLE public.session_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_files: select own"
  ON public.session_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_files.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "session_files: insert own"
  ON public.session_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_files.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "session_files: delete own"
  ON public.session_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_files.session_id
        AND s.user_id = auth.uid()
    )
  );

-- ── 4. Backfill ───────────────────────────────────────────────────────────────
-- Insert one session_files row for every existing files row that has a session_id.
-- Maps file_type → role:  pdf → slide, audio → audio, guide → guide.
-- order_index is the 0-based position within the same session + role, by upload time.
-- ON CONFLICT DO NOTHING is a safety net; the table is empty at this point.
-- If a session somehow had multiple audio files, only the earliest (by upload time)
-- satisfies the partial unique index; subsequent ones are silently skipped.

INSERT INTO public.session_files (session_id, file_id, role, order_index, created_at)
SELECT
  f.session_id,
  f.id,
  CASE f.file_type
    WHEN 'pdf'   THEN 'slide'
    WHEN 'audio' THEN 'audio'
    WHEN 'guide' THEN 'guide'
    ELSE              'slide'   -- unknown type treated as slide
  END AS role,
  (ROW_NUMBER() OVER (
    PARTITION BY
      f.session_id,
      CASE f.file_type
        WHEN 'pdf'   THEN 'slide'
        WHEN 'audio' THEN 'audio'
        WHEN 'guide' THEN 'guide'
        ELSE              'slide'
      END
    ORDER BY f.uploaded_at
  ) - 1) AS order_index,
  f.uploaded_at AS created_at
FROM public.files f
WHERE f.session_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 5. Storage-path note ──────────────────────────────────────────────────────
-- Existing files keep their legacy path: {userId}/{sessionId}/{fileId}.bin
-- New uploads (post-migration) use:      {userId}/sources/{fileId}.bin
-- Both formats are stored verbatim in files.storage_path — readers never
-- reconstruct the path; they always read the column.
-- The storage bucket policy checks name LIKE (auth.uid()::text || '/%') which
-- matches both schemes, so no RLS changes are needed.
