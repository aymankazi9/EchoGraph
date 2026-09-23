-- Append-only snapshot table for session notes.
--
-- content_encrypted matches session_notes format ("ctB64:ivB64") — the IV is
-- embedded in the ciphertext string so the iv column stays NULL (same as
-- session_notes; reserved for a future encryption format migration).
--
-- kind distinguishes automatic throttled snapshots ('auto') from snapshots
-- taken when the user applies an AI-generated note ('generate').  These are
-- surfaced differently in the restore UI.
--
-- Growth note: the client queries with LIMIT 30 and never actively prunes, so
-- rows accumulate slowly.  A future housekeeping function can trim to the
-- newest N per session_id if storage becomes a concern.

CREATE TABLE IF NOT EXISTS public.session_notes_versions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  content_encrypted text        NOT NULL,
  iv                text,
  kind              text        NOT NULL DEFAULT 'auto'
                                CHECK (kind IN ('auto', 'generate')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_notes_versions ENABLE ROW LEVEL SECURITY;

-- Append-only from the client: SELECT + INSERT only, no UPDATE or DELETE.
CREATE POLICY "session_notes_versions: select own"
  ON public.session_notes_versions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "session_notes_versions: insert own"
  ON public.session_notes_versions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Ordered fetch by session, most-recent first.
CREATE INDEX IF NOT EXISTS session_notes_versions_session_created_idx
  ON public.session_notes_versions (session_id, created_at DESC);
