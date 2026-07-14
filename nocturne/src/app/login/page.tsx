'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AuthBrandCanvas } from '@/components/auth/auth-brand-canvas'

export default function LoginPage() {
  const heroRef = useRef<HTMLElement>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [showError, setShowError] = useState(false)

  async function handleGoogleSignIn() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    // Browser redirects — no setLoading(false) needed
  }

  async function onSend() {
    const v = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setShowError(true); return }
    setShowError(false)
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOtp({ email: v, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
    setSent(true); setSentEmail(v); setLoading(false)
  }

  function onReset() {
    setSent(false); setSentEmail(''); setEmail('')
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') onSend()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#09090F' }}>
      {/* BRAND PANEL */}
      <section
        data-brand
        ref={heroRef}
        style={{
          flex: '1.05 1 0', minWidth: 0, overflow: 'hidden', position: 'relative',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '48px 56px', borderRight: '1px solid #191827',
        }}
      >
        <AuthBrandCanvas sectionRef={heroRef} />

        {/* Indigo ambient glow */}
        <div style={{
          position: 'absolute', top: '-6%', left: '-4%', width: 560, height: 360, zIndex: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.06) 50%, transparent 72%)',
          filter: 'blur(54px)',
        }} />
        {/* Rose ambient glow */}
        <div style={{
          position: 'absolute', bottom: '-10%', right: '-6%', width: 520, height: 360, zIndex: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(244,63,94,0.12) 0%, rgba(139,92,246,0.05) 50%, transparent 72%)',
          filter: 'blur(56px)',
        }} />

        {/* Wordmark */}
        <a href="/" style={{ zIndex: 2, position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start', textDecoration: 'none' }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(145deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#09090F', fontWeight: 700, fontSize: 15, boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 14px rgba(99,102,241,0.35)' }}>N</span>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', color: '#E2E8F0' }}>Nocturne</span>
        </a>

        {/* Middle content */}
        <div style={{ zIndex: 2, position: 'relative', maxWidth: 520 }}>
          {/* Live dot badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '5px 13px 5px 11px', borderRadius: 9999, border: '1px solid #2D2B45', background: 'rgba(17,17,24,0.55)', backdropFilter: 'blur(8px)', marginBottom: 26 }}>
            <span style={{ position: 'relative', width: 7, height: 7, flexShrink: 0 }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#F43F5E', animation: 'noct-livedot 1.8s ease-in-out infinite' }} />
            </span>
            <span style={{ fontSize: 12, letterSpacing: '0.04em', color: '#94A3B8' }}>Measuring professor emphasis, live</span>
          </div>
          <h1 style={{ fontSize: 'clamp(32px,3.6vw,46px)', lineHeight: 1.08, letterSpacing: '-0.025em', fontWeight: 600, margin: 0, color: '#E2E8F0' }}>
            Welcome back to<br />
            <span style={{ background: 'linear-gradient(100deg,#A5B4FC 0%,#A78BFA 45%,#FB7185 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>the Red Zone.</span>
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: '#94A3B8', margin: '22px 0 0', maxWidth: 430 }}>
            Unlock your encrypted vault and pick up exactly where the lecture left off — every keyword still ranked by how likely it is to be on the exam.
          </p>
        </div>

        {/* Trust row */}
        <div style={{ zIndex: 2, position: 'relative', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: '#5B6478' }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, border: '1px solid #2D2B45', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8', flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            Zero-knowledge encrypted
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: '#3F485C' }}>Keys never leave your device</span>
        </div>
      </section>

      {/* FORM PANEL */}
      <section
        data-form
        style={{ position: 'relative', width: 520, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', background: '#09090F' }}
      >
        <div data-formbg style={{ display: 'none', position: 'absolute', inset: 0, background: 'radial-gradient(620px circle at 50% 0%, rgba(99,102,241,0.08), transparent 60%)', pointerEvents: 'none' }} />

        <div data-anim style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 360 }}>
          {/* Mobile logo — visible only when brand panel is hidden */}
          <a href="/" style={{ display: 'none', alignItems: 'center', gap: 10, marginBottom: 32, textDecoration: 'none' }} className="auth-mobile-logo">
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(145deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#09090F', fontWeight: 700, fontSize: 15 }}>N</span>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0' }}>Nocturne</span>
          </a>

          <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#E2E8F0' }}>Sign in</h2>
          <p style={{ fontSize: 14, color: '#94A3B8', margin: '0 0 30px' }}>Continue to your vault to keep studying.</p>

          {/* Google button */}
          <button
            data-btn
            data-shine
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{ width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, borderRadius: 9, fontSize: 15, fontWeight: 500, color: '#E2E8F0', background: '#13121C', border: '1px solid #2D2B45', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {loading && !sent ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
            <span style={{ flex: 1, height: 1, background: '#1E1E2E' }} />
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5B6478', whiteSpace: 'nowrap' }}>or with email</span>
            <span style={{ flex: 1, height: 1, background: '#1E1E2E' }} />
          </div>

          {/* Email flow */}
          {!sent ? (
            <div>
              <label style={{ display: 'block', fontSize: 12.5, color: '#94A3B8', margin: '0 0 8px' }}>Email address</label>
              <input
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={e => { setEmail(e.target.value); setShowError(false) }}
                onKeyDown={onKey}
                style={{ width: '100%', height: 46, borderRadius: 9, background: '#13121C', border: '1px solid #2D2B45', color: '#E2E8F0', padding: '0 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
              />
              {showError && <p style={{ fontSize: 12, color: '#FB7185', margin: '8px 0 0' }}>Enter a valid email address.</p>}
              <button
                data-btn
                data-shine
                onClick={onSend}
                disabled={loading}
                style={{ width: '100%', height: 46, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 9, fontSize: 15, fontWeight: 500, background: '#6366F1', color: '#09090F', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 8px 26px rgba(99,102,241,0.32)', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Sending…' : <>Send magic link <span data-arrow style={{ color: '#09090F' }}>→</span></>}
              </button>
            </div>
          ) : (
            <div data-anim style={{ border: '1px solid rgba(99,102,241,0.32)', background: 'rgba(99,102,241,0.07)', borderRadius: 11, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.16)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A5B4FC', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#E2E8F0' }}>Check your inbox</span>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#94A3B8', margin: 0 }}>
                We sent a secure sign-in link to <span style={{ color: '#E2E8F0' }}>{sentEmail}</span>. It expires in 15 minutes.
              </p>
              <button onClick={onReset} data-link style={{ position: 'relative', marginTop: 14, background: 'none', border: 'none', padding: 0, fontSize: 13, color: '#818CF8', cursor: 'pointer' }}>Use a different email</button>
            </div>
          )}

          {/* Reassurance */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 24, paddingTop: 22, borderTop: '1px solid #191827' }}>
            <span style={{ marginTop: 1, flexShrink: 0, color: '#5B6478' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: '#5B6478', margin: 0 }}>
              Your passphrase and encryption keys never leave your device. Nocturne stores only opaque blobs it cannot read.
            </p>
          </div>

          {/* Footer link */}
          <p style={{ fontSize: 13.5, color: '#5B6478', margin: '28px 0 0', textAlign: 'center' }}>
            New to Nocturne?{' '}
            <Link href="/setup" data-link style={{ position: 'relative', color: '#A5B4FC', fontWeight: 500, textDecoration: 'none' }}>Create your vault</Link>
          </p>
        </div>

        {/* Terms */}
        <p style={{ position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center', fontSize: 11.5, color: '#3F485C', padding: '0 24px', margin: 0 }}>
          By continuing you agree to our{' '}
          <Link href="/terms" style={{ color: '#5B6478', textDecoration: 'none' }}>Terms</Link>
          {' '}&amp;{' '}
          <Link href="/privacy" style={{ color: '#5B6478', textDecoration: 'none' }}>Privacy Policy</Link>.
        </p>
      </section>
    </div>
  )
}
