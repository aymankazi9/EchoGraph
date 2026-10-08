-- 039_flashcards_enhanced_at.sql
-- Adds enhanced_at to flashcards so Claude enhancement is idempotent across
-- rescores and page reloads.
--
-- NULL  = not yet processed by enhanceFlashcards — eligible for enhancement.
-- non-NULL = Claude was called for this card; back_encrypted may be updated.
--
-- This lets enhanceFlashcards skip already-enhanced cards on a re-score and
-- allows a failed DB write to be retried on the next score without re-calling
-- Claude for the cards that already succeeded.

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS enhanced_at timestamptz;

COMMENT ON COLUMN public.flashcards.enhanced_at IS
  'Set when enhanceFlashcards successfully processed this card via Claude. '
  'NULL = eligible for enhancement or previous attempt failed.';
