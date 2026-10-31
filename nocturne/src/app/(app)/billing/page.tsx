import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { ManageSubscriptionButton } from '@/components/billing/manage-subscription-button'
import type { Tier } from '@/lib/tiers/features'
import { IS_BETA_MODE } from '@/lib/beta'

export const metadata = { title: 'Billing — Nocturne', robots: { index: false, follow: false } }

// ─── Display helpers ──────────────────────────────────────────────────────────

const TIER_LABEL: Record<Tier, string> = {
  dusk:     'Dusk',
  midnight: 'Midnight',
  eclipse:  'Eclipse',
}

const TIER_DESC: Record<Tier, string> = {
  dusk:     'Free forever — the full core pipeline.',
  midnight: 'Sharper transcription, more storage, unlimited sessions.',
  eclipse:  'Everything in Midnight, plus AI explanations and priority processing.',
}

type SubStatus = 'active' | 'trialing' | 'past_due' | 'canceled' |
                 'incomplete' | 'incomplete_expired' | 'unpaid' | 'paused'

function statusLabel(status: string): string {
  switch (status as SubStatus) {
    case 'active':             return 'Active'
    case 'trialing':           return 'Trial'
    case 'past_due':           return 'Past due'
    case 'canceled':           return 'Canceled'
    case 'incomplete':
    case 'incomplete_expired': return 'Incomplete'
    case 'unpaid':             return 'Unpaid'
    case 'paused':             return 'Paused'
    default:                   return status
  }
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const { checkout } = await searchParams

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, status, stripe_customer_id, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle()

  const tier       = (sub?.tier ?? 'dusk') as Tier
  const status     = (sub?.status ?? 'active') as SubStatus
  const periodEnd  = sub?.current_period_end as string | null | undefined ?? null
  const hasPortal  = !!(sub?.stripe_customer_id)

  const isFree  = tier === 'dusk'
  const isCanceled = status === 'canceled'
  const isTrialing = status === 'trialing'

  const periodLabel = (() => {
    if (!periodEnd || isFree) return null
    const date = formatDate(periodEnd)
    if (isCanceled)  return `Access until ${date}`
    if (isTrialing)  return `Trial ends ${date}`
    return `Renews ${date}`
  })()

  return (
    <div style={{ maxWidth: 560 }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontStretch: '82%', fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', color: '#EDEDED', margin: '0 0 6px' }}>
          Billing
        </h1>
        <p style={{ fontSize: 14, color: '#76767B', margin: 0 }}>
          Manage your subscription and payment details.
        </p>
      </div>

      {/* ── Checkout success banner ────────────────────────────────────────── */}
      {checkout === 'success' && (
        <div style={{
          marginBottom: 20,
          padding: '13px 16px',
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(255,255,255,0.03)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ color: '#EDEDED', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>[✓]</span>
          <p style={{ fontSize: 13.5, color: '#EDEDED', margin: 0 }}>
            Subscription activated — welcome to {TIER_LABEL[tier]}.
          </p>
        </div>
      )}

      {/* ── Current plan card ────────────────────────────────────────────── */}
      <div style={{
        padding: '22px 24px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#0C0C0D',
        marginBottom: 16,
      }}>
        {/* Plan name + status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#76767B', margin: '0 0 4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Current plan
            </p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#EDEDED', margin: 0, letterSpacing: '-0.01em' }}>
              {TIER_LABEL[tier]}
            </p>
          </div>
          <span style={{
            flexShrink: 0,
            marginTop: 2,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            padding: '3px 7px',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#9A9A9F',
          }}>
            {statusLabel(status)}
          </span>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13.5, color: '#76767B', margin: '0 0 16px', lineHeight: 1.55 }}>
          {TIER_DESC[tier]}
        </p>

        {/* Period end */}
        {periodLabel && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4A4A4E', margin: '0 0 18px' }}>
            {periodLabel}
          </p>
        )}

        {/* Actions */}
        {hasPortal ? (
          <ManageSubscriptionButton />
        ) : (
          !isFree && null
        )}
        {isFree && !IS_BETA_MODE && (
          <Link
            href="/#pricing"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 36,
              padding: '0 18px',
              fontSize: 13.5,
              fontWeight: 500,
              background: 'var(--color-accent)',
              color: 'var(--color-text-inverse)',
              textDecoration: 'none',
            }}
          >
            Upgrade plan
          </Link>
        )}
      </div>

      {/* ── Canceled notice ──────────────────────────────────────────────── */}
      {isCanceled && periodEnd && (
        <div style={{
          padding: '14px 16px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#0C0C0D',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 13.5, color: '#76767B', margin: '0 0 10px', lineHeight: 1.55 }}>
            Your subscription was canceled. You still have full access until{' '}
            <span style={{ color: '#9A9A9F' }}>{formatDate(periodEnd)}</span>.
            Resubscribe any time to keep your plan.
          </p>
          <Link
            href="/#pricing"
            style={{
              fontSize: 13,
              color: 'var(--color-accent)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            View plans →
          </Link>
        </div>
      )}

      {/* ── Past-due notice ───────────────────────────────────────────────── */}
      {status === 'past_due' && (
        <div style={{
          padding: '14px 16px',
          border: '1px solid var(--color-border-strong)',
          background: 'var(--color-bg-subtle)',
          marginBottom: 16,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, color: 'var(--color-text-secondary)', marginTop: 1, flexShrink: 0 }}>!</span>
          <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.55 }}>
            Your last payment failed. Update your payment method to keep your{' '}
            {TIER_LABEL[tier]} access.
          </p>
        </div>
      )}

    </div>
  )
}
