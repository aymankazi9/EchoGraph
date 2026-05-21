ALTER TABLE users
  ADD COLUMN IF NOT EXISTS checklist_dismissed  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist_completed  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist_exported   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS domain_prompt_dismissed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS field text;
