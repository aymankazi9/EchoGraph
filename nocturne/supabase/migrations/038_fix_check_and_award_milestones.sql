-- 038_fix_check_and_award_milestones.sql
-- Fixes check_and_award_milestones() to use course_id instead of course_tag.
--
-- Migration 030 (030_courses_table.sql) dropped sessions.course_tag and replaced
-- it with a course_id FK to public.courses, but the four references to course_tag
-- in check_and_award_milestones were never updated.  Since migration 030 was
-- applied, every INSERT on sessions/flashcard_reviews/user_activity has fired
-- this function and thrown:
--   ERROR 42703: column s.course_tag does not exist
-- rolling back the entire insert.  Sessions could not be created, flashcard
-- reviews could not be persisted, and activity records were discarded.
--
-- Fix: replace all four course_tag references in the mastered-subjects subquery
-- with course_id.  No other logic is changed.

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

  -- Mastered subjects: courses (via course_id) where >= 80% of flashcards reviewed
  SELECT COUNT(DISTINCT sub.course_id) INTO v_mastered_subjects FROM (
    SELECT s.course_id,
           COUNT(DISTINCT fc.id)           AS total_cards,
           COUNT(DISTINCT fr.flashcard_id) AS reviewed_cards
    FROM public.sessions s
    LEFT JOIN public.flashcards fc ON fc.session_id = s.id
    LEFT JOIN public.flashcard_reviews fr
           ON fr.flashcard_id = fc.id AND fr.user_id = p_user_id
    WHERE s.user_id = p_user_id AND s.course_id IS NOT NULL
    GROUP BY s.course_id
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
