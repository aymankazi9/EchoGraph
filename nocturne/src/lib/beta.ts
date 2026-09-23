/**
 * Beta-mode flag — server-side only.
 * Import only from Server Components, Route Handlers, and Server Actions.
 * Never import from 'use client' files — use NEXT_PUBLIC_BETA_MODE directly there.
 *
 * Flip BETA_MODE=false (and NEXT_PUBLIC_BETA_MODE=false) to fully exit beta.
 * No other code changes are required.
 */

export const IS_BETA_MODE = process.env.BETA_MODE === 'true'

// ─── Startup safety check ─────────────────────────────────────────────────────
// Beta mode must never run against a live Stripe key — doing so would allow
// real charges to fire through an unfinished billing flow.
if (IS_BETA_MODE && process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
  throw new Error(
    '[beta] BETA_MODE=true while STRIPE_SECRET_KEY is a live key (sk_live_…). ' +
    'This is a safety violation — beta mode must only run in Stripe test mode. ' +
    'Either set BETA_MODE=false or switch STRIPE_SECRET_KEY to a test key (sk_test_…).',
  )
}
