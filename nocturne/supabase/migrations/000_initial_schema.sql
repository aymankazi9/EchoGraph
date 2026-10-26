-- Base tables that every numbered migration depends on but that previously
-- only existed in schema.sql (a manual one-time script, not a migration).
-- Supabase Preview Branches only run files in supabase/migrations/, so
-- without this file every migration fails from 001 onward.
--
-- All statements are idempotent so this is safe to "apply" against a
-- production database that was already bootstrapped via schema.sql.

-- ── Core tables ───────────────────────────────────────────────────────────────

-- Users shadow table (one row per auth.users row, created by trigger below)
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

-- Files (uploaded PDFs and audio)
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

-- Transcript words
CREATE TABLE IF NOT EXISTS public.transcript_words (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid    NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  word_encrypted text,
  start_time_ms  integer,
  end_time_ms    integer,
  slide_index    integer
);

-- ── Auth trigger ──────────────────────────────────────────────────────────────
-- Auto-creates a public.users row whenever a user signs up via Supabase Auth.

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

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_words ENABLE ROW LEVEL SECURITY;

-- users
DROP POLICY IF EXISTS "users: own row only" ON public.users;
CREATE POLICY "users: own row only"
  ON public.users FOR ALL
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- sessions
DROP POLICY IF EXISTS "sessions: own rows only" ON public.sessions;
CREATE POLICY "sessions: own rows only"
  ON public.sessions FOR ALL
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- files
DROP POLICY IF EXISTS "files: own rows only" ON public.files;
CREATE POLICY "files: own rows only"
  ON public.files FOR ALL
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- transcript_words has no direct user_id; join through sessions
DROP POLICY IF EXISTS "transcript_words: own rows only" ON public.transcript_words;
CREATE POLICY "transcript_words: own rows only"
  ON public.transcript_words FOR ALL
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

-- ── Storage bucket ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('nocturne-files', 'nocturne-files', false)
ON CONFLICT (id) DO NOTHING;

-- ── Storage policies ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "storage: users read own files"   ON storage.objects;
DROP POLICY IF EXISTS "storage: users insert own files" ON storage.objects;
DROP POLICY IF EXISTS "storage: users update own files" ON storage.objects;
DROP POLICY IF EXISTS "storage: users delete own files" ON storage.objects;

CREATE POLICY "storage: users read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'nocturne-files' AND name LIKE (auth.uid()::text || '/%'));

CREATE POLICY "storage: users insert own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'nocturne-files' AND name LIKE (auth.uid()::text || '/%'));

CREATE POLICY "storage: users update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING     (bucket_id = 'nocturne-files' AND name LIKE (auth.uid()::text || '/%'))
  WITH CHECK (bucket_id = 'nocturne-files' AND name LIKE (auth.uid()::text || '/%'));

CREATE POLICY "storage: users delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'nocturne-files' AND name LIKE (auth.uid()::text || '/%'));
