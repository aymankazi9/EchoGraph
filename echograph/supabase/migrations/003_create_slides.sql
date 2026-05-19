-- Per-page slide records for PDF text extraction.
-- density_score, is_red_zone, is_likely_zone are populated in Step 9.
CREATE TABLE IF NOT EXISTS public.slides (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  page_number     integer     NOT NULL,
  text_encrypted  text,
  density_score   real,
  is_red_zone     boolean     NOT NULL DEFAULT false,
  is_likely_zone  boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS slides_session_id_idx ON public.slides (session_id);

ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;

-- Users can only access slides belonging to their own sessions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'slides' AND policyname = 'Users manage own slides'
  ) THEN
    CREATE POLICY "Users manage own slides"
      ON public.slides
      FOR ALL
      USING (
        session_id IN (
          SELECT id FROM public.sessions WHERE user_id = auth.uid()
        )
      );
  END IF;
END
$$;
