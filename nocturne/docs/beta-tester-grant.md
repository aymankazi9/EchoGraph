# Beta Tester Grant

How to manually grant a tester a paid tier and how to revert them.

---

## Grant a tester Eclipse tier

Run in the Supabase SQL Editor (or via `supabase db shell`).

Replace `<user_uuid>` with the tester's Supabase Auth user ID (found in the Dashboard under Authentication → Users).

```sql
-- Grant Eclipse tier to a beta tester.
-- Sets tier + status directly; no Stripe subscription is created.
-- The tester can use all Eclipse features immediately.
INSERT INTO public.subscriptions (
  user_id,
  tier,
  status,
  current_period_end
)
VALUES (
  '<user_uuid>',
  'eclipse',
  'active',
  (now() + interval '90 days')::timestamptz
)
ON CONFLICT (user_id)
DO UPDATE SET
  tier               = EXCLUDED.tier,
  status             = EXCLUDED.status,
  current_period_end = EXCLUDED.current_period_end;
```

The `90 days` window gives testers a generous runway. Adjust as needed.
`stripe_customer_id` and `stripe_subscription_id` are intentionally left null — the tester was not billed.

---

## Grant Midnight tier instead

```sql
INSERT INTO public.subscriptions (
  user_id,
  tier,
  status,
  current_period_end
)
VALUES (
  '<user_uuid>',
  'midnight',
  'active',
  (now() + interval '90 days')::timestamptz
)
ON CONFLICT (user_id)
DO UPDATE SET
  tier               = EXCLUDED.tier,
  status             = EXCLUDED.status,
  current_period_end = EXCLUDED.current_period_end;
```

---

## Revert a tester to Dusk (free tier)

```sql
-- Revoke paid tier — returns tester to free Dusk access.
UPDATE public.subscriptions
SET
  tier               = 'dusk',
  status             = 'active',
  current_period_end = NULL
WHERE user_id = '<user_uuid>';
```

---

## Notes

- Tier authority is `subscriptions.tier`, read by `get_user_tier()` (RPC used by `getUserTier()` in `src/lib/tiers/server.ts`). Changing `subscriptions.tier` takes effect on the next page load — no cache invalidation needed.
- The RLS policies on gated tables (`flashcard_reviews`, `session_notes`, `ask_conversations`, etc.) check `user_has_tier(auth.uid(), '<required_tier>')`, which calls `get_user_tier()` at query time. The grant is fully enforced as soon as the row is updated.
- `users.tier` is deprecated and is never read by any current code path. Do not use it.
- There is no webhook or Stripe event involved in a manual grant — the row is written directly.
