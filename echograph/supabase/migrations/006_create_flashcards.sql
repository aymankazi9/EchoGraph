-- Flashcards generated from Red/Likely Zone keywords.
-- front_encrypted = keyword term (encrypted).
-- back_encrypted = transcript sentence + slide reference (encrypted).

CREATE TABLE IF NOT EXISTS public.flashcards (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword_id      uuid        REFERENCES public.keywords(id) ON DELETE SET NULL,
  front_encrypted text        NOT NULL,
  back_encrypted  text        NOT NULL,
  slide_index     integer,
  zone            text        NOT NULL CHECK (zone IN ('red', 'likely')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flashcards: select own"
  ON public.flashcards FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "flashcards: insert own"
  ON public.flashcards FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "flashcards: delete own"
  ON public.flashcards FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS flashcards_session_id_idx ON public.flashcards (session_id);
