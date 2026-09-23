-- Tier-aware RLS gates.
-- Uses AS RESTRICTIVE so these policies AND with existing permissive "own row" policies
-- rather than replacing them.
--
-- get_user_tier() is SECURITY DEFINER so it can read subscriptions regardless of
-- the calling user's RLS context. STABLE lets the planner cache it per query.

CREATE OR REPLACE FUNCTION public.get_user_tier()
RETURNS public.subscription_tier
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tier FROM public.subscriptions WHERE user_id = auth.uid()),
    'dusk'::public.subscription_tier
  )
$$;

-- ─── Midnight gates ──────────────────────────────────────────────────────────

CREATE POLICY "flashcard_reviews: midnight+"
  ON public.flashcard_reviews AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'midnight'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'midnight'::public.subscription_tier);

CREATE POLICY "session_notes: midnight+"
  ON public.session_notes AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'midnight'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'midnight'::public.subscription_tier);

CREATE POLICY "user_activity: midnight+"
  ON public.user_activity AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'midnight'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'midnight'::public.subscription_tier);

CREATE POLICY "momentum_ledger: midnight+"
  ON public.momentum_ledger AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'midnight'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'midnight'::public.subscription_tier);

CREATE POLICY "community_rooms: midnight+"
  ON public.community_rooms AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'midnight'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'midnight'::public.subscription_tier);

CREATE POLICY "room_memberships: midnight+"
  ON public.room_memberships AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'midnight'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'midnight'::public.subscription_tier);

CREATE POLICY "community_keyword_pool: midnight+"
  ON public.community_keyword_pool AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'midnight'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'midnight'::public.subscription_tier);

CREATE POLICY "community_threads: midnight+"
  ON public.community_threads AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'midnight'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'midnight'::public.subscription_tier);

CREATE POLICY "community_replies: midnight+"
  ON public.community_replies AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'midnight'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'midnight'::public.subscription_tier);

CREATE POLICY "shared_decks: midnight+"
  ON public.shared_decks AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'midnight'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'midnight'::public.subscription_tier);

CREATE POLICY "room_presence: midnight+"
  ON public.room_presence AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'midnight'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'midnight'::public.subscription_tier);

-- ─── Eclipse gates ───────────────────────────────────────────────────────────

CREATE POLICY "ask_conversations: eclipse+"
  ON public.ask_conversations AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'eclipse'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'eclipse'::public.subscription_tier);

CREATE POLICY "ask_messages: eclipse+"
  ON public.ask_messages AS RESTRICTIVE
  USING     (public.get_user_tier() >= 'eclipse'::public.subscription_tier)
  WITH CHECK (public.get_user_tier() >= 'eclipse'::public.subscription_tier);
