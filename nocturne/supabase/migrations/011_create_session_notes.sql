-- One note document per session. content_encrypted uses encryptText() format:
-- "ctB64:ivB64" — the IV is embedded in the ciphertext string, so the iv column
-- is reserved for future use and will remain NULL when written by the current client.

CREATE TABLE IF NOT EXISTS public.session_notes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_encrypted text        NOT NULL DEFAULT '',
  iv                text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_notes: select own"
  ON public.session_notes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "session_notes: insert own"
  ON public.session_notes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "session_notes: update own"
  ON public.session_notes FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "session_notes: delete own"
  ON public.session_notes FOR DELETE
  USING (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS session_notes_session_id_idx
  ON public.session_notes (session_id);
