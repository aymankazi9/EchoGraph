'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useContourField } from '@/components/surgical/use-contour-field'
import { EclipseMark } from '@/components/surgical/eclipse-mark'
import { MagicLinkSentCard } from '@/components/auth/magic-link-sent'

function LoginContent() {
  const heroRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const oauthInFlight = useRef(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [showError, setShowError] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useContourField(canvasRef, { variant: 'hero' })

  // Read and surface auth errors redirected back from /auth/callback.
  const authError = searchParams.get('error')
  const AUTH_ERROR_MESSAGES: Record<string, string> = {
    auth_failed:     'Something went wrong signing in — please try again.',
    missing_code:    'The sign-in link was incomplete — please try again.',
    session_expired: 'Sign-in session expired — please try again.',
    link_expired:    'This sign-in link has expired or was already used — request a new one.',
  }
  const authErrorMsg = authError
    ? (AUTH_ERROR_MESSAGES[authError] ?? 'Sign-in failed — please try again.')
    : null

  useEffect(() => {
    if (authError) console.error('[login] auth error from callback:', authError)
  }, [authError])

  // Thread an optional post-auth destination through the callback URL.
  // Only relative paths are accepted; anything else is dropped.
  function callbackUrl(): string {
    const next = searchParams.get('next') ?? ''
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : ''
    const base = `${window.location.origin}/auth/callback`
    return safeNext ? `${base}?next=${encodeURIComponent(safeNext)}` : base
  }

  async function handleGoogleSignIn() {
    // Synchronous ref guard — blocks a second call before the first redirect
    // fires, preventing it from overwriting the PKCE code-verifier cookie.
    if (oauthInFlight.current) return
    oauthInFlight.current = true
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    })
    // Browser navigates away on success — no cleanup needed.
    // If signInWithOAuth somehow resolves without redirecting (e.g. a network
    // error before the redirect fires), release the guard so the user can retry.
    oauthInFlight.current = false
    setLoading(false)
  }

  async function onSend() {
    const v = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setShowError(true); return }
    setShowError(false)
    setSendError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: v,
      options: { emailRedirectTo: callbackUrl() },
    })
    setLoading(false)
    if (error) {
      setSendError(error.message || 'Could not send sign-in link — please try again.')
      return
    }
    setSent(true)
    setSentEmail(v)
  }

  function onReset() {
    setSent(false); setSentEmail(''); setEmail(''); setSendError(null)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') onSend()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0A0A0A' }}>
      {/* BRAND PANEL */}
      <section
        data-brand
        ref={heroRef}
        style={{
          flex: '1.05 1 0', minWidth: 0, overflow: 'hidden', position: 'relative',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '48px 56px', borderRight: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />

        {/* Wordmark */}
        <a href="/" style={{ zIndex: 2, position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 12, alignSelf: 'flex-start', textDecoration: 'none' }}>
          <EclipseMark size={28} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, letterSpacing: '0.34em', color: '#EDEDED' }}>NOCTURNE</span>
        </a>

        {/* Middle content */}
        <div style={{ zIndex: 2, position: 'relative', maxWidth: 520 }}>
          {/* Live dot badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '5px 13px 5px 11px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(12,12,13,0.7)', backdropFilter: 'blur(8px)', marginBottom: 26 }}>
            <span style={{ position: 'relative', width: 7, height: 7, flexShrink: 0 }}>
              <span style={{ position: 'absolute', inset: 0, background: '#FF3B30', animation: 'noct-livedot 1.8s ease-in-out infinite' }} />
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: '#9A9A9F' }}>MEASURING PROFESSOR EMPHASIS, LIVE</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontStretch: '82%', fontSize: 'clamp(32px,3.6vw,46px)', lineHeight: 1.08, letterSpacing: '-0.025em', fontWeight: 600, margin: 0, color: '#EDEDED' }}>
            Welcome back to<br />
            <span style={{ color: '#FF3B30' }}>the Red Zone.</span>
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: '#9A9A9F', margin: '22px 0 0', maxWidth: 430 }}>
            Unlock your encrypted vault and pick up exactly where the lecture left off — every keyword still ranked by how likely it is to be on the exam.
          </p>
        </div>

        {/* Trust row */}
        <div style={{ zIndex: 2, position: 'relative', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: '#76767B' }}>
            <span style={{ width: 24, height: 24, border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A9A9F', flexShrink: 0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            Zero-knowledge encrypted
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#4A4A4E' }}>Keys never leave your device</span>
        </div>
      </section>

      {/* FORM PANEL */}
      <section
        data-form
        style={{ position: 'relative', width: 520, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', background: '#0A0A0A', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div data-formbg style={{ display: 'none', position: 'absolute', inset: 0, background: 'radial-gradient(620px circle at 50% 0%, rgba(255,255,255,0.04), transparent 60%)', pointerEvents: 'none' }} />

        <div data-anim style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 360 }}>
          {/* Mobile logo — visible only when brand panel is hidden */}
          <a href="/" style={{ display: 'none', alignItems: 'center', gap: 10, marginBottom: 32, textDecoration: 'none' }} className="auth-mobile-logo">
            <EclipseMark size={26} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, letterSpacing: '0.34em', color: '#EDEDED' }}>NOCTURNE</span>
          </a>

          <h2 style={{ fontFamily: 'var(--font-display)', fontStretch: '82%', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#EDEDED' }}>Sign in</h2>
          <p style={{ fontSize: 14, color: '#9A9A9F', margin: '0 0 30px' }}>Continue to your vault to keep studying.</p>

          {/* Auth error banner — shown when /auth/callback redirects back with ?error= */}
          {authErrorMsg && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.3)', marginBottom: 20 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p style={{ fontSize: 13, color: '#FF3B30', margin: 0, lineHeight: 1.5 }}>{authErrorMsg}</p>
            </div>
          )}

          {/* Google button — "Secondary (light)" per THEME_SURGICAL §4 */}
          <button
            data-btn
            data-shine
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{ width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, fontSize: 15, fontWeight: 500, color: '#0A0A0A', background: '#EDEDED', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
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
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: '#76767B', whiteSpace: 'nowrap' }}>OR WITH EMAIL</span>
            <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Email flow */}
          {!sent ? (
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: '#76767B', margin: '0 0 8px' }}>EMAIL ADDRESS</label>
              <input
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={e => { setEmail(e.target.value); setShowError(false); setSendError(null) }}
                onKeyDown={onKey}
                style={{ width: '100%', height: 46, background: '#111112', border: '1px solid rgba(255,255,255,0.08)', color: '#EDEDED', padding: '0 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
              />
              {showError && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FF3B30', margin: '8px 0 0' }}>Enter a valid email address.</p>}
              {sendError && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FF3B30', margin: '8px 0 0' }}>{sendError}</p>}
              <button
                data-btn
                data-shine
                onClick={onSend}
                disabled={loading}
                style={{ width: '100%', height: 46, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontSize: 15, fontWeight: 500, background: '#FF3B30', color: '#0A0A0A', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#FF5147' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FF3B30' }}
              >
                {loading ? 'Sending…' : <>Send magic link <span data-arrow style={{ fontFamily: 'var(--font-mono)', color: '#0A0A0A' }}>→</span></>}
              </button>
            </div>
          ) : (
            <MagicLinkSentCard email={sentEmail} onReset={onReset} />
          )}

          {/* Reassurance */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 24, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ marginTop: 1, flexShrink: 0, color: '#76767B' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: '#76767B', margin: 0 }}>
              Your passphrase and encryption keys never leave your device. Nocturne stores only opaque blobs it cannot read.
            </p>
          </div>

          {/* Footer link */}
          <p style={{ fontSize: 13.5, color: '#76767B', margin: '28px 0 0', textAlign: 'center' }}>
            New to Nocturne?{' '}
            <Link href="/setup" data-link style={{ position: 'relative', color: '#FF3B30', fontWeight: 500, textDecoration: 'none' }}>Create your vault</Link>
          </p>
        </div>

        {/* Terms */}
        <p style={{ position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center', fontSize: 11.5, color: '#4A4A4E', padding: '0 24px', margin: 0 }}>
          By continuing you agree to our{' '}
          <Link href="/terms" style={{ color: '#76767B', textDecoration: 'none' }}>Terms</Link>
          {' '}&amp;{' '}
          <Link href="/privacy" style={{ color: '#76767B', textDecoration: 'none' }}>Privacy Policy</Link>.
        </p>
      </section>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
