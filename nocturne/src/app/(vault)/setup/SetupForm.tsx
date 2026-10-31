'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useContourField } from '@/components/surgical/use-contour-field'
import { EclipseMark } from '@/components/surgical/eclipse-mark'
import { vaultSetup, getPendingRecoveryBlob, clearPendingRecoveryBlob } from '@/lib/crypto/vault'
import { downloadRecoveryKit, formatRecoveryKit } from '@/lib/crypto/recovery'
import { createClient } from '@/lib/supabase'
import { validateInviteCode } from '@/app/actions/validate-invite'
import { MagicLinkSentCard } from '@/components/auth/magic-link-sent'

// When BETA_MODE is on, new users must supply a valid invite code before
// proceeding with vault setup.  The validated flag is stored in localStorage
// so it survives the Google OAuth redirect.
const BETA_MODE = process.env.NEXT_PUBLIC_BETA_MODE === 'true'
const INVITE_LS_KEY = 'nocturne-invite-ok'

interface Props {
  userId: string
  initialStep?: 0 | 1 | 2 | 3
}

type Status = 'idle' | 'deriving' | 'saving'
type Step = 0 | 1 | 2 | 3

function generateSaltB64(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

function computeStrength(pw: string): number {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 14) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[!@#$%^&*()\-_=+[\]{};':",.<>/?`~\\|]/.test(pw)) score++
  return Math.min(score, 4)
}

// Weak = crimson (the one thing that matters); strength climbs toward white, not a second hue.
const STRENGTH_COLORS = ['#FF3B30', '#FF3B30', '#76767B', '#9A9A9F', '#EDEDED']
const STRENGTH_LABELS = ['', 'Weak…', 'Fair…', 'Good…', 'Strong passphrase']

const STEP_META = [
  { label: 'Create account', sub: 'Sign in with Google or email' },
  { label: 'Set vault passphrase', sub: 'Derives your non-extractable key' },
  { label: 'Save Recovery Kit', sub: 'Your only backdoor-free backup' },
]

const fieldFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }
const fieldBlurFactory = (border: string) => (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = border }

export function SetupForm({ userId, initialStep = 0 }: Props) {
  const heroRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()

  useContourField(canvasRef, { variant: 'hero' })

  // ── Beta invite code gate ─────────────────────────────────────────────────
  // inviteValidated starts as true when beta mode is off, or when localStorage
  // already has the flag set (persists across the Google OAuth redirect).
  const [inviteValidated, setInviteValidated] = useState(() => {
    if (!BETA_MODE) return true
    if (typeof window === 'undefined') return false
    return localStorage.getItem(INVITE_LS_KEY) === '1'
  })
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteChecking, setInviteChecking] = useState(false)

  // Re-check localStorage after hydration (handles SSR mismatch).
  useEffect(() => {
    if (!BETA_MODE) return
    if (localStorage.getItem(INVITE_LS_KEY) === '1') setInviteValidated(true)
  }, [])

  async function handleValidateInvite() {
    setInviteChecking(true)
    setInviteError(null)
    try {
      const result = await validateInviteCode(inviteCode)
      if (result.ok) {
        localStorage.setItem(INVITE_LS_KEY, '1')
        setInviteValidated(true)
      } else {
        setInviteError(result.error)
      }
    } catch {
      setInviteError('Could not validate code. Please try again.')
    } finally {
      setInviteChecking(false)
    }
  }

  // ── Step state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(initialStep)

  // Step 0 — account
  const [emailVal,       setEmailVal]       = useState('')
  const [emailError,     setEmailError]     = useState(false)
  const [emailSending,   setEmailSending]   = useState(false)
  const [emailSent,      setEmailSent]      = useState(false)
  const [emailSentTo,    setEmailSentTo]    = useState('')
  const [emailSendError, setEmailSendError] = useState<string | null>(null)

  // Step 1 — passphrase
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [touchedConfirm, setTouchedConfirm] = useState(false)
  const [vaultError, setVaultError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  // Step 2 — recovery kit
  const [recoveryBlob, setRecoveryBlob] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [saved, setSaved] = useState(false)

  const strength = pass.length > 0 ? computeStrength(pass) : 0
  const mismatch = touchedConfirm && confirm.length > 0 && confirm !== pass
  const busy = status !== 'idle'

  async function handleGoogleSignIn() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function onEmailSend() {
    const v = emailVal.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setEmailError(true); return }
    setEmailError(false)
    setEmailSendError(null)
    setEmailSending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: v,
        options: {
          // Callback routes to /setup automatically for new users (no pbkdf2_salt).
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setEmailSendError(error.message || 'Could not send sign-in link — please try again.')
        return
      }
      setEmailSentTo(v)
      setEmailSent(true)
    } finally {
      setEmailSending(false)
    }
  }

  function onEmailReset() {
    setEmailSent(false); setEmailSentTo(''); setEmailVal(''); setEmailSendError(null)
  }

  async function onCreateVault() {
    if (strength < 2) { setVaultError('Choose a stronger passphrase — try adding length or a number.'); return }
    if (pass !== confirm) { setVaultError('Passphrases do not match.'); return }
    setVaultError(null)

    try {
      setStatus('deriving')
      const salt = generateSaltB64()
      const recoverySalt = generateSaltB64()
      const { wrappedKeyB64 } = await vaultSetup(pass, salt, recoverySalt)
      setStatus('saving')

      const supabase = createClient()
      const { error: dbError } = await supabase
        .from('users')
        .update({ pbkdf2_salt: salt, encrypted_master_key: wrappedKeyB64, recovery_salt: recoverySalt })
        .eq('id', userId)

      if (dbError) throw new Error(dbError.message)

      const blob = getPendingRecoveryBlob()
      setRecoveryBlob(blob)
      setStatus('idle')
      setStep(2)
    } catch (err) {
      setStatus('idle')
      setVaultError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  function onDownload() {
    const blob = recoveryBlob
    if (!blob) return
    downloadRecoveryKit(blob)
    setDownloaded(true)
  }

  function onEnterNocturne() {
    if (!downloaded || !saved) return
    clearPendingRecoveryBlob()
    document.cookie = 'nocturne-vault-warm=1; max-age=3600; path=/; SameSite=Strict'
    router.push('/vault')
  }

  // ── Beta invite code wall ─────────────────────────────────────────────────
  // Shown before the rest of the setup flow when BETA_MODE=true and the invite
  // code hasn't been validated yet.
  if (BETA_MODE && !inviteValidated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Wordmark */}
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 36, textDecoration: 'none' }}>
            <EclipseMark size={28} />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, letterSpacing: '0.34em', color: '#EDEDED' }}>NOCTURNE</span>
          </a>

          <h2 style={{ fontFamily: 'var(--font-display)', fontStretch: '82%', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: '#EDEDED', margin: '0 0 8px' }}>
            Invite code required
          </h2>
          <p style={{ fontSize: 14, color: '#9A9A9F', margin: '0 0 28px', lineHeight: 1.6 }}>
            Nocturne is in closed beta. Enter your invite code to create an account.
            Don&apos;t have one?{' '}
            <a href="/#beta-request" data-link style={{ position: 'relative', color: '#FF3B30', textDecoration: 'none' }}>Request access →</a>
          </p>

          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: '#76767B', marginBottom: 8 }}>
            INVITE CODE
          </label>
          <input
            type="text"
            placeholder="nocturne-beta-xxxx"
            value={inviteCode}
            onChange={(e) => { setInviteCode(e.target.value); setInviteError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && handleValidateInvite()}
            autoFocus
            style={{
              width: '100%', height: 46,
              background: '#111112', border: '1px solid rgba(255,255,255,0.08)',
              color: '#EDEDED', padding: '0 14px', fontSize: 15,
              outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={fieldFocus}
            onBlur={fieldBlurFactory('rgba(255,255,255,0.08)')}
          />
          {inviteError && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FF3B30', margin: '8px 0 0' }}>{inviteError}</p>
          )}
          <button
            type="button"
            onClick={handleValidateInvite}
            disabled={inviteChecking || !inviteCode.trim()}
            style={{
              width: '100%', height: 46, marginTop: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              fontSize: 15, fontWeight: 500,
              background: '#FF3B30', color: '#0A0A0A',
              border: 'none', cursor: inviteChecking ? 'not-allowed' : 'pointer',
              opacity: (inviteChecking || !inviteCode.trim()) ? 0.65 : 1,
            }}
          >
            {inviteChecking ? 'Checking…' : 'Continue →'}
          </button>
        </div>
      </div>
    )
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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: '#9A9A9F' }}>END-TO-END ENCRYPTED SETUP</span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontStretch: '82%', fontSize: 'clamp(30px,3.4vw,42px)', lineHeight: 1.08, letterSpacing: '-0.025em', fontWeight: 600, margin: '0 0 32px', color: '#EDEDED' }}>
            Set up your<br />
            <span style={{ color: '#FF3B30' }}>private vault.</span>
          </h1>

          {/* Vertical stepper */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {STEP_META.map((s, i) => {
              const isDone = i < step
              const isCurrent = i === step
              const isPending = i > step
              return (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: i < STEP_META.length - 1 ? 20 : 0, position: 'relative' }}>
                  {/* Connector line */}
                  {i < STEP_META.length - 1 && (
                    <div style={{ position: 'absolute', left: 13, top: 27, bottom: 0, width: 1, background: isDone ? '#FF3B30' : 'rgba(255,255,255,0.08)' }} />
                  )}
                  {/* Badge */}
                  <span style={{
                    width: 27, height: 27, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                    background: isCurrent ? 'rgba(255,255,255,0.05)' : '#0A0A0A',
                    border: isCurrent || isDone ? '1px solid #FF3B30' : '1px solid rgba(255,255,255,0.14)',
                    color: isDone ? '#FF3B30' : isCurrent ? '#EDEDED' : '#76767B',
                    zIndex: 1,
                  }}>
                    {isDone ? (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="2 6 5 9 10 3" /></svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div style={{ paddingTop: 3 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: isCurrent ? '#EDEDED' : isPending ? '#76767B' : '#FF3B30', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: '#76767B' }}>{s.sub}</div>
                  </div>
                </div>
              )
            })}
          </div>
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

        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 360 }}>

          {/* Step 3 — Done */}
          {step === 3 && (
            <div data-anim style={{ textAlign: 'center' }}>
              <div data-pop style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 24px' }}>
                <EclipseMark size={56} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontStretch: '82%', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 10px', color: '#EDEDED' }}>Your vault is ready.</h2>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: '#9A9A9F', margin: '0 0 32px' }}>
                Everything you upload is now encrypted with a key only you control. Your passphrase never touches our servers.
              </p>
              <a
                href="/vault"
                data-btn
                data-shine
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', height: 48, fontSize: 15, fontWeight: 500, background: '#FF3B30', color: '#0A0A0A', textDecoration: 'none' }}
              >
                Go to dashboard <span data-arrow style={{ fontFamily: 'var(--font-mono)', color: '#0A0A0A' }}>→</span>
              </a>
            </div>
          )}

          {/* Steps 0–2: 4-cell step indicator */}
          {step < 3 && (
            <div data-step style={{ marginBottom: 28, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {[0, 1, 2, 3].map((i) => {
                const done = i < step
                const active = i === step
                return (
                  <div
                    key={i}
                    style={{
                      textAlign: 'center',
                      padding: '7px 4px',
                      borderLeft: i ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      borderTop: active ? '2px solid #FF3B30' : '2px solid transparent',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.04em',
                      color: done || active ? '#EDEDED' : '#5E5E62',
                    }}
                  >
                    {done ? '[✓]' : i + 1}
                  </div>
                )
              })}
            </div>
          )}

          {/* Step 0 — Create account */}
          {step === 0 && (
            <div data-anim>
              <h2 style={{ fontFamily: 'var(--font-display)', fontStretch: '82%', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#EDEDED' }}>Create your account</h2>
              <p style={{ fontSize: 14, color: '#9A9A9F', margin: '0 0 30px' }}>Start with the full core product — free forever, no card.</p>

              <button
                data-btn
                data-shine
                onClick={handleGoogleSignIn}
                style={{ width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, fontSize: 15, fontWeight: 500, color: '#0A0A0A', background: '#EDEDED', border: 'none', cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: '#76767B', whiteSpace: 'nowrap' }}>OR WITH EMAIL</span>
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>

              {emailSent ? (
                <MagicLinkSentCard
                  email={emailSentTo}
                  onReset={onEmailReset}
                  note="You can close this tab — your vault setup will continue wherever you open that link."
                />
              ) : (
                <>
                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: '#76767B', margin: '0 0 8px' }}>EMAIL ADDRESS</label>
                  <input
                    type="email"
                    placeholder="you@university.edu"
                    value={emailVal}
                    onChange={e => { setEmailVal(e.target.value); setEmailError(false); setEmailSendError(null) }}
                    onKeyDown={e => e.key === 'Enter' && onEmailSend()}
                    disabled={emailSending}
                    style={{ width: '100%', height: 46, background: '#111112', border: '1px solid rgba(255,255,255,0.08)', color: '#EDEDED', padding: '0 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlurFactory('rgba(255,255,255,0.08)')}
                  />
                  {emailError     && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FF3B30', margin: '8px 0 0' }}>Enter a valid email address.</p>}
                  {emailSendError && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FF3B30', margin: '8px 0 0' }}>{emailSendError}</p>}

                  <button
                    data-btn
                    data-shine
                    onClick={onEmailSend}
                    disabled={emailSending}
                    style={{ width: '100%', height: 46, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontSize: 15, fontWeight: 500, background: '#FF3B30', color: '#0A0A0A', border: 'none', cursor: emailSending ? 'not-allowed' : 'pointer', opacity: emailSending ? 0.7 : 1 }}
                    onMouseEnter={e => { if (!emailSending) e.currentTarget.style.background = '#FF5147' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#FF3B30' }}
                  >
                    {emailSending ? 'Sending…' : <>Send sign-up link <span data-arrow style={{ fontFamily: 'var(--font-mono)', color: '#0A0A0A' }}>→</span></>}
                  </button>
                </>
              )}

              <p style={{ fontSize: 13.5, color: '#76767B', margin: '28px 0 0', textAlign: 'center' }}>
                Already have an account?{' '}
                <Link href="/login" data-link style={{ position: 'relative', color: '#FF3B30', fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
              </p>
            </div>
          )}

          {/* Step 1 — Vault passphrase */}
          {step === 1 && (
            <div data-anim>
              <h2 style={{ fontFamily: 'var(--font-display)', fontStretch: '82%', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#EDEDED' }}>Create your vault passphrase</h2>
              <p style={{ fontSize: 14, color: '#9A9A9F', margin: '0 0 26px' }}>This derives the key that encrypts everything — choose something memorable but strong.</p>

              {/* Passphrase input */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: '#76767B', margin: '0 0 8px' }}>PASSPHRASE</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    disabled={busy}
                    autoComplete="new-password"
                    style={{ width: '100%', height: 46, background: '#111112', border: '1px solid rgba(255,255,255,0.08)', color: '#EDEDED', padding: '0 42px 0 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                    onFocus={fieldFocus}
                    onBlur={fieldBlurFactory('rgba(255,255,255,0.08)')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#76767B', padding: 0 }}
                    aria-label={showPass ? 'Hide passphrase' : 'Show passphrase'}
                  >
                    {showPass ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>

                {/* Strength meter */}
                {pass.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                      {[1, 2, 3, 4].map(level => (
                        <div key={level} style={{ flex: 1, height: 2, background: strength >= level ? STRENGTH_COLORS[strength] : 'rgba(255,255,255,0.08)', transition: 'background .2s' }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#76767B' }}>{STRENGTH_LABELS[strength]}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#4A4A4E' }}>PBKDF2 · 310,000 iterations</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm input */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: '#76767B', margin: '0 0 8px' }}>CONFIRM PASSPHRASE</label>
                <input
                  type="password"
                  placeholder="Repeat your passphrase"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onBlur={() => setTouchedConfirm(true)}
                  disabled={busy}
                  autoComplete="new-password"
                  style={{ width: '100%', height: 46, background: '#111112', border: `1px solid ${mismatch ? '#FF3B30' : 'rgba(255,255,255,0.08)'}`, color: '#EDEDED', padding: '0 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                />
                {mismatch && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FF3B30', margin: '6px 0 0' }}>Passphrases don&apos;t match.</p>}
              </div>

              {/* No-backdoor warning */}
              <div style={{ border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.05)', padding: '12px 14px', marginBottom: 18 }}>
                <p style={{ fontSize: 12.5, lineHeight: 1.55, color: '#9A9A9F', margin: 0 }}>
                  <span style={{ color: '#FF3B30', fontWeight: 600 }}>No backdoor.</span> If you lose this passphrase and your Recovery Kit, your data is gone forever. There is no account recovery.
                </p>
              </div>

              {vaultError && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FF3B30', margin: '0 0 12px' }} role="alert">{vaultError}</p>}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setStep(0)}
                  disabled={busy}
                  style={{ height: 46, paddingLeft: 18, paddingRight: 18, fontSize: 14, fontWeight: 500, background: 'transparent', border: '1px solid rgba(255,255,255,0.16)', color: '#9A9A9F', cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  Back
                </button>
                <button
                  data-btn
                  data-shine
                  onClick={onCreateVault}
                  disabled={busy || pass.length < 8 || pass !== confirm}
                  style={{ flex: 1, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontSize: 15, fontWeight: 500, background: '#FF3B30', color: '#0A0A0A', border: 'none', cursor: (busy || pass.length < 8 || pass !== confirm) ? 'not-allowed' : 'pointer', opacity: (busy || pass.length < 8 || pass !== confirm) ? 0.5 : 1 }}
                >
                  {busy ? (status === 'deriving' ? 'Deriving key…' : 'Saving…') : <>Create vault <span data-arrow style={{ fontFamily: 'var(--font-mono)', color: '#0A0A0A' }}>→</span></>}
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Recovery Kit */}
          {step === 2 && (
            <div data-anim>
              <h2 style={{ fontFamily: 'var(--font-display)', fontStretch: '82%', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#EDEDED' }}>Save your Recovery Kit</h2>
              <p style={{ fontSize: 14, color: '#9A9A9F', margin: '0 0 22px' }}>If you lose your passphrase, this is your only way back in. Store it somewhere safe.</p>

              {/* Kit card — square corners; dashed border only around the key text itself */}
              <div style={{ background: '#0C0C0D', padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: '#76767B', marginBottom: 8 }}>YOUR RECOVERY KIT</div>
                <div style={{ border: '1px dashed rgba(255,255,255,0.18)', padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#EDEDED', wordBreak: 'break-all', lineHeight: 1.6, userSelect: 'all' }}>
                  {recoveryBlob ? formatRecoveryKit(recoveryBlob) : '—'}
                </div>
              </div>

              {/* Download button */}
              <button
                data-btn
                onClick={onDownload}
                style={{ width: '100%', height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontSize: 14, fontWeight: 500, background: 'transparent', border: '1px solid rgba(255,255,255,0.16)', color: '#EDEDED', cursor: 'pointer', marginBottom: 16 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                {downloaded ? 'Download again' : 'Download Recovery Kit'}
              </button>

              {/* Checkbox */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={e => setSaved(e.target.checked)}
                  style={{ marginTop: 2, accentColor: '#FF3B30', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13.5, color: '#9A9A9F', lineHeight: 1.5 }}>I&apos;ve saved my Recovery Kit somewhere safe and understand I cannot recover my vault without it.</span>
              </label>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{ height: 46, paddingLeft: 18, paddingRight: 18, fontSize: 14, fontWeight: 500, background: 'transparent', border: '1px solid rgba(255,255,255,0.16)', color: '#9A9A9F', cursor: 'pointer' }}
                >
                  Back
                </button>
                <button
                  data-btn
                  data-shine
                  onClick={onEnterNocturne}
                  disabled={!downloaded || !saved}
                  style={{ flex: 1, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontSize: 15, fontWeight: 500, background: '#FF3B30', color: '#0A0A0A', border: 'none', cursor: (!downloaded || !saved) ? 'not-allowed' : 'pointer', opacity: (!downloaded || !saved) ? 0.4 : 1 }}
                >
                  Enter Nocturne <span data-arrow style={{ fontFamily: 'var(--font-mono)', color: '#0A0A0A' }}>→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
