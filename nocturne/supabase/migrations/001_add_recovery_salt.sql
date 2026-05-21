ALTER TABLE public.users ADD COLUMN IF NOT EXISTS recovery_salt text;
