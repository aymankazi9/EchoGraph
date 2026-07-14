'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AuthBrandCanvas } from '@/components/auth/auth-brand-canvas'
import { vaultSetup, getPendingRecoveryBlob, clearPendingRecoveryBlob } from '@/lib/crypto/vault'
import { downloadRecoveryKit, formatRecoveryKit } from '@/lib/crypto/recovery'
import { createClient } from '@/lib/supabase'

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

const STRENGTH_COLORS = ['#FB7185', '#FB7185', '#FBBF24', '#A78BFA', '#2DD4BF']
const STRENGTH_LABELS = ['', 'Weak…', 'Fair…', 'Good…', 'Strong passphrase']

const STEP_META = [
  { label: 'Create account', sub: 'Sign in with Google or email' },
  { label: 'Set vault passphrase', sub: 'Derives your non-extractable key' },
  { label: 'Save Recovery Kit', sub: 'Your only backdoor-free backup' },
]

export function SetupForm({ userId, initialStep = 0 }: Props) {
  const heroRef = useRef<HTMLElement>(null)
  const router = useRouter()

  // Step state
  const [step, setStep] = useState<Step>(initialStep)

  // Step 0 — account
  const [emailVal, setEmailVal] = useState('')
  const [emailError, setEmailError] = useState(false)

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

  function onEmailContinue() {
    const v = emailVal.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setEmailError(true); return }
    setEmailError(false)
    setStep(1)
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

  // Progress bars (steps 0–2)
  const progressBars = step < 3 ? [0, 1, 2].map(i => ({ active: i === step, done: i < step })) : []

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
        <div style={{ position: 'absolute', top: '-6%', left: '-4%', width: 560, height: 360, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.06) 50%, transparent 72%)', filter: 'blur(54px)' }} />
        {/* Rose ambient glow */}
        <div style={{ position: 'absolute', bottom: '-10%', right: '-6%', width: 520, height: 360, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(244,63,94,0.12) 0%, rgba(139,92,246,0.05) 50%, transparent 72%)', filter: 'blur(56px)' }} />

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
            <span style={{ fontSize: 12, letterSpacing: '0.04em', color: '#94A3B8' }}>End-to-end encrypted setup</span>
          </div>

          <h1 style={{ fontSize: 'clamp(30px,3.4vw,42px)', lineHeight: 1.08, letterSpacing: '-0.025em', fontWeight: 600, margin: '0 0 32px', color: '#E2E8F0' }}>
            Set up your<br />
            <span style={{ background: 'linear-gradient(100deg,#A5B4FC 0%,#A78BFA 45%,#FB7185 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>private vault.</span>
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
                    <div style={{ position: 'absolute', left: 13, top: 27, bottom: 0, width: 1.5, background: isDone ? 'rgba(99,102,241,0.5)' : '#1E1E2E' }} />
                  )}
                  {/* Badge */}
                  <span style={{
                    width: 27, height: 27, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600,
                    background: isCurrent || isDone ? 'rgba(99,102,241,0.18)' : '#111118',
                    border: isCurrent || isDone ? '1.5px solid rgba(99,102,241,0.55)' : '1.5px solid #2D2B45',
                    color: isCurrent || isDone ? '#A5B4FC' : '#5B6478',
                    zIndex: 1,
                  }}>
                    {isDone ? (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="2 6 5 9 10 3" /></svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div style={{ paddingTop: 3 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: isCurrent ? '#E2E8F0' : isPending ? '#5B6478' : '#A5B4FC', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: '#5B6478' }}>{s.sub}</div>
                  </div>
                </div>
              )
            })}
          </div>
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

        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 360 }}>

          {/* Step 3 — Done */}
          {step === 3 && (
            <div data-anim style={{ textAlign: 'center' }}>
              <div data-pop style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#818CF8' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 10px', color: '#E2E8F0' }}>Your vault is ready.</h2>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: '#94A3B8', margin: '0 0 32px' }}>
                Everything you upload is now encrypted with a key only you control. Your passphrase never touches our servers.
              </p>
              <a
                href="/vault"
                data-btn
                data-shine
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', height: 48, borderRadius: 9, fontSize: 15, fontWeight: 500, background: '#6366F1', color: '#09090F', textDecoration: 'none', boxShadow: '0 8px 26px rgba(99,102,241,0.32)' }}
              >
                Go to dashboard <span data-arrow style={{ color: '#09090F' }}>→</span>
              </a>
            </div>
          )}

          {/* Steps 0–2: progress bars header */}
          {step < 3 && (
            <div data-step style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {progressBars.map((bar, i) => (
                    <div key={i} style={{ width: 28, height: 3, borderRadius: 9999, background: bar.done ? '#6366F1' : bar.active ? '#818CF8' : '#2D2B45' }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: '#5B6478' }}>Step {step + 1} of 3</span>
              </div>
            </div>
          )}

          {/* Step 0 — Create account */}
          {step === 0 && (
            <div data-anim>
              <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#E2E8F0' }}>Create your account</h2>
              <p style={{ fontSize: 14, color: '#94A3B8', margin: '0 0 30px' }}>Start with the full core product — free forever, no card.</p>

              <button
                data-btn
                data-shine
                onClick={handleGoogleSignIn}
                style={{ width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11, borderRadius: 9, fontSize: 15, fontWeight: 500, color: '#E2E8F0', background: '#13121C', border: '1px solid #2D2B45', cursor: 'pointer' }}
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
                <span style={{ flex: 1, height: 1, background: '#1E1E2E' }} />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#5B6478', whiteSpace: 'nowrap' }}>or with email</span>
                <span style={{ flex: 1, height: 1, background: '#1E1E2E' }} />
              </div>

              <label style={{ display: 'block', fontSize: 12.5, color: '#94A3B8', margin: '0 0 8px' }}>Email address</label>
              <input
                type="email"
                placeholder="you@university.edu"
                value={emailVal}
                onChange={e => { setEmailVal(e.target.value); setEmailError(false) }}
                onKeyDown={e => e.key === 'Enter' && onEmailContinue()}
                style={{ width: '100%', height: 46, borderRadius: 9, background: '#13121C', border: '1px solid #2D2B45', color: '#E2E8F0', padding: '0 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
              />
              {emailError && <p style={{ fontSize: 12, color: '#FB7185', margin: '8px 0 0' }}>Enter a valid email address.</p>}

              <button
                data-btn
                data-shine
                onClick={onEmailContinue}
                style={{ width: '100%', height: 46, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 9, fontSize: 15, fontWeight: 500, background: '#6366F1', color: '#09090F', border: 'none', cursor: 'pointer', boxShadow: '0 8px 26px rgba(99,102,241,0.32)' }}
              >
                Continue <span data-arrow style={{ color: '#09090F' }}>→</span>
              </button>

              <p style={{ fontSize: 13.5, color: '#5B6478', margin: '28px 0 0', textAlign: 'center' }}>
                Already have an account?{' '}
                <Link href="/login" data-link style={{ position: 'relative', color: '#A5B4FC', fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
              </p>
            </div>
          )}

          {/* Step 1 — Vault passphrase */}
          {step === 1 && (
            <div data-anim>
              <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#E2E8F0' }}>Create your vault passphrase</h2>
              <p style={{ fontSize: 14, color: '#94A3B8', margin: '0 0 26px' }}>This derives the key that encrypts everything — choose something memorable but strong.</p>

              {/* Passphrase input */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12.5, color: '#94A3B8', margin: '0 0 8px' }}>Passphrase</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    disabled={busy}
                    autoComplete="new-password"
                    style={{ width: '100%', height: 46, borderRadius: 9, background: '#13121C', border: '1px solid #2D2B45', color: '#E2E8F0', padding: '0 42px 0 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#5B6478', padding: 0 }}
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
                        <div key={level} style={{ flex: 1, height: 3, borderRadius: 9999, background: strength >= level ? STRENGTH_COLORS[strength] : '#1E1E2E', transition: 'background .2s' }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#5B6478' }}>{STRENGTH_LABELS[strength]}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: '#3F485C' }}>PBKDF2 · 310,000 iterations</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm input */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12.5, color: '#94A3B8', margin: '0 0 8px' }}>Confirm passphrase</label>
                <input
                  type="password"
                  placeholder="Repeat your passphrase"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onBlur={() => setTouchedConfirm(true)}
                  disabled={busy}
                  autoComplete="new-password"
                  style={{ width: '100%', height: 46, borderRadius: 9, background: '#13121C', border: `1px solid ${mismatch ? 'rgba(244,63,94,0.5)' : '#2D2B45'}`, color: '#E2E8F0', padding: '0 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                />
                {mismatch && <p style={{ fontSize: 12, color: '#FB7185', margin: '6px 0 0' }}>Passphrases don&apos;t match.</p>}
              </div>

              {/* No-backdoor warning */}
              <div style={{ borderRadius: 9, border: '1px solid rgba(244,63,94,0.25)', background: 'rgba(244,63,94,0.05)', padding: '12px 14px', marginBottom: 18 }}>
                <p style={{ fontSize: 12.5, lineHeight: 1.55, color: '#94A3B8', margin: 0 }}>
                  <span style={{ color: '#FB7185', fontWeight: 600 }}>No backdoor.</span> If you lose this passphrase and your Recovery Kit, your data is gone forever. There is no account recovery.
                </p>
              </div>

              {vaultError && <p style={{ fontSize: 12, color: '#FB7185', margin: '0 0 12px' }} role="alert">{vaultError}</p>}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setStep(0)}
                  disabled={busy}
                  style={{ height: 46, paddingLeft: 18, paddingRight: 18, borderRadius: 9, fontSize: 14, fontWeight: 500, background: 'transparent', border: '1px solid #2D2B45', color: '#94A3B8', cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  Back
                </button>
                <button
                  data-btn
                  data-shine
                  onClick={onCreateVault}
                  disabled={busy || pass.length < 8 || pass !== confirm}
                  style={{ flex: 1, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 9, fontSize: 15, fontWeight: 500, background: '#6366F1', color: '#09090F', border: 'none', cursor: (busy || pass.length < 8 || pass !== confirm) ? 'not-allowed' : 'pointer', boxShadow: '0 8px 26px rgba(99,102,241,0.32)', opacity: (busy || pass.length < 8 || pass !== confirm) ? 0.5 : 1 }}
                >
                  {busy ? (status === 'deriving' ? 'Deriving key…' : 'Saving…') : <>Create vault <span data-arrow style={{ color: '#09090F' }}>→</span></>}
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Recovery Kit */}
          {step === 2 && (
            <div data-anim>
              <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#E2E8F0' }}>Save your Recovery Kit</h2>
              <p style={{ fontSize: 14, color: '#94A3B8', margin: '0 0 22px' }}>If you lose your passphrase, this is your only way back in. Store it somewhere safe.</p>

              {/* Kit card */}
              <div style={{ borderRadius: 9, background: '#0D0D14', border: '1px solid #1E1E2E', padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#5B6478', marginBottom: 8 }}>Your Recovery Kit</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#94A3B8', wordBreak: 'break-all', lineHeight: 1.6, userSelect: 'all' }}>
                  {recoveryBlob ? formatRecoveryKit(recoveryBlob) : '—'}
                </div>
              </div>

              {/* Download button */}
              <button
                data-btn
                onClick={onDownload}
                style={{ width: '100%', height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 9, fontSize: 14, fontWeight: 500, background: '#13121C', border: '1px solid #2D2B45', color: downloaded ? '#A5B4FC' : '#E2E8F0', cursor: 'pointer', marginBottom: 16 }}
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
                  style={{ marginTop: 2, accentColor: '#6366F1', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13.5, color: '#94A3B8', lineHeight: 1.5 }}>I&apos;ve saved my Recovery Kit somewhere safe and understand I cannot recover my vault without it.</span>
              </label>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{ height: 46, paddingLeft: 18, paddingRight: 18, borderRadius: 9, fontSize: 14, fontWeight: 500, background: 'transparent', border: '1px solid #2D2B45', color: '#94A3B8', cursor: 'pointer' }}
                >
                  Back
                </button>
                <button
                  data-btn
                  data-shine
                  onClick={onEnterNocturne}
                  disabled={!downloaded || !saved}
                  style={{ flex: 1, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 9, fontSize: 15, fontWeight: 500, background: '#6366F1', color: '#09090F', border: 'none', cursor: (!downloaded || !saved) ? 'not-allowed' : 'pointer', boxShadow: '0 8px 26px rgba(99,102,241,0.32)', opacity: (!downloaded || !saved) ? 0.4 : 1 }}
                >
                  Enter Nocturne <span data-arrow style={{ color: '#09090F' }}>→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
