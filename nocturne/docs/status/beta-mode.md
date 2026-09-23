# Beta Mode

## Current state

`BETA_MODE=true` as of 2026-09-22. The app is in closed beta.

---

## What BETA_MODE currently disables / changes

| Surface | In beta (`true`) | Normal (`false`) |
|---|---|---|
| `POST /api/billing/checkout` | Returns 503 immediately — no Stripe call | Creates Stripe Checkout Session, returns URL |
| `POST /api/billing/portal` | Returns 503 immediately — no Stripe call | Creates Stripe Billing Portal session, returns URL |
| `/checkout` server page | Redirects to `/#beta-request` | Creates Checkout Session, redirects to Stripe |
| Landing hero CTA | "Request beta access" → smooth scroll to `#beta-request` | "Start for free" → `/setup` |
| Landing bottom CTA | "Request beta access" → `#beta-request` anchor | "Start for free" → `/setup` |
| Pricing section plan CTAs | All buttons say "Request beta access" → scroll to `#beta-request` | Normal checkout / login flow |
| Social proof section | **Not rendered at all** | Rendered |
| Newsletter section | **Not rendered at all** | Rendered |
| Beta request section (`#beta-request`) | Rendered (EmailJS form: name, email, school, use case) | Not rendered |
| `LockedFeature` upgrade CTA | Shows "X — coming soon to beta testers", no button | "Upgrade to X" button → `/billing` |
| `ManageSubscriptionButton` | Returns `null` — not rendered | Renders "Manage subscription" button |
| Billing page "Upgrade plan" link | Not rendered | Rendered (free tier only) |
| Settings → Account → "Upgrade" link | Not rendered | Rendered (free tier only) |
| Settings → Preferences silence note | "Available on Midnight" (no upgrade link) | "Available on Midnight · Upgrade" |
| Vault setup (`/setup`) | Invite code wall shown before any other step | No invite code required |
| Startup safety check | Throws if `STRIPE_SECRET_KEY` starts with `sk_live_` | No check |

---

## Environment variables

| Variable | Type | Purpose |
|---|---|---|
| `BETA_MODE` | `'true' \| 'false'` | Server-only flag. Controls all server-side gating (routes, `IS_BETA_MODE` import). |
| `NEXT_PUBLIC_BETA_MODE` | `'true' \| 'false'` | Client-side mirror. Controls client-component rendering (CTAs, paywall copy, settings links). **Must be kept in sync with `BETA_MODE`.** |
| `BETA_INVITE_CODE` | string | The shared invite code required during vault setup. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_EMAILJS_SERVICE_ID` | string | EmailJS service ID for the beta request form. |
| `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID` | string | EmailJS template ID. |
| `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY` | string | EmailJS public key. |

### Current values (`.env.local`)

```
BETA_MODE=true
NEXT_PUBLIC_BETA_MODE=true
BETA_INVITE_CODE=nocturne-beta-2026
```

EmailJS and Sentry DSN are placeholders — fill in before first external beta deployment.

---

## Where the flag is read

**Server-side** (`src/lib/beta.ts` → `IS_BETA_MODE`):
- `src/app/api/billing/checkout/route.ts`
- `src/app/api/billing/portal/route.ts`
- `src/app/(marketing)/checkout/page.tsx`
- `src/app/(app)/billing/page.tsx`
- `src/app/page.tsx` (server component, reads `process.env.BETA_MODE` directly)
- `src/instrumentation.ts` (startup check)

**Client-side** (`process.env.NEXT_PUBLIC_BETA_MODE`):
- `src/components/landing/landing-hero.tsx`
- `src/components/landing/pricing-section.tsx`
- `src/components/paywall/locked-feature.tsx`
- `src/components/billing/manage-subscription-button.tsx`
- `src/components/settings/account-section.tsx`
- `src/components/settings/preferences-section.tsx`
- `src/app/(vault)/setup/SetupForm.tsx`

**Invite code validation** (`src/app/actions/validate-invite.ts`):
- Reads `BETA_INVITE_CODE` server-side only.
- Called from `SetupForm.tsx` via `'use server'` action.
- Returns `{ ok: true }` unconditionally when `BETA_MODE !== 'true'`.

---

## Exiting beta mode

**Exact steps — one change, everything reverts:**

1. In `.env.local` (and your production environment), set:
   ```
   BETA_MODE=false
   NEXT_PUBLIC_BETA_MODE=false
   ```
2. Redeploy.

That's it. No code changes, no migrations, no manual cleanup. All gated surfaces revert automatically:
- Checkout and portal routes accept real Stripe calls again.
- Landing CTAs revert to "Start for free" → `/setup`.
- Social proof and newsletter sections rerender.
- Beta request form disappears.
- Invite code wall is gone from `/setup`.
- Upgrade CTAs return in paywall, settings, and billing pages.

The `BETA_INVITE_CODE` env var can be left in place — `validateInviteCode` short-circuits to `{ ok: true }` when `BETA_MODE` is false.

---

## Sentry (independent of BETA_MODE)

Sentry is configured in `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`, registered via `src/instrumentation.ts` and `src/instrumentation-client.ts`. It is **never** gated on `BETA_MODE` — error monitoring is always on in production.

Set `NEXT_PUBLIC_SENTRY_DSN` to your project DSN before the first production deploy. Events are only sent when `NODE_ENV === 'production'`.
