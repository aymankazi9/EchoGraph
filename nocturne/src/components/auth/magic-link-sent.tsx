'use client'

// Shared "check your inbox" card — used on both /login and /setup Step 0.
// Keep the two sites in sync by changing this one component.

interface Props {
  email:   string
  onReset: () => void
  /** Extra note shown below the expiry line. Pass on /setup to tell the user they can close the tab. */
  note?: string
}

export function MagicLinkSentCard({ email, onReset, note }: Props) {
  return (
    <div
      data-anim
      style={{
        border: '1px solid rgba(99,102,241,0.32)',
        background: 'rgba(99,102,241,0.07)',
        borderRadius: 11,
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'rgba(99,102,241,0.16)', border: '1px solid rgba(99,102,241,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#A5B4FC', flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </span>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#E2E8F0' }}>Check your inbox</span>
      </div>

      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#94A3B8', margin: 0 }}>
        We sent a secure sign-in link to{' '}
        <span style={{ color: '#E2E8F0' }}>{email}</span>.{' '}
        It expires in 15 minutes.
      </p>

      {note && (
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: '#5B6478', margin: '8px 0 0' }}>
          {note}
        </p>
      )}

      <button
        onClick={onReset}
        data-link
        style={{
          position: 'relative', marginTop: 14,
          background: 'none', border: 'none', padding: 0,
          fontSize: 13, color: '#818CF8', cursor: 'pointer',
        }}
      >
        Use a different email
      </button>
    </div>
  )
}
