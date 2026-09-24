import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { priceIdForTier } from '@/lib/tiers/priceMap'
import type { Tier } from '@/lib/tiers/features'
import { IS_BETA_MODE } from '@/lib/beta'

// Anon client scoped to the calling user's session — used only to identify the
// authenticated user.  All DB writes use the service-role client below since
// the subscriptions table has no user-writable RLS policies.
async function userClient() {
  const cookieStore = await cookies()
  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─── POST /api/billing/checkout ───────────────────────────────────────────────
// Body: { tier: 'midnight' | 'eclipse' }
// Returns: { url: string } — the Stripe-hosted Checkout URL

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Beta mode gate ────────────────────────────────────────────────────────
  // Checkout is disabled during closed beta. Flip BETA_MODE=false to re-enable.
  if (IS_BETA_MODE) {
    return NextResponse.json(
      { error: 'Checkout is not available during the closed beta.' },
      { status: 503 },
    )
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-06-24.dahlia',
  })

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await userClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // ── Validate requested tier ───────────────────────────────────────────────
  let body: { tier?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const tier = body.tier as Tier | undefined
  if (tier !== 'midnight' && tier !== 'eclipse') {
    return NextResponse.json({ error: 'tier must be "midnight" or "eclipse"' }, { status: 400 })
  }

  const priceId = priceIdForTier(tier)
  if (!priceId) {
    console.error('[checkout] no Price ID configured for tier', tier)
    return NextResponse.json({ error: 'Checkout unavailable for this tier' }, { status: 503 })
  }

  // ── Look up or create Stripe Customer ─────────────────────────────────────
  // The webhook handler resolves a subscription back to a Supabase user via
  // customer.metadata.supabase_user_id — nothing set it until this route.
  // We persist stripe_customer_id so repeat checkouts reuse the same Customer.
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

    // Upsert: if no subscriptions row yet, defaults (tier:'dusk', status:'active')
    // from the table definition fill in.  Existing paying rows are untouched on
    // the tier/status columns because we only set stripe_customer_id.
    const { error: upsertErr } = await db.from('subscriptions').upsert(
      { user_id: user.id, stripe_customer_id: customerId },
      { onConflict: 'user_id' },
    )
    if (upsertErr) {
      console.error('[checkout] failed to store stripe_customer_id', upsertErr)
      // Non-fatal: continue — the webhook will resolve via metadata regardless.
    }
  }

  // ── Create Checkout Session ────────────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    // client_reference_id is the fallback for checkout.session.completed to
    // resolve the Supabase user when Customer metadata.supabase_user_id is
    // absent (e.g. manual dashboard test data).
    client_reference_id: user.id,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
    },
    success_url: `${APP_URL}/billing?checkout=success`,
    cancel_url:  `${APP_URL}/#pricing`,
    customer_email: customerId ? undefined : (user.email ?? undefined),
    allow_promotion_codes: true,
  })

  if (!session.url) {
    console.error('[checkout] Stripe returned a session with no URL', session.id)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }

  return NextResponse.json({ url: session.url })
}
