// Server component — creates a Stripe Checkout Session and immediately redirects.
// This page is the destination after the login→checkout flow:
//   unauthenticated user clicks "Get Midnight"
//   → /login?next=/checkout?tier=midnight
//   → /auth/callback?next=/checkout?tier=midnight
//   → here → Stripe Checkout

import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { IS_BETA_MODE } from '@/lib/beta'
import { createServerClient } from '@/lib/supabase-server'
import { priceIdForTier } from '@/lib/tiers/priceMap'
import type { Tier } from '@/lib/tiers/features'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
})

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>
}) {
  // Beta mode: checkout is disabled — send back to pricing (or beta-request section).
  if (IS_BETA_MODE) redirect('/#beta-request')

  const { tier: tierParam } = await searchParams

  const tier = tierParam as Tier | undefined
  if (tier !== 'midnight' && tier !== 'eclipse') {
    redirect('/#pricing')
  }

  // Auth check — redirect to login if the session expired or was never set
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/checkout?tier=${tier}`)
  }

  const priceId = priceIdForTier(tier)
  if (!priceId) {
    // Tier is valid but not yet configured with a live price — back to pricing
    redirect('/#pricing')
  }

  // ── Look up or create Stripe Customer ─────────────────────────────────────
  const db = serviceClient()

  const { data: subRow } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  let customerId = subRow?.stripe_customer_id as string | null | undefined ?? null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id

    const { error: upsertErr } = await db.from('subscriptions').upsert(
      { user_id: user.id, stripe_customer_id: customerId },
      { onConflict: 'user_id' },
    )
    if (upsertErr) {
      console.error('[checkout-page] failed to store stripe_customer_id', upsertErr)
    }
  }

  // ── Create Checkout Session and redirect ──────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    client_reference_id: user.id,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
    },
    success_url: `${APP_URL}/billing?checkout=success`,
    cancel_url:  `${APP_URL}/#pricing`,
    allow_promotion_codes: true,
  })

  if (!session.url) {
    redirect('/#pricing')
  }

  redirect(session.url)
}
