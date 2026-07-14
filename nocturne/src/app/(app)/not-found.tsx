import Link from 'next/link'

export default function AppNotFound() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: '48px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ width: 56, height: 56, margin: '0 auto 24px', borderRadius: 14, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8' }}>
          <svg width="24" height="24" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="5.5" /><path d="M12.5 12.5 L16 16" />
          </svg>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: '#E2E8F0', margin: '0 0 10px' }}>
          Page not found
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: '#94A3B8', margin: '0 0 28px' }}>
          The link may be broken or the page was moved. Your vault is untouched.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/vault" style={{ height: 40, padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 9, background: '#6366F1', color: '#09090F', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4 L6 9 L11 14" /></svg>
            Back to vault
          </Link>
          <Link href="/help" style={{ height: 40, padding: '0 18px', display: 'inline-flex', alignItems: 'center', borderRadius: 9, border: '1px solid #2D2B45', color: '#94A3B8', fontSize: 14, fontWeight: 500, textDecoration: 'none', background: 'transparent' }}>
            Help Center
          </Link>
        </div>
      </div>
    </div>
  )
}
