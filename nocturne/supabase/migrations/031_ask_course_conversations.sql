-- 031: Course-scoped Ask conversations.
--
-- ask_conversations currently require a session_id (per-session scope).
-- This migration extends the table so a row can instead be course-scoped:
--   session_id IS NOT NULL → existing per-session conversations (unchanged)
--   course_id  IS NOT NULL → new per-course conversations
--
-- A CHECK constraint ensures exactly one scope column is set per row.
-- Existing RLS policies (user_id = auth.uid()) already cover both cases.

ALTER TABLE public.ask_conversations
  ALTER COLUMN session_id DROP NOT NULL;

ALTER TABLE public.ask_conversations
  ADD COLUMN IF NOT EXISTS course_id uuid
    REFERENCES public.courses(id) ON DELETE CASCADE;

ALTER TABLE public.ask_conversations
  ADD CONSTRAINT ask_conversations_scope_check CHECK (
    (session_id IS NOT NULL AND course_id IS NULL) OR
    (session_id IS NULL     AND course_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS ask_conversations_course_id_idx
  ON public.ask_conversations (course_id);
