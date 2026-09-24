import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { IS_BETA_MODE } from '@/lib/beta'

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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ─── POST /api/billing/portal ─────────────────────────────────────────────────
// Creates a Stripe Billing Portal session for the authenticated user and
// returns its URL.  The portal's cancellation behaviour (at period end) is
// configured in the Stripe Dashboard, not here.

export async function POST(): Promise<NextResponse> {
  // ── Beta mode gate ────────────────────────────────────────────────────────
  if (IS_BETA_MODE) {
    return NextResponse.json(
      { error: 'Billing portal is not available during the closed beta.' },
      { status: 503 },
    )
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-06-24.dahlia',
  })

  const supabase = await userClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // The subscriptions row is readable by the user via the own-row RLS policy.
  const { data: subRow } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const customerId = subRow?.stripe_customer_id as string | null | undefined ?? null

  if (!customerId) {
    // User has never completed a checkout — there is no Stripe Customer to open
    // a portal for.  Send them to pricing to start a subscription.
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/billing`,
  })

  return NextResponse.json({ url: session.url })
}
