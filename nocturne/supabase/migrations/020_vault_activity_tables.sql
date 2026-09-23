-- Track when each session was last opened, audio playback position,
-- and Anki export history.

-- ── sessions.last_opened_at ───────────────────────────────────────────────────
-- Touched on every session page load so the vault can surface "continue studying".

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;

CREATE INDEX IF NOT EXISTS sessions_last_opened_idx
  ON public.sessions (user_id, last_opened_at DESC NULLS LAST);

-- ── sessions_playback ─────────────────────────────────────────────────────────
-- Stores the user's last audio position per session.
-- Upserted periodically during lecture playback (~every 10 s).
-- Used to compute "reviewed X of Y slides" on the continue-studying card.

CREATE TABLE IF NOT EXISTS public.sessions_playback (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  last_position_ms bigint      NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

ALTER TABLE public.sessions_playback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_playback: select own"
  ON public.sessions_playback FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "sessions_playback: insert own"
  ON public.sessions_playback FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "sessions_playback: update own"
  ON public.sessions_playback FOR UPDATE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS sessions_playback_session_user_idx
  ON public.sessions_playback (session_id, user_id);

-- ── export_events ─────────────────────────────────────────────────────────────
-- Append-only log of Anki export actions.
-- One row per export click; card_count is the deck size at time of export.
-- Summed to produce the "Cards exported" stat tile.

CREATE TABLE IF NOT EXISTS public.export_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  uuid        REFERENCES public.sessions(id) ON DELETE SET NULL,
  card_count  integer     NOT NULL DEFAULT 0 CHECK (card_count >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.export_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_events: select own"
  ON public.export_events FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "export_events: insert own"
  ON public.export_events FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS export_events_user_idx
  ON public.export_events (user_id);
