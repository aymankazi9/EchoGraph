-- Adds normalized_term to keywords for stable identity across rescores.
-- Existing rows receive '' (empty string) as a placeholder; the client populates
-- the real value on the next rescore via the new upsert path.
--
-- A partial unique index enforces (session_id, normalized_term) uniqueness
-- only for rows that have been populated (normalized_term <> ''), so legacy
-- rows with '' do not conflict with each other.

ALTER TABLE public.keywords
  ADD COLUMN IF NOT EXISTS normalized_term text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS keywords_session_normalized_term_idx
  ON public.keywords (session_id, normalized_term)
  WHERE normalized_term <> '';

-- UPDATE policy for keywords: required for in-place score refresh during rescore.
CREATE POLICY "keywords: update own"
  ON public.keywords FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- UPDATE policy for flashcards: required for in-place front/back refresh.
-- (enhanceFlashcards already called .update() -- this makes RLS explicit.)
CREATE POLICY "flashcards: update own"
  ON public.flashcards FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Unique constraint on flashcards.keyword_id so we can upsert by keyword.
-- NULL values are treated as distinct in Postgres and do not violate this.
ALTER TABLE public.flashcards
  ADD CONSTRAINT flashcards_keyword_id_unique UNIQUE (keyword_id);
