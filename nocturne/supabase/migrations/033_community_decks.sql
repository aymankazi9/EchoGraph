-- 033: community_decks — normalized room-shared flashcard decks.
--
-- Replaces the informal shared_decks (jsonb terms, anonymous publisher_hash)
-- with a proper normalized table that:
--   • stores publisher_user_id as a real UUID (publishing is explicit and attributed)
--   • keeps cards in a separate community_deck_cards table with a zone column
--   • widens keyword.source to include 'imported' (for vault-import attribution)
--
-- shared_decks is preserved for backward compatibility (existing published decks).
-- New publishes go into community_decks; GET /api/community/deck prefers community_decks.

-- ── Widen keyword source ──────────────────────────────────────────────────────

ALTER TABLE public.keywords DROP CONSTRAINT IF EXISTS keywords_source_check;
ALTER TABLE public.keywords ADD CONSTRAINT keywords_source_check
  CHECK (source IN ('real_guide', 'synthetic', 'anki', 'both', 'manual', 'imported'));

-- ── community_decks ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_decks (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           uuid        NOT NULL REFERENCES public.community_rooms(room_id)  ON DELETE CASCADE,
  publisher_user_id uuid        NOT NULL REFERENCES auth.users(id)                   ON DELETE CASCADE,
  session_id        uuid                 REFERENCES public.sessions(id)              ON DELETE SET NULL,
  title             text        NOT NULL,
  card_count        integer     NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_decks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (deck content is voluntarily made public)
CREATE POLICY "community_decks: read all"
  ON public.community_decks FOR SELECT TO authenticated USING (true);

CREATE POLICY "community_decks: delete own"
  ON public.community_decks FOR DELETE
  USING (publisher_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS community_decks_room_idx
  ON public.community_decks (room_id, created_at DESC);

-- ── community_deck_cards ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_deck_cards (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.community_decks(id) ON DELETE CASCADE,
  front   text NOT NULL,
  back    text NOT NULL,
  zone    text NOT NULL CHECK (zone IN ('red', 'likely'))
);

ALTER TABLE public.community_deck_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_deck_cards: read all"
  ON public.community_deck_cards FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS community_deck_cards_deck_idx
  ON public.community_deck_cards (deck_id);

-- ── publish_community_deck ────────────────────────────────────────────────────
-- Verifies room membership (via hash), inserts deck + cards atomically.
-- SECURITY DEFINER so it can bypass RLS on community_deck_cards insert.

CREATE OR REPLACE FUNCTION public.publish_community_deck(
  p_room_id    uuid,
  p_session_id uuid,
  p_title      text,
  p_cards      jsonb    -- [{front: text, back: text, zone: text}]
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_hash  text;
  v_id    uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  IF p_cards IS NULL OR jsonb_array_length(p_cards) = 0 THEN RETURN NULL; END IF;

  v_hash := public.compute_member_hash(p_room_id);

  -- Must be a room member
  IF NOT EXISTS (
    SELECT 1 FROM public.room_memberships
    WHERE user_id_hash = v_hash AND room_id = p_room_id
  ) THEN RETURN NULL; END IF;

  INSERT INTO public.community_decks
    (room_id, publisher_user_id, session_id, title, card_count)
  VALUES
    (p_room_id, v_uid, p_session_id, trim(p_title), jsonb_array_length(p_cards))
  RETURNING id INTO v_id;

  INSERT INTO public.community_deck_cards (deck_id, front, back, zone)
  SELECT
    v_id,
    card->>'front',
    card->>'back',
    COALESCE(card->>'zone', 'likely')
  FROM jsonb_array_elements(p_cards) AS card;

  RETURN v_id;
END;
$$;

-- ── get_joined_rooms ──────────────────────────────────────────────────────────
-- Returns rooms the calling user is a member of.
-- Used by the PublishDeckModal to populate the room selector.

CREATE OR REPLACE FUNCTION public.get_joined_rooms()
RETURNS TABLE(room_id uuid, display_name text, course_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cr.room_id, cr.display_name, cr.course_code
  FROM   public.community_rooms  cr
  JOIN   public.room_memberships rm ON rm.room_id = cr.room_id
  WHERE  rm.user_id_hash = public.compute_member_hash(cr.room_id)
  ORDER  BY cr.display_name;
$$;
