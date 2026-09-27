-- 032: Quiz attempts — separate from flashcard_reviews (SRS scheduling).
--
-- Each row records one answer in a generated MCQ quiz.
-- Exactly one scope column is non-null per row (session_id OR course_id).
-- The selected_option text is stored in plaintext (it's an LLM-generated
-- distractor string, not user-authored content — no encryption needed).

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  flashcard_id     uuid        NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  session_id       uuid                 REFERENCES public.sessions(id)  ON DELETE CASCADE,
  course_id        uuid                 REFERENCES public.courses(id)   ON DELETE CASCADE,
  selected_option  text        NOT NULL,
  correct          boolean     NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quiz_attempts_scope_check CHECK (
    (session_id IS NOT NULL AND course_id IS NULL) OR
    (session_id IS NULL     AND course_id IS NOT NULL)
  )
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_attempts: select own"
  ON public.quiz_attempts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "quiz_attempts: insert own"
  ON public.quiz_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS quiz_attempts_user_session_idx
  ON public.quiz_attempts (user_id, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS quiz_attempts_user_course_idx
  ON public.quiz_attempts (user_id, course_id, created_at DESC);

CREATE INDEX IF NOT EXISTS quiz_attempts_flashcard_idx
  ON public.quiz_attempts (user_id, flashcard_id, created_at DESC);
