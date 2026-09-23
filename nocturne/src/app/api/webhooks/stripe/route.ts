import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { Tier } from '@/lib/tiers/features'
import { tierForPriceId } from '@/lib/tiers/priceMap'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
})

// Service-role client — bypasses RLS so the webhook can write subscriptions.
// Never expose this to the browser.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getUserId(customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null
  return (customer as Stripe.Customer).metadata?.supabase_user_id ?? null
}

function periodEnd(sub: Stripe.Subscription): string | null {
  // In Stripe API 2026-06-24.dahlia, current_period_end moved from Subscription
  // to SubscriptionItem. Fall back to null if there are no items yet.
  const ts = sub.items?.data[0]?.current_period_end
  return ts ? new Date(ts * 1000).toISOString() : null
}

async function upsertSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = await getUserId(sub.customer as string)
  if (!userId) {
    console.warn('[stripe-webhook] no supabase_user_id on customer', sub.customer)
    return
  }

  // Derive tier from the Price ID on the first subscription item.
  // Stripe updates the Price when a customer changes plan via the Customer
  // Portal, so this resolves correctly for upgrades and downgrades without
  // any metadata bookkeeping.
  const priceId = sub.items?.data[0]?.price?.id
  if (!priceId) {
    console.error(
      '[stripe-webhook] subscription has no price ID — cannot determine tier; skipping upsert',
      { subscriptionId: sub.id, customerId: sub.customer },
    )
    return
  }

  const tier: Tier | null = tierForPriceId(priceId)
  if (tier === null) {
    // Configuration error: this Price ID is not in the map.  Silently
    // defaulting to 'dusk' would downgrade a paying customer; log loudly
    // and skip so the bug surfaces in monitoring rather than in billing.
    console.error(
      '[stripe-webhook] unrecognised Price ID — add it to STRIPE_PRICE_ID_MIDNIGHT or STRIPE_PRICE_ID_ECLIPSE; skipping upsert',
      { priceId, subscriptionId: sub.id, customerId: sub.customer },
    )
    return
  }

  const { error } = await serviceClient().from('subscriptions').upsert(
    {
      user_id: userId,
      tier,
      status: sub.status,
      stripe_customer_id: sub.customer as string,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd(sub),
    },
    { onConflict: 'user_id' },
  )

  if (error) console.error('[stripe-webhook] upsert failed', error)
}

// ─── checkout.session.completed ──────────────────────────────────────────────
// Safety-net for the stripe_customer_id ↔ supabase_user_id link.
// customer.subscription.created is the primary tier-grant path; this handler
// only ensures the Customer→User mapping exists so future webhook events can
// resolve correctly — e.g. if a subscription was created via the Stripe
// Dashboard or test tooling before our checkout route ran.
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== 'subscription') return

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : (session.customer as Stripe.Customer | null)?.id ?? null

  if (!customerId) return

  // Single retrieve — check metadata and potentially backfill in one round-trip.
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return

  const c = customer as Stripe.Customer
  // Metadata is typed as { [name: string]: string } — accessing an absent key
  // returns undefined at runtime but string at compile-time.  Explicit annotation
  // preserves the null-fallback semantics for the reassignment below.
  let userId: string | null = c.metadata?.supabase_user_id ?? null
  let needsMetadataBackfill = false

  if (!userId) {
    // Fall back to client_reference_id set by our checkout route at session creation.
    userId = session.client_reference_id ?? null
    needsMetadataBackfill = userId !== null
  }

  if (!userId) {
    console.warn(
      '[stripe-webhook] checkout.session.completed: cannot resolve supabase_user_id —',
      'Customer metadata.supabase_user_id is missing and client_reference_id was not set.',
      { sessionId: session.id, customerId },
    )
    return
  }

  // Backfill Customer metadata so future events can resolve this user.
  if (needsMetadataBackfill) {
    await stripe.customers.update(customerId, { metadata: { supabase_user_id: userId } })
  }

  // Confirm the stripe_customer_id link in our DB.  This is a no-op when the
  // checkout route already stored it; it repairs the gap when it didn't.
  const { error } = await serviceClient()
    .from('subscriptions')
    .upsert(
      { user_id: userId, stripe_customer_id: customerId },
      { onConflict: 'user_id' },
    )

  if (error) console.error('[stripe-webhook] checkout.session.completed upsert failed', error)
}

// ─── invoice.payment_failed ───────────────────────────────────────────────────
// Stripe transitions the subscription to past_due automatically via Smart
// Retries — we don't manage a grace period ourselves.  Retrieving the
// subscription and calling upsertSubscription writes the current Stripe status
// (past_due) to our DB so the billing page can surface the warning.
// customer.subscription.updated fires independently for the status change, but
// processing it here too makes this event self-contained if that event is lost.
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // In Stripe API 2026-06-24.dahlia the subscription reference moved from a
  // top-level Invoice.subscription field to Invoice.parent.subscription_details.subscription.
  const subRef = invoice.parent?.subscription_details?.subscription ?? null
  const subId = typeof subRef === 'string' ? subRef : subRef?.id ?? null

  if (!subId) return  // one-off invoice, not subscription-based

  const sub = await stripe.subscriptions.retrieve(subId)
  await upsertSubscription(sub)
}

async function downgradeToFree(sub: Stripe.Subscription): Promise<void> {
  const userId = await getUserId(sub.customer as string)
  if (!userId) return

  const { error } = await serviceClient()
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        tier: 'dusk' satisfies Tier,
        status: 'canceled',
        stripe_customer_id: sub.customer as string,
        stripe_subscription_id: sub.id,
        current_period_end: periodEnd(sub),
      },
      { onConflict: 'user_id' },
    )

  if (error) console.error('[stripe-webhook] downgrade failed', error)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'signature verification failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await upsertSubscription(event.data.object as Stripe.Subscription)
      break

    case 'customer.subscription.deleted':
      await downgradeToFree(event.data.object as Stripe.Subscription)
      break

    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice)
      break

    default:
      // Unhandled event type — acknowledge without processing.
      break
  }

  return NextResponse.json({ received: true })
}
