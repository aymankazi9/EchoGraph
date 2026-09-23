import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase-server'
import { ManageSubscriptionButton } from '@/components/billing/manage-subscription-button'
import type { Tier } from '@/lib/tiers/features'
import { IS_BETA_MODE } from '@/lib/beta'

export const metadata = { title: 'Billing — Nocturne' }

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

interface StatusBadge { label: string; bg: string; color: string }

function statusBadge(status: string): StatusBadge {
  switch (status as SubStatus) {
    case 'active':             return { label: 'Active',      bg: 'rgba(34,197,94,0.1)',    color: '#4ADE80' }
    case 'trialing':           return { label: 'Trial',       bg: 'rgba(99,102,241,0.12)',  color: '#A5B4FC' }
    case 'past_due':           return { label: 'Past due',    bg: 'rgba(251,191,36,0.12)',  color: '#FCD34D' }
    case 'canceled':           return { label: 'Canceled',    bg: 'rgba(100,116,139,0.12)', color: '#94A3B8' }
    case 'incomplete':
    case 'incomplete_expired': return { label: 'Incomplete',  bg: 'rgba(251,113,133,0.1)',  color: '#FB7185' }
    case 'unpaid':             return { label: 'Unpaid',      bg: 'rgba(251,113,133,0.1)',  color: '#FB7185' }
    case 'paused':             return { label: 'Paused',      bg: 'rgba(100,116,139,0.12)', color: '#94A3B8' }
    default:                   return { label: status,        bg: 'rgba(100,116,139,0.12)', color: '#94A3B8' }
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

  const badge   = statusBadge(status)
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
        <h1 style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.025em', color: '#E2E8F0', margin: '0 0 6px' }}>
          Billing
        </h1>
        <p style={{ fontSize: 14, color: '#5B6478', margin: 0 }}>
          Manage your subscription and payment details.
        </p>
      </div>

      {/* ── Checkout success banner ────────────────────────────────────────── */}
      {checkout === 'success' && (
        <div style={{
          marginBottom: 20,
          padding: '13px 16px',
          borderRadius: 10,
          border: '1px solid rgba(74,222,128,0.25)',
          background: 'rgba(34,197,94,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ color: '#4ADE80', flexShrink: 0, lineHeight: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
          <p style={{ fontSize: 13.5, color: '#4ADE80', margin: 0 }}>
            Subscription activated — welcome to {TIER_LABEL[tier]}.
          </p>
        </div>
      )}

      {/* ── Current plan card ────────────────────────────────────────────── */}
      <div style={{
        padding: '22px 24px',
        borderRadius: 14,
        border: '1px solid #1E1E2E',
        background: '#0C0C13',
        marginBottom: 16,
      }}>
        {/* Plan name + status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, color: '#5B6478', margin: '0 0 4px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Current plan
            </p>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#E2E8F0', margin: 0, letterSpacing: '-0.01em' }}>
              {TIER_LABEL[tier]}
            </p>
          </div>
          <span style={{
            flexShrink: 0,
            marginTop: 2,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 11px',
            borderRadius: 9999,
            background: badge.bg,
            fontSize: 12,
            fontWeight: 500,
            color: badge.color,
          }}>
            {badge.label}
          </span>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13.5, color: '#5B6478', margin: '0 0 16px', lineHeight: 1.55 }}>
          {TIER_DESC[tier]}
        </p>

        {/* Period end */}
        {periodLabel && (
          <p style={{ fontSize: 13, color: '#3F485C', margin: '0 0 18px' }}>
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
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 500,
              background: '#6366F1',
              color: '#09090F',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(99,102,241,0.28)',
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
          borderRadius: 10,
          border: '1px solid #1E1E2E',
          background: '#0C0C13',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 13.5, color: '#5B6478', margin: '0 0 10px', lineHeight: 1.55 }}>
            Your subscription was canceled. You still have full access until{' '}
            <span style={{ color: '#94A3B8' }}>{formatDate(periodEnd)}</span>.
            Resubscribe any time to keep your plan.
          </p>
          <Link
            href="/#pricing"
            style={{
              fontSize: 13,
              color: '#818CF8',
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
          borderRadius: 10,
          border: '1px solid rgba(251,191,36,0.2)',
          background: 'rgba(251,191,36,0.05)',
          marginBottom: 16,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          <span style={{ color: '#FCD34D', marginTop: 1, flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
          <p style={{ fontSize: 13.5, color: '#94A3B8', margin: 0, lineHeight: 1.55 }}>
            Your last payment failed. Update your payment method to keep your{' '}
            {TIER_LABEL[tier]} access.
          </p>
        </div>
      )}

    </div>
  )
}
