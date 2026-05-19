-- ============================================================
-- EchoGraph — Supabase schema
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
  id               uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid  NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  term_encrypted   text,
  source           text,
  zone             text,
  confidence_score real,
  mention_count    integer,
  dwell_time_ms    integer
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

-- keywords: no direct user_id — join through sessions
CREATE POLICY "keywords: own rows only"
  ON public.keywords
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = keywords.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = keywords.session_id
        AND s.user_id = auth.uid()
    )
  );


-- ============================================================
-- 4. STORAGE BUCKET + RLS
-- ============================================================

-- Private bucket — all blobs are encrypted .bin files
INSERT INTO storage.buckets (id, name, public)
VALUES ('echograph-files', 'echograph-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage paths: {userId}/{sessionId}/{fileId}.bin
-- Policy: the first path segment must equal the authenticated user's UID.

CREATE POLICY "storage: users read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'echograph-files'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "storage: users insert own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'echograph-files'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "storage: users update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'echograph-files'
    AND name LIKE (auth.uid()::text || '/%')
  )
  WITH CHECK (
    bucket_id = 'echograph-files'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "storage: users delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'echograph-files'
    AND name LIKE (auth.uid()::text || '/%')
  );
