import Link from 'next/link'
import type { Tier } from '@/lib/tiers/features'

const IS_BETA = process.env.NEXT_PUBLIC_BETA_MODE === 'true'

interface Props {
  email: string
  createdAt: string
  tier: Tier
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function TierBadge({ tier }: { tier: Tier }) {
  if (tier === 'midnight') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-indigo-500/20 text-indigo-300">
        Midnight
      </span>
    )
  }
  if (tier === 'eclipse') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-violet-500/20 text-violet-300">
        Eclipse
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bg-subtle text-text-secondary">
      Dusk
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border-subtle last:border-0">
      <span className="text-body-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export function AccountSection({ email, createdAt, tier }: Props) {
  return (
    <div>
      <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-4">Account</p>
      <Row label="Email">
        <span className="text-body-sm text-text-primary">{email}</span>
      </Row>
      <Row label="Member since">
        <span className="text-body-sm text-text-primary">{formatMemberSince(createdAt)}</span>
      </Row>
      <Row label="Plan">
        <TierBadge tier={tier} />
        {tier === 'dusk' && !IS_BETA && (
          <Link
            href="/billing"
            className="text-caption text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Upgrade
          </Link>
        )}
      </Row>
    </div>
  )
}
