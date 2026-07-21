-- Allow 'both' as a fourth valid source value on keywords.
-- 'both' = term appeared in the user's study guide AND was independently
-- identified as important from the lecture content by the LLM extractor.
-- Existing rows are unaffected — this only widens the constraint.

ALTER TABLE public.keywords
  DROP CONSTRAINT IF EXISTS keywords_source_check;

ALTER TABLE public.keywords
  ADD CONSTRAINT keywords_source_check
    CHECK (source IN ('real_guide', 'synthetic', 'anki', 'both'));
