-- Flashcard review history for SM-2 spaced repetition.
-- One row per review event. Latest row per flashcard_id determines next due_at.

CREATE TABLE IF NOT EXISTS public.flashcard_reviews (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id  uuid        NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating        text        NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  ease_factor   real        NOT NULL DEFAULT 2.5,
  interval_days integer     NOT NULL DEFAULT 1,
  due_at        timestamptz NOT NULL,
  reviewed_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flashcard_reviews: select own"
  ON public.flashcard_reviews FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "flashcard_reviews: insert own"
  ON public.flashcard_reviews FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS flashcard_reviews_user_flashcard_idx
  ON public.flashcard_reviews (user_id, flashcard_id, reviewed_at DESC);
