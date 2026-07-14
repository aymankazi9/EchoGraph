'use client'

import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090F', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 480, height: 280, background: 'radial-gradient(ellipse at center, rgba(244,63,94,0.07) 0%, rgba(99,102,241,0.05) 50%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

      <Link href="/vault" style={{ position: 'absolute', top: 28, left: 32, display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
        <span style={{ width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(145deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#09090F', fontWeight: 700, fontSize: 12 }}>N</span>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#E2E8F0', letterSpacing: '-0.01em' }}>Nocturne</span>
      </Link>

      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 440, padding: '0 24px' }}>
        <div style={{ width: 64, height: 64, margin: '0 auto 28px', borderRadius: 16, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FB7185' }}>
          <svg width="28" height="28" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 2 L16.5 15.5 H1.5 Z" /><path d="M9 7 v3.5" /><path d="M9 13 v0.01" />
          </svg>
        </div>

        <h1 style={{ fontSize: 23, fontWeight: 600, letterSpacing: '-0.02em', color: '#E2E8F0', margin: '0 0 12px' }}>
          Something jammed on our end
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: '#94A3B8', margin: '0 0 30px' }}>
          A server hit a fault while reaching for your vault. Nothing was lost and nothing was decrypted — your data remains locked and intact.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#5B6478', margin: '-10px 0 20px', wordBreak: 'break-all' }}>{error.message}</p>
        )}

        <div style={{ display: 'flex', gap: 11, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{ height: 46, padding: '0 22px', display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 10, background: '#6366F1', color: '#09090F', fontSize: 14.5, fontWeight: 500, border: 'none', cursor: 'pointer', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3 v4 h-4" /><path d="M14.5 7 A6 6 0 1 0 15 10.5" /></svg>
            Try again
          </button>
          <Link href="/help" style={{ height: 46, padding: '0 22px', display: 'inline-flex', alignItems: 'center', borderRadius: 10, border: '1px solid #2D2B45', color: '#CBD5E1', fontSize: 14.5, fontWeight: 500, textDecoration: 'none', background: 'transparent' }}>
            Visit Help Center
          </Link>
        </div>
      </div>
    </div>
  )
}
