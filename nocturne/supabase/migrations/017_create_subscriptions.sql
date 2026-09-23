-- Subscription tier enum and subscriptions table.
-- Tier ordinal: dusk < midnight < eclipse.
-- The webhook handler is the only writer; RLS only exposes SELECT to the owner.

CREATE TYPE public.subscription_tier AS ENUM ('dusk', 'midnight', 'eclipse');

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  tier                   public.subscription_tier NOT NULL DEFAULT 'dusk',
  status                 text        NOT NULL DEFAULT 'active'
                           CHECK (status IN (
                             'active', 'canceled', 'past_due', 'trialing',
                             'incomplete', 'incomplete_expired', 'unpaid', 'paused'
                           )),
  stripe_customer_id     text,
  stripe_subscription_id text        UNIQUE,
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own row; webhook service role bypasses RLS to write.
CREATE POLICY "subscriptions: own row read"
  ON public.subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

-- Backfill every existing user to the free Dusk tier.
INSERT INTO public.subscriptions (user_id, tier, status)
SELECT id, 'dusk', 'active'
FROM   public.users
ON CONFLICT (user_id) DO NOTHING;
