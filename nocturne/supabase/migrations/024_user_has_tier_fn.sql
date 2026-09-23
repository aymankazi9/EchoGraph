-- Introduce public.user_has_tier(uid, required_tier) as the single source of
-- truth for tier checks at the database layer.
--
-- Mirrors the TIER_ORDINAL / hasAccess discipline already in lib/tiers/features.ts
-- on the client side: one function, one place to change if tiers ever expand.
--
-- get_user_tier() is preserved — it returns the caller's tier value and is still
-- useful for code that needs to inspect the tier rather than gate on it.
--
-- All 13 restrictive policies from 018_rls_tier_gates.sql are replaced to call
-- user_has_tier(auth.uid(), ...) instead of inlining the ENUM comparison.

-- ─── Core function ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_has_tier(
  uid           uuid,
  required_tier public.subscription_tier
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tier >= required_tier FROM public.subscriptions WHERE user_id = uid),
    'dusk'::public.subscription_tier >= required_tier
  )
$$;

-- ─── Retrofit midnight-gated policies ────────────────────────────────────────
-- Drop and recreate each policy from 018 to call user_has_tier() instead of
-- inlining the ENUM comparison. Semantics are identical; call site is unified.

DROP POLICY IF EXISTS "flashcard_reviews: midnight+" ON public.flashcard_reviews;
CREATE POLICY "flashcard_reviews: midnight+"
  ON public.flashcard_reviews AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'midnight'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'midnight'));

DROP POLICY IF EXISTS "session_notes: midnight+" ON public.session_notes;
CREATE POLICY "session_notes: midnight+"
  ON public.session_notes AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'midnight'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'midnight'));

DROP POLICY IF EXISTS "user_activity: midnight+" ON public.user_activity;
CREATE POLICY "user_activity: midnight+"
  ON public.user_activity AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'midnight'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'midnight'));

DROP POLICY IF EXISTS "momentum_ledger: midnight+" ON public.momentum_ledger;
CREATE POLICY "momentum_ledger: midnight+"
  ON public.momentum_ledger AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'midnight'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'midnight'));

DROP POLICY IF EXISTS "community_rooms: midnight+" ON public.community_rooms;
CREATE POLICY "community_rooms: midnight+"
  ON public.community_rooms AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'midnight'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'midnight'));

DROP POLICY IF EXISTS "room_memberships: midnight+" ON public.room_memberships;
CREATE POLICY "room_memberships: midnight+"
  ON public.room_memberships AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'midnight'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'midnight'));

DROP POLICY IF EXISTS "community_keyword_pool: midnight+" ON public.community_keyword_pool;
CREATE POLICY "community_keyword_pool: midnight+"
  ON public.community_keyword_pool AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'midnight'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'midnight'));

DROP POLICY IF EXISTS "community_threads: midnight+" ON public.community_threads;
CREATE POLICY "community_threads: midnight+"
  ON public.community_threads AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'midnight'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'midnight'));

DROP POLICY IF EXISTS "community_replies: midnight+" ON public.community_replies;
CREATE POLICY "community_replies: midnight+"
  ON public.community_replies AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'midnight'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'midnight'));

DROP POLICY IF EXISTS "shared_decks: midnight+" ON public.shared_decks;
CREATE POLICY "shared_decks: midnight+"
  ON public.shared_decks AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'midnight'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'midnight'));

DROP POLICY IF EXISTS "room_presence: midnight+" ON public.room_presence;
CREATE POLICY "room_presence: midnight+"
  ON public.room_presence AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'midnight'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'midnight'));

-- ─── Retrofit eclipse-gated policies ─────────────────────────────────────────

DROP POLICY IF EXISTS "ask_conversations: eclipse+" ON public.ask_conversations;
CREATE POLICY "ask_conversations: eclipse+"
  ON public.ask_conversations AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'eclipse'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'eclipse'));

DROP POLICY IF EXISTS "ask_messages: eclipse+" ON public.ask_messages;
CREATE POLICY "ask_messages: eclipse+"
  ON public.ask_messages AS RESTRICTIVE
  USING     (public.user_has_tier(auth.uid(), 'eclipse'))
  WITH CHECK (public.user_has_tier(auth.uid(), 'eclipse'));

-- ─── New: session_files audio gate ───────────────────────────────────────────
-- Dusk users can insert slide and guide rows freely; only audio requires Midnight+.
-- Phrased as a restrictive policy that passes for any non-audio role, so ordinary
-- PDF/guide uploads are unaffected.

CREATE POLICY "session_files: audio requires midnight+"
  ON public.session_files AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    role <> 'audio'
    OR public.user_has_tier(auth.uid(), 'midnight')
  );

-- ─── New: storage gate for live-recording audio ───────────────────────────────
-- addFilesToExistingSession writes audio from Record Live to the path
-- {uid}/recordings/{fileId}.bin (a distinct prefix from initial-ingest files at
-- {uid}/sources/{fileId}.bin).  This policy requires Midnight+ for any INSERT
-- into that prefix while leaving all other paths unrestricted.

CREATE POLICY "nocturne-files: recordings require midnight+"
  ON storage.objects AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'nocturne-files'
    AND (
      name NOT LIKE (auth.uid()::text || '/recordings/%')
      OR public.user_has_tier(auth.uid(), 'midnight')
    )
  );
