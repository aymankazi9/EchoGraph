-- Allow 'manual' as a fifth valid source value on keywords.
-- 'manual' = user-created card, entered directly through the Study tab form.
-- Manual keywords are never touched by rescore — the diff logic skips them
-- entirely (they are excluded from both existingByNorm and removedIds).
-- Existing rows are unaffected — this only widens the constraint.

ALTER TABLE public.keywords
  DROP CONSTRAINT IF EXISTS keywords_source_check;

ALTER TABLE public.keywords
  ADD CONSTRAINT keywords_source_check
    CHECK (source IN ('real_guide', 'synthetic', 'anki', 'both', 'manual'));
