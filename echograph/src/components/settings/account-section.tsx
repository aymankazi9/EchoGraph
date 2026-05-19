import Link from 'next/link'

interface Props {
  email: string
  createdAt: string
  tier: string | null
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function TierBadge({ tier }: { tier: string | null }) {
  const t = tier ?? 'free'
  if (t === 'scholar') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-teal-500/20 text-teal-200">
        Scholar
      </span>
    )
  }
  if (t === 'pro') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-purple-500/20 text-purple-200">
        Pro
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bg-subtle text-text-secondary">
      Free
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
        {(!tier || tier === 'free') && (
          <Link
            href="#pricing"
            className="text-caption text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Upgrade
          </Link>
        )}
      </Row>
    </div>
  )
}
