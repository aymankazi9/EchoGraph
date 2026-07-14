-- Milestone definitions (static reference) and per-user earned records.
-- check_and_award_milestones() is called by the activity + flashcard triggers
-- defined in 013_momentum_tracking.sql; those functions are replaced here
-- to include the milestone check.

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.milestone_definitions (
  id              text    PRIMARY KEY,
  title           text    NOT NULL,
  description     text    NOT NULL,
  icon            text    NOT NULL,
  color           text    NOT NULL,
  condition_type  text    NOT NULL,  -- streak | sessions | cards | subjects_mastered
  condition_value integer NOT NULL
);

ALTER TABLE public.milestone_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestone_definitions: select authenticated"
  ON public.milestone_definitions FOR SELECT
  TO authenticated
  USING (true);

-- Seed milestone definitions
INSERT INTO public.milestone_definitions (id, title, description, icon, color, condition_type, condition_value)
VALUES
  ('streak_14',        'Two-week warrior',       '14 day streak',                   'flame',  '251,191,36',  'streak',            14),
  ('subject_mastered', 'First subject mastered', 'One course at 80%+ card mastery', 'target', '45,212,191',  'subjects_mastered', 1),
  ('sessions_25',      '25 lectures captured',   '25 sessions in your vault',       'stack',  '99,102,241',  'sessions',          25),
  ('cards_500',        '500 cards drilled',      '500 flashcard reviews completed', 'cards',  '139,92,246',  'cards',             500),
  ('subjects_3',       'Course conqueror',        '3 subjects at 80%+ mastery',      'trophy', '244,63,94',   'subjects_mastered', 3)
ON CONFLICT (id) DO NOTHING;

-- Earned milestones per user
CREATE TABLE IF NOT EXISTS public.user_milestones (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id text        NOT NULL REFERENCES public.milestone_definitions(id),
  earned_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, milestone_id)
);

ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_milestones: select own"
  ON public.user_milestones FOR SELECT
  USING (user_id = auth.uid());

-- ── Function: check and award milestones ──────────────────────────────────────
-- Called after every flashcard review and user_activity upsert.

CREATE OR REPLACE FUNCTION public.check_and_award_milestones(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session_count     integer := 0;
  v_card_count        integer := 0;
  v_current_streak    integer := 0;
  v_mastered_subjects integer := 0;
BEGIN
  -- Session count
  SELECT COUNT(*) INTO v_session_count
  FROM public.sessions WHERE user_id = p_user_id;

  -- Card review count
  SELECT COUNT(*) INTO v_card_count
  FROM public.flashcard_reviews WHERE user_id = p_user_id;

  -- Current streak (consecutive active days ending today or yesterday)
  WITH daily AS (
    SELECT DISTINCT date FROM public.user_activity
    WHERE user_id = p_user_id AND (sessions_played > 0 OR cards_reviewed > 0)
  ),
  numbered AS (
    SELECT date, date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp
    FROM daily
  ),
  groups AS (
    SELECT grp, COUNT(*)::integer AS len, MAX(date) AS last_day
    FROM numbered GROUP BY grp
  )
  SELECT COALESCE(len, 0) INTO v_current_streak
  FROM groups
  WHERE last_day >= CURRENT_DATE - 1
  ORDER BY last_day DESC LIMIT 1;

  v_current_streak := COALESCE(v_current_streak, 0);

  -- Mastered subjects: course_tag where >= 80% of flashcards have been reviewed
  SELECT COUNT(DISTINCT sub.course_tag) INTO v_mastered_subjects FROM (
    SELECT s.course_tag,
           COUNT(DISTINCT fc.id)           AS total_cards,
           COUNT(DISTINCT fr.flashcard_id) AS reviewed_cards
    FROM public.sessions s
    LEFT JOIN public.flashcards fc ON fc.session_id = s.id
    LEFT JOIN public.flashcard_reviews fr
           ON fr.flashcard_id = fc.id AND fr.user_id = p_user_id
    WHERE s.user_id = p_user_id AND s.course_tag IS NOT NULL
    GROUP BY s.course_tag
    HAVING COUNT(DISTINCT fc.id) > 0
       AND COUNT(DISTINCT fr.flashcard_id)::float
           / NULLIF(COUNT(DISTINCT fc.id), 0) >= 0.8
  ) sub;

  -- Award milestones (ON CONFLICT DO NOTHING = idempotent)
  IF v_current_streak >= 14 THEN
    INSERT INTO public.user_milestones (user_id, milestone_id)
    VALUES (p_user_id, 'streak_14') ON CONFLICT DO NOTHING;
  END IF;

  IF v_mastered_subjects >= 1 THEN
    INSERT INTO public.user_milestones (user_id, milestone_id)
    VALUES (p_user_id, 'subject_mastered') ON CONFLICT DO NOTHING;
  END IF;

  IF v_session_count >= 25 THEN
    INSERT INTO public.user_milestones (user_id, milestone_id)
    VALUES (p_user_id, 'sessions_25') ON CONFLICT DO NOTHING;
  END IF;

  IF v_card_count >= 500 THEN
    INSERT INTO public.user_milestones (user_id, milestone_id)
    VALUES (p_user_id, 'cards_500') ON CONFLICT DO NOTHING;
  END IF;

  IF v_mastered_subjects >= 3 THEN
    INSERT INTO public.user_milestones (user_id, milestone_id)
    VALUES (p_user_id, 'subjects_3') ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- ── Update trigger functions to include milestone check ───────────────────────

CREATE OR REPLACE FUNCTION public.on_flashcard_review_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.accrue_momentum(NEW.user_id, 2, 'card_reviewed');
  PERFORM public.upsert_user_activity_internal(NEW.user_id, CURRENT_DATE, 0, 1);
  PERFORM public.check_and_award_milestones(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_user_activity_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_sessions integer := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.accrue_momentum(NEW.user_id, 10, 'active_day');
    v_new_sessions := COALESCE(NEW.sessions_played, 0);
  ELSIF TG_OP = 'UPDATE' THEN
    v_new_sessions := COALESCE(NEW.sessions_played, 0) - COALESCE(OLD.sessions_played, 0);
  END IF;

  IF v_new_sessions > 0 THEN
    PERFORM public.accrue_momentum(NEW.user_id, 25 * v_new_sessions, 'session_completed');
  END IF;

  PERFORM public.check_and_award_milestones(NEW.user_id);
  RETURN NEW;
END;
$$;

-- Trigger on sessions INSERT: check "25 lectures captured" immediately.
CREATE OR REPLACE FUNCTION public.on_session_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.check_and_award_milestones(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_milestone_check ON public.sessions;
CREATE TRIGGER trg_session_milestone_check
  AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.on_session_insert();
