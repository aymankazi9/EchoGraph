-- Keywords extracted from study guide (real, anki) or synthetic TF-IDF.
-- term_encrypted is AES-GCM encrypted — server never sees plaintext.
-- slide_indices is an integer array of 1-based page_numbers where keyword appears.

CREATE TABLE IF NOT EXISTS public.keywords (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term_encrypted    text        NOT NULL,
  source            text        NOT NULL CHECK (source IN ('real_guide', 'synthetic', 'anki')),
  zone              text        NOT NULL CHECK (zone IN ('red', 'likely')),
  confidence_score  real        NOT NULL DEFAULT 0,
  mention_count     integer     NOT NULL DEFAULT 0,
  dwell_time_ms     integer     NOT NULL DEFAULT 0,
  emphasis_score    real        NOT NULL DEFAULT 0,
  lecture_confidence real       NOT NULL DEFAULT 0,
  slide_indices     integer[]   NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "keywords: select own"
  ON public.keywords FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "keywords: insert own"
  ON public.keywords FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "keywords: delete own"
  ON public.keywords FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS keywords_session_id_idx ON public.keywords (session_id);
