-- ─── 030_courses_table.sql ───────────────────────────────────────────────────
-- Promotes sessions.course_tag (free-text string) to a first-class courses
-- table with id, name, and exam_date.  Existing sessions are backfilled to
-- point at their migrated courses row via the new course_id FK, then the
-- now-redundant course_tag column is dropped.

-- ── 1. Create courses table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.courses (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  exam_date  date,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One course name per user — prevents duplicates when backfilling or when
  -- the picker upserts on conflict.
  CONSTRAINT courses_user_name_unique UNIQUE (user_id, name)
);

-- ── 2. RLS: users can only see and modify their own courses ───────────────────

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses: own rows"
  ON public.courses
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 3. Add course_id FK to sessions ──────────────────────────────────────────
-- ON DELETE SET NULL: deleting a course un-tags its sessions rather than
-- cascading deletion (session data is too valuable to lose over a label).

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS course_id uuid
    REFERENCES public.courses(id) ON DELETE SET NULL;

-- ── 4. Backfill ───────────────────────────────────────────────────────────────
-- a) One courses row per distinct (user_id, course_tag) combination.
-- b) Wire each session's course_id to the matching courses row.
-- Both steps are idempotent (ON CONFLICT DO NOTHING / SET only when NULL).

DO $$
BEGIN
  -- 4a. Seed courses from existing tags
  INSERT INTO public.courses (user_id, name, created_at)
  SELECT DISTINCT user_id, course_tag, now()
  FROM   public.sessions
  WHERE  course_tag IS NOT NULL
  ON CONFLICT (user_id, name) DO NOTHING;

  -- 4b. Wire sessions to their new courses row
  UPDATE public.sessions s
  SET    course_id = c.id
  FROM   public.courses c
  WHERE  s.user_id  = c.user_id
    AND  s.course_tag = c.name
    AND  s.course_tag IS NOT NULL;
END $$;

-- ── 5. Drop the now-redundant column ─────────────────────────────────────────

ALTER TABLE public.sessions DROP COLUMN IF EXISTS course_tag;
