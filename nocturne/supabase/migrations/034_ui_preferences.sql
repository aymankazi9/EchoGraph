-- ── 034_ui_preferences.sql ──────────────────────────────────────────────────
-- Adds a JSONB column to users for persisted UI preferences:
--   { theme: 'dusk'|'midnight'|'eclipse',
--     accent: 'indigo'|'violet'|'sky'|'teal'|'amber'|'rose',
--     focus_mode: boolean }
--
-- Defaults to '{}' so existing rows stay valid.  The application fills
-- missing keys with DEFAULT_PREFS at read time.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ui_preferences jsonb NOT NULL DEFAULT '{}';
