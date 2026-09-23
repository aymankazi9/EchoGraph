import Link from 'next/link'

// Beta mode: upgrade CTAs are suppressed — checkout is not yet open to the public.
const IS_BETA = process.env.NEXT_PUBLIC_BETA_MODE === 'true'

interface Props {
  requiredTier: 'midnight' | 'eclipse'
  feature: string
  description: string
}

const TIER_LABEL = { midnight: 'Midnight', eclipse: 'Eclipse' } as const

export function LockedFeature({ requiredTier, feature, description }: Props) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20, padding: 48, textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        border: '1px solid rgba(99,102,241,0.22)',
        background: 'rgba(99,102,241,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#6366F1',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <div style={{ maxWidth: 300 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#E2E8F0', margin: '0 0 7px', lineHeight: 1.4 }}>
          {feature}
        </p>
        <p style={{ fontSize: 13, color: '#5B6478', margin: '0 0 22px', lineHeight: 1.6 }}>
          {description}
        </p>
        {IS_BETA ? (
          // Beta: no checkout yet — let the tester know this tier is coming
          <p style={{ fontSize: 13, color: '#6366F1', fontWeight: 500 }}>
            {TIER_LABEL[requiredTier]} — coming soon to beta testers
          </p>
        ) : (
          <Link
            href="/billing"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              height: 38, padding: '0 22px', borderRadius: 8,
              background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 4px 18px rgba(99,102,241,0.32)',
            }}
          >
            Upgrade to {TIER_LABEL[requiredTier]}
          </Link>
        )}
        {!IS_BETA && (
          <p style={{ fontSize: 11, color: '#3A4155', margin: '12px 0 0' }}>
            You&apos;re on the free Dusk plan
          </p>
        )}
      </div>
    </div>
  )
}
