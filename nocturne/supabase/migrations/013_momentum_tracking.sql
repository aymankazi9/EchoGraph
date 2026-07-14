-- Momentum tracking: activity log, points ledger, and course grouping.
-- All write paths go through SECURITY DEFINER functions that use auth.uid()
-- so callers cannot impersonate another user.

-- ── Schema additions ──────────────────────────────────────────────────────────

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS course_tag text;
ALTER TABLE public.users    ADD COLUMN IF NOT EXISTS momentum_points integer NOT NULL DEFAULT 0;

-- ── Tables ────────────────────────────────────────────────────────────────────

-- One row per user per calendar day. PK enforces uniqueness.
CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id         uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            date    NOT NULL,
  sessions_played integer NOT NULL DEFAULT 0,
  cards_reviewed  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- Append-only audit log. Points never silently disappear.
CREATE TABLE IF NOT EXISTS public.momentum_ledger (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta       integer     NOT NULL,
  reason      text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_activity   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_ledger ENABLE ROW LEVEL SECURITY;

-- SELECT only — all writes go through SECURITY DEFINER functions.
CREATE POLICY "user_activity: select own"
  ON public.user_activity FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "momentum_ledger: select own"
  ON public.momentum_ledger FOR SELECT USING (user_id = auth.uid());

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS user_activity_user_date_idx
  ON public.user_activity (user_id, date DESC);

CREATE INDEX IF NOT EXISTS momentum_ledger_user_created_idx
  ON public.momentum_ledger (user_id, created_at DESC);

-- ── Internal helper: write a ledger row + update balance ─────────────────────
-- Called only by other SECURITY DEFINER functions / triggers.

CREATE OR REPLACE FUNCTION public.accrue_momentum(
  p_user_id uuid,
  p_delta   integer,
  p_reason  text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.momentum_ledger (user_id, delta, reason)
  VALUES (p_user_id, p_delta, p_reason);

  UPDATE public.users
  SET momentum_points = GREATEST(0, momentum_points + p_delta)
  WHERE id = p_user_id;
END;
$$;

-- ── Client-callable: atomically deduct points for a redemption ───────────────
-- Uses auth.uid() — callers cannot pass another user's ID.

CREATE OR REPLACE FUNCTION public.redeem_momentum(p_cost integer, p_reason text)
RETURNS TABLE(success boolean, new_balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_new_balance integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  UPDATE public.users
  SET momentum_points = momentum_points - p_cost
  WHERE id = v_uid AND momentum_points >= p_cost
  RETURNING momentum_points INTO v_new_balance;

  IF FOUND THEN
    INSERT INTO public.momentum_ledger (user_id, delta, reason)
    VALUES (v_uid, -p_cost, p_reason);
    RETURN QUERY SELECT true, v_new_balance;
  ELSE
    RETURN QUERY SELECT false,
      (SELECT momentum_points FROM public.users WHERE id = v_uid);
  END IF;
END;
$$;

-- ── Client-callable: upsert a day's activity counters ────────────────────────
-- Uses auth.uid(). Called from the browser when audio first plays or after a card review.

CREATE OR REPLACE FUNCTION public.upsert_user_activity(
  p_date            date,
  p_sessions_delta  integer DEFAULT 0,
  p_cards_delta     integer DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  INSERT INTO public.user_activity (user_id, date, sessions_played, cards_reviewed)
  VALUES (v_uid, p_date, p_sessions_delta, p_cards_delta)
  ON CONFLICT (user_id, date) DO UPDATE
  SET
    sessions_played = public.user_activity.sessions_played + EXCLUDED.sessions_played,
    cards_reviewed  = public.user_activity.cards_reviewed  + EXCLUDED.cards_reviewed;
END;
$$;

-- ── Internal: called by triggers with explicit user_id ───────────────────────

CREATE OR REPLACE FUNCTION public.upsert_user_activity_internal(
  p_user_id         uuid,
  p_date            date,
  p_sessions_delta  integer DEFAULT 0,
  p_cards_delta     integer DEFAULT 0
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_activity (user_id, date, sessions_played, cards_reviewed)
  VALUES (p_user_id, p_date, p_sessions_delta, p_cards_delta)
  ON CONFLICT (user_id, date) DO UPDATE
  SET
    sessions_played = public.user_activity.sessions_played + EXCLUDED.sessions_played,
    cards_reviewed  = public.user_activity.cards_reviewed  + EXCLUDED.cards_reviewed;
END;
$$;

-- ── Trigger: flashcard_reviews INSERT ────────────────────────────────────────
-- Accrues 2 pts per review and increments the day's cards_reviewed counter.

CREATE OR REPLACE FUNCTION public.on_flashcard_review_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.accrue_momentum(NEW.user_id, 2, 'card_reviewed');
  PERFORM public.upsert_user_activity_internal(NEW.user_id, CURRENT_DATE, 0, 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flashcard_review_accrue ON public.flashcard_reviews;
CREATE TRIGGER trg_flashcard_review_accrue
  AFTER INSERT ON public.flashcard_reviews
  FOR EACH ROW EXECUTE FUNCTION public.on_flashcard_review_insert();

-- ── Trigger: user_activity INSERT / UPDATE ───────────────────────────────────
-- INSERT (new active day): +10 pts.
-- sessions_played increase: +25 pts per new session.

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_activity_momentum ON public.user_activity;
CREATE TRIGGER trg_user_activity_momentum
  AFTER INSERT OR UPDATE ON public.user_activity
  FOR EACH ROW EXECUTE FUNCTION public.on_user_activity_change();
