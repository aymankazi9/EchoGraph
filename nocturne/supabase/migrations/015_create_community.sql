-- Community: anonymous course rooms with privacy-preserving keyword pooling.
--
-- Privacy model:
--   • Membership is stored as SHA-256(user_id:room_id) — room never sees real UUID.
--   • Keyword counts are stored as SHA-256(room_id:normalized_term) — server never sees plaintext terms.
--   • Shared decks are plaintext; publishing is a voluntary, explicit act by a room member.
--   • Threads/replies are community-authored plaintext, attributed only via author_hash.
--
-- All client-side hashes use Web Crypto (SHA-256, UTF-8 input, hex output).
-- All server-side hashes use pgcrypto (same algorithm/encoding — outputs must match).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Institution domain allowlist ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.institution_domains (
  institution_id text PRIMARY KEY,   -- e.g., 'ucsd.edu'
  display_name   text NOT NULL,
  email_suffix   text NOT NULL        -- e.g., '@ucsd.edu'
);

ALTER TABLE public.institution_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "institution_domains: read all"
  ON public.institution_domains FOR SELECT TO authenticated USING (true);

INSERT INTO public.institution_domains (institution_id, display_name, email_suffix) VALUES
  ('ucsd.edu',      'UC San Diego',     '@ucsd.edu'),
  ('ucla.edu',      'UCLA',             '@ucla.edu'),
  ('berkeley.edu',  'UC Berkeley',      '@berkeley.edu'),
  ('mit.edu',       'MIT',              '@mit.edu'),
  ('stanford.edu',  'Stanford',         '@stanford.edu')
ON CONFLICT DO NOTHING;

-- ── Community rooms ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_rooms (
  room_id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code    text        NOT NULL,
  institution_id text        NOT NULL REFERENCES public.institution_domains(institution_id),
  display_name   text        NOT NULL,
  member_count   integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_code, institution_id)
);

ALTER TABLE public.community_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_rooms: read all"
  ON public.community_rooms FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS community_rooms_institution_idx
  ON public.community_rooms (institution_id, course_code);

-- Seed a few rooms so the discover section is non-empty
INSERT INTO public.community_rooms (course_code, institution_id, display_name) VALUES
  ('BIBC 102',  'ucsd.edu', 'Biochemistry — BIBC 102 · UCSD'),
  ('CHEM 6B',   'ucsd.edu', 'Organic Chemistry II — CHEM 6B · UCSD'),
  ('COGS 107B', 'ucsd.edu', 'Computational Models — COGS 107B · UCSD'),
  ('BICD 100',  'ucsd.edu', 'Genetics — BICD 100 · UCSD'),
  ('MATH 20D',  'ucsd.edu', 'Differential Equations — MATH 20D · UCSD')
ON CONFLICT DO NOTHING;

-- ── Room memberships ──────────────────────────────────────────────────────────
-- user_id_hash = SHA-256(user_id:room_id); identity is opaque to the server.

CREATE TABLE IF NOT EXISTS public.room_memberships (
  user_id_hash text        NOT NULL,
  room_id      uuid        NOT NULL REFERENCES public.community_rooms(room_id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id_hash, room_id)
);

ALTER TABLE public.room_memberships ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read membership lists (hashes are opaque)
CREATE POLICY "room_memberships: read all"
  ON public.room_memberships FOR SELECT TO authenticated USING (true);

-- Writes only through SECURITY DEFINER functions below

-- ── Community keyword pool ────────────────────────────────────────────────────
-- term_hash = SHA-256(room_id:normalized_term); server never learns plaintext.

CREATE TABLE IF NOT EXISTS public.community_keyword_pool (
  room_id    uuid        NOT NULL REFERENCES public.community_rooms(room_id) ON DELETE CASCADE,
  term_hash  text        NOT NULL,
  count      integer     NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, term_hash)
);

ALTER TABLE public.community_keyword_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_keyword_pool: read all"
  ON public.community_keyword_pool FOR SELECT TO authenticated USING (true);

-- Writes only through the API route (membership-gated)

CREATE INDEX IF NOT EXISTS community_keyword_pool_room_count_idx
  ON public.community_keyword_pool (room_id, count DESC);

-- ── Community threads ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_threads (
  thread_id   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid        NOT NULL REFERENCES public.community_rooms(room_id) ON DELETE CASCADE,
  author_hash text        NOT NULL,  -- SHA-256(user_id:room_id)
  title       text        NOT NULL,
  reply_count integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_replies (
  reply_id    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid        NOT NULL REFERENCES public.community_threads(thread_id) ON DELETE CASCADE,
  author_hash text        NOT NULL,
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_threads: read all"  ON public.community_threads FOR SELECT TO authenticated USING (true);
CREATE POLICY "community_replies: read all"  ON public.community_replies FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS community_threads_room_idx ON public.community_threads (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_replies_thread_idx ON public.community_replies (thread_id, created_at);

-- ── Shared decks ──────────────────────────────────────────────────────────────
-- Plaintext by design — publishing a shared deck is an explicit, voluntary act.

CREATE TABLE IF NOT EXISTS public.shared_decks (
  deck_id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid        NOT NULL REFERENCES public.community_rooms(room_id) ON DELETE CASCADE,
  publisher_hash text        NOT NULL,
  title          text        NOT NULL,
  terms          jsonb       NOT NULL DEFAULT '[]',  -- [{front, back}]
  published_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shared_decks: read all" ON public.shared_decks FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS shared_decks_room_idx ON public.shared_decks (room_id, published_at DESC);

-- ── Presence (heartbeat) ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.room_presence (
  user_id_hash text        NOT NULL,
  room_id      uuid        NOT NULL REFERENCES public.community_rooms(room_id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id_hash, room_id)
);

ALTER TABLE public.room_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_presence: read all" ON public.room_presence FOR SELECT TO authenticated USING (true);

-- ── Helper: compute server-side member hash ───────────────────────────────────
-- Must match client: SHA-256(userId + ':' + roomId), UTF-8, hex output.

CREATE OR REPLACE FUNCTION public.compute_member_hash(p_room_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT encode(digest(auth.uid()::text || ':' || p_room_id::text, 'sha256'), 'hex')
$$;

-- ── join_room ─────────────────────────────────────────────────────────────────
-- Validates email domain, inserts membership (idempotent), returns {success, member_count}.

CREATE OR REPLACE FUNCTION public.join_room(p_room_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_email         text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_institution   text;
  v_email_suffix  text;
  v_member_hash   text;
  v_member_count  integer;
  v_already       boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT institution_id INTO v_institution
  FROM public.community_rooms WHERE room_id = p_room_id;
  IF v_institution IS NULL THEN RAISE EXCEPTION 'room_not_found'; END IF;

  SELECT email_suffix INTO v_email_suffix
  FROM public.institution_domains WHERE institution_id = v_institution;

  -- Domain check (stub — no SSO, just suffix match)
  IF v_email_suffix IS NOT NULL AND v_email NOT LIKE '%' || lower(v_email_suffix) THEN
    RAISE EXCEPTION 'domain_not_allowed:% (%)', v_institution, v_email_suffix;
  END IF;

  v_member_hash := public.compute_member_hash(p_room_id);

  SELECT true INTO v_already FROM public.room_memberships
  WHERE user_id_hash = v_member_hash AND room_id = p_room_id;

  IF NOT COALESCE(v_already, false) THEN
    INSERT INTO public.room_memberships (user_id_hash, room_id)
    VALUES (v_member_hash, p_room_id);

    UPDATE public.community_rooms
    SET member_count = member_count + 1
    WHERE room_id = p_room_id;
  END IF;

  SELECT member_count INTO v_member_count
  FROM public.community_rooms WHERE room_id = p_room_id;

  RETURN json_build_object('success', true, 'member_count', v_member_count);
END;
$$;

-- ── leave_room ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.leave_room(p_room_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_hash text;
  v_deleted     integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  v_member_hash := public.compute_member_hash(p_room_id);

  DELETE FROM public.room_memberships
  WHERE user_id_hash = v_member_hash AND room_id = p_room_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    UPDATE public.community_rooms
    SET member_count = GREATEST(0, member_count - 1)
    WHERE room_id = p_room_id;

    DELETE FROM public.room_presence
    WHERE user_id_hash = v_member_hash AND room_id = p_room_id;
  END IF;
END;
$$;

-- ── heartbeat_presence ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.heartbeat_presence(p_room_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member_hash text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  v_member_hash := public.compute_member_hash(p_room_id);

  -- Only members can set presence
  IF NOT EXISTS (
    SELECT 1 FROM public.room_memberships
    WHERE user_id_hash = v_member_hash AND room_id = p_room_id
  ) THEN RETURN; END IF;

  INSERT INTO public.room_presence (user_id_hash, room_id, last_seen_at)
  VALUES (v_member_hash, p_room_id, now())
  ON CONFLICT (user_id_hash, room_id) DO UPDATE SET last_seen_at = now();
END;
$$;

-- ── increment_keyword_count ──────────────────────────────────────────────────
-- Called by the keyword API route. Verifies membership, then upserts the hash.

CREATE OR REPLACE FUNCTION public.increment_keyword_count(p_room_id uuid, p_term_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  -- Must be a member
  IF NOT EXISTS (
    SELECT 1 FROM public.room_memberships
    WHERE user_id_hash = public.compute_member_hash(p_room_id) AND room_id = p_room_id
  ) THEN RETURN; END IF;

  INSERT INTO public.community_keyword_pool (room_id, term_hash, count, updated_at)
  VALUES (p_room_id, p_term_hash, 1, now())
  ON CONFLICT (room_id, term_hash)
  DO UPDATE SET count = public.community_keyword_pool.count + 1, updated_at = now();
END;
$$;

-- ── create_thread ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_community_thread(p_room_id uuid, p_title text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash text;
  v_id   uuid;
BEGIN
  IF auth.uid() IS NULL OR trim(p_title) = '' THEN RETURN NULL; END IF;

  v_hash := public.compute_member_hash(p_room_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.room_memberships
    WHERE user_id_hash = v_hash AND room_id = p_room_id
  ) THEN RETURN NULL; END IF;

  INSERT INTO public.community_threads (room_id, author_hash, title)
  VALUES (p_room_id, v_hash, trim(p_title))
  RETURNING thread_id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── create_reply ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_community_reply(p_thread_id uuid, p_content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_room_id uuid;
  v_hash    text;
  v_id      uuid;
BEGIN
  IF auth.uid() IS NULL OR trim(p_content) = '' THEN RETURN NULL; END IF;

  SELECT room_id INTO v_room_id FROM public.community_threads WHERE thread_id = p_thread_id;
  IF v_room_id IS NULL THEN RETURN NULL; END IF;

  v_hash := public.compute_member_hash(v_room_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.room_memberships
    WHERE user_id_hash = v_hash AND room_id = v_room_id
  ) THEN RETURN NULL; END IF;

  INSERT INTO public.community_replies (thread_id, author_hash, content)
  VALUES (p_thread_id, v_hash, trim(p_content))
  RETURNING reply_id INTO v_id;

  -- Keep reply_count in sync
  UPDATE public.community_threads SET reply_count = reply_count + 1 WHERE thread_id = p_thread_id;

  RETURN v_id;
END;
$$;

-- ── publish_shared_deck ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.publish_shared_deck(
  p_room_id uuid,
  p_title   text,
  p_terms   jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash text;
  v_id   uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  v_hash := public.compute_member_hash(p_room_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.room_memberships
    WHERE user_id_hash = v_hash AND room_id = p_room_id
  ) THEN RETURN NULL; END IF;

  INSERT INTO public.shared_decks (room_id, publisher_hash, title, terms)
  VALUES (p_room_id, v_hash, trim(p_title), p_terms)
  RETURNING deck_id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── get_active_count ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_active_count(p_room_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::integer FROM public.room_presence
  WHERE room_id = p_room_id AND last_seen_at > now() - interval '3 minutes'
$$;
