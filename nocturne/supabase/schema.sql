-- ============================================================
-- Nocturne — Supabase schema
-- Run once in the Supabase SQL editor (Project → SQL Editor → New query)
-- ============================================================


-- ============================================================
-- 1. TABLES
-- ============================================================

-- Users (extends auth.users — row is auto-created by trigger below)
CREATE TABLE IF NOT EXISTS public.users (
  id                   uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                text,
  pbkdf2_salt          text,
  encrypted_master_key text,
  field                text,
  tier                 text        NOT NULL DEFAULT 'free',
  storage_used_bytes   bigint      NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title_encrypted text,
  status          text        NOT NULL DEFAULT 'ingesting',
  has_slides      boolean     NOT NULL DEFAULT false,
  has_audio       boolean     NOT NULL DEFAULT false,
  has_study_guide boolean     NOT NULL DEFAULT false,
  guide_type      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  exam_date       date
);

-- Files
CREATE TABLE IF NOT EXISTS public.files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  file_type    text,
  storage_path text,
  size_bytes   bigint,
  mime_hint    text,
  iv           text,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

-- Slides (one row per PDF page)
CREATE TABLE IF NOT EXISTS public.slides (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid    NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  page_number    integer,
  text_encrypted text,
  density_score  real,
  is_red_zone    boolean NOT NULL DEFAULT false,
  is_likely_zone boolean NOT NULL DEFAULT false
);

-- Transcript words
CREATE TABLE IF NOT EXISTS public.transcript_words (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid    NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  word_encrypted text,
  start_time_ms  integer,
  end_time_ms    integer,
  slide_index    integer
);

-- Keywords
CREATE TABLE IF NOT EXISTS public.keywords (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term_encrypted    text        NOT NULL,
  source            text        NOT NULL CHECK (source IN ('real_guide', 'synthetic', 'anki')),
  zone              text        NOT NULL CHECK (zone IN ('red', 'likely')),
  confidence_score  real        NOT NULL DEFAULT 0,
  mention_count     integer     NOT NULL DEFAULT 0,
  dwell_time_ms     integer     NOT NULL DEFAULT 0,
  emphasis_score    real        NOT NULL DEFAULT 0,
  lecture_confidence real       NOT NULL DEFAULT 0,
  slide_indices     integer[]   NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);


-- Flashcards (one per keyword, generated after scoring)
CREATE TABLE IF NOT EXISTS public.flashcards (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword_id      uuid        REFERENCES public.keywords(id) ON DELETE SET NULL,
  front_encrypted text        NOT NULL,
  back_encrypted  text        NOT NULL,
  slide_index     integer,
  zone            text        NOT NULL CHECK (zone IN ('red', 'likely')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Flashcard review history for SM-2 spaced repetition
CREATE TABLE IF NOT EXISTS public.flashcard_reviews (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flashcard_id  uuid        NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating        text        NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  ease_factor   real        NOT NULL DEFAULT 2.5,
  interval_days integer     NOT NULL DEFAULT 1,
  due_at        timestamptz NOT NULL,
  reviewed_at   timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- 2. TRIGGER — auto-create public.users row on OAuth signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (new.id, new.email, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 3. ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slides             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_words   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords           ENABLE ROW LEVEL SECURITY;

-- users: each user can only see and modify their own row
CREATE POLICY "users: own row only"
  ON public.users
  FOR ALL
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- sessions: scoped to user_id
CREATE POLICY "sessions: own rows only"
  ON public.sessions
  FOR ALL
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- files: scoped to user_id
CREATE POLICY "files: own rows only"
  ON public.files
  FOR ALL
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- slides: no direct user_id — join through sessions
CREATE POLICY "slides: own rows only"
  ON public.slides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = slides.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = slides.session_id
        AND s.user_id = auth.uid()
    )
  );

-- transcript_words: no direct user_id — join through sessions
CREATE POLICY "transcript_words: own rows only"
  ON public.transcript_words
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transcript_words.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transcript_words.session_id
        AND s.user_id = auth.uid()
    )
  );

-- keywords: has direct user_id column — match migration 005
CREATE POLICY "keywords: select own"
  ON public.keywords FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "keywords: insert own"
  ON public.keywords FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "keywords: delete own"
  ON public.keywords FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS keywords_session_id_idx ON public.keywords (session_id);

-- flashcards: has direct user_id
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flashcards: select own"
  ON public.flashcards FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "flashcards: insert own"
  ON public.flashcards FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "flashcards: delete own"
  ON public.flashcards FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS flashcards_session_id_idx ON public.flashcards (session_id);

-- flashcard_reviews: scoped to user_id
ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flashcard_reviews: select own"
  ON public.flashcard_reviews FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "flashcard_reviews: insert own"
  ON public.flashcard_reviews FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS flashcard_reviews_user_flashcard_idx
  ON public.flashcard_reviews (user_id, flashcard_id, reviewed_at DESC);

-- Session notes (one row per session; IV embedded in content_encrypted)
CREATE TABLE IF NOT EXISTS public.session_notes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_encrypted text        NOT NULL DEFAULT '',
  iv                text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_notes: select own"
  ON public.session_notes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "session_notes: insert own"
  ON public.session_notes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "session_notes: update own"
  ON public.session_notes FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "session_notes: delete own"
  ON public.session_notes FOR DELETE
  USING (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS session_notes_session_id_idx
  ON public.session_notes (session_id);

-- Ask conversations and messages
CREATE TABLE IF NOT EXISTS public.ask_conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ask_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     uuid        NOT NULL REFERENCES public.ask_conversations(id) ON DELETE CASCADE,
  role                text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content_encrypted   text        NOT NULL,
  iv                  text,
  cited_slide_indices integer[]   NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ask_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ask_messages      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ask_conversations: select own"
  ON public.ask_conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ask_conversations: insert own"
  ON public.ask_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ask_conversations: delete own"
  ON public.ask_conversations FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "ask_messages: select own"
  ON public.ask_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ask_conversations c
      WHERE c.id = ask_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "ask_messages: insert own"
  ON public.ask_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ask_conversations c
      WHERE c.id = ask_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS ask_conversations_session_id_idx
  ON public.ask_conversations (session_id);

CREATE INDEX IF NOT EXISTS ask_messages_conversation_id_idx
  ON public.ask_messages (conversation_id, created_at);

-- ── Momentum tracking (migration 013) ────────────────────────────────────────

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS course_tag text;
ALTER TABLE public.users    ADD COLUMN IF NOT EXISTS momentum_points integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id         uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            date    NOT NULL,
  sessions_played integer NOT NULL DEFAULT 0,
  cards_reviewed  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.momentum_ledger (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta       integer     NOT NULL,
  reason      text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_activity: select own"   ON public.user_activity   FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "momentum_ledger: select own" ON public.momentum_ledger FOR SELECT USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS user_activity_user_date_idx    ON public.user_activity   (user_id, date DESC);
CREATE INDEX IF NOT EXISTS momentum_ledger_user_created_idx ON public.momentum_ledger (user_id, created_at DESC);

-- ── Milestones (migration 014) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.milestone_definitions (
  id              text    PRIMARY KEY,
  title           text    NOT NULL,
  description     text    NOT NULL,
  icon            text    NOT NULL,
  color           text    NOT NULL,
  condition_type  text    NOT NULL,
  condition_value integer NOT NULL
);

ALTER TABLE public.milestone_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milestone_definitions: select authenticated" ON public.milestone_definitions FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.user_milestones (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id text        NOT NULL REFERENCES public.milestone_definitions(id),
  earned_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, milestone_id)
);

ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_milestones: select own" ON public.user_milestones FOR SELECT USING (user_id = auth.uid());


-- ============================================================
-- 4. STORAGE BUCKET + RLS
-- ============================================================

-- Private bucket — all blobs are encrypted .bin files
-- MANUAL ACTION REQUIRED:
-- Rename bucket "echograph-files" to "nocturne-files" in the Supabase dashboard before deploying.
-- Dashboard → Storage → echograph-files → Settings
INSERT INTO storage.buckets (id, name, public)
VALUES ('nocturne-files', 'nocturne-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage paths: {userId}/{sessionId}/{fileId}.bin
-- Policy: the first path segment must equal the authenticated user's UID.

CREATE POLICY "storage: users read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'nocturne-files'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "storage: users insert own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'nocturne-files'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "storage: users update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'nocturne-files'
    AND name LIKE (auth.uid()::text || '/%')
  )
  WITH CHECK (
    bucket_id = 'nocturne-files'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "storage: users delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'nocturne-files'
    AND name LIKE (auth.uid()::text || '/%')
  );

-- ============================================================
-- 8. COMMUNITY (migration 015)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.institution_domains (
  institution_id text PRIMARY KEY,
  display_name   text NOT NULL,
  email_suffix   text NOT NULL
);
ALTER TABLE public.institution_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "institution_domains: read all"
  ON public.institution_domains FOR SELECT TO authenticated USING (true);

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

CREATE TABLE IF NOT EXISTS public.room_memberships (
  user_id_hash text        NOT NULL,
  room_id      uuid        NOT NULL REFERENCES public.community_rooms(room_id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id_hash, room_id)
);
ALTER TABLE public.room_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_memberships: read all"
  ON public.room_memberships FOR SELECT TO authenticated USING (true);

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
CREATE INDEX IF NOT EXISTS community_keyword_pool_room_count_idx
  ON public.community_keyword_pool (room_id, count DESC);

CREATE TABLE IF NOT EXISTS public.community_threads (
  thread_id   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid        NOT NULL REFERENCES public.community_rooms(room_id) ON DELETE CASCADE,
  author_hash text        NOT NULL,
  title       text        NOT NULL,
  reply_count integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_threads: read all"
  ON public.community_threads FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS community_threads_room_idx
  ON public.community_threads (room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_replies (
  reply_id    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid        NOT NULL REFERENCES public.community_threads(thread_id) ON DELETE CASCADE,
  author_hash text        NOT NULL,
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_replies: read all"
  ON public.community_replies FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS community_replies_thread_idx
  ON public.community_replies (thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.shared_decks (
  deck_id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid        NOT NULL REFERENCES public.community_rooms(room_id) ON DELETE CASCADE,
  publisher_hash text        NOT NULL,
  title          text        NOT NULL,
  terms          jsonb       NOT NULL DEFAULT '[]',
  published_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shared_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shared_decks: read all"
  ON public.shared_decks FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS shared_decks_room_idx
  ON public.shared_decks (room_id, published_at DESC);

CREATE TABLE IF NOT EXISTS public.room_presence (
  user_id_hash text        NOT NULL,
  room_id      uuid        NOT NULL REFERENCES public.community_rooms(room_id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id_hash, room_id)
);
ALTER TABLE public.room_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_presence: read all"
  ON public.room_presence FOR SELECT TO authenticated USING (true);
