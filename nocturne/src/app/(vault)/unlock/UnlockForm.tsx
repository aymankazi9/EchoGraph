'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, Unlock } from 'lucide-react'
import { PassphraseInput } from '@/components/ui/passphrase-input'
import { RecoveryForm } from './RecoveryForm'
import { vaultUnlock } from '@/lib/crypto/vault'
import { useMotion } from '@/lib/motion'
import { AuthBrandCanvas } from '@/components/auth/auth-brand-canvas'

interface Props {
  salt: string
  wrappedKey: string
  recoverySalt: string | null
  next: string | null
}

type Status = 'idle' | 'deriving' | 'unlocked'

export function UnlockForm({ salt, wrappedKey, recoverySalt, next }: Props) {
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [showRecovery, setShowRecovery] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const heroRef = useRef<HTMLElement>(null)
  const router = useRouter()
  const { reduced } = useMotion()

  function startProgressAnimation() {
    setProgress(0)
    let p = 0
    timerRef.current = setInterval(() => {
      p = Math.min(p + 2.5, 88)
      setProgress(p)
    }, 100)
  }

  function finishProgressAnimation() {
    if (timerRef.current) clearInterval(timerRef.current)
    setProgress(100)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!passphrase) {
      setError('Enter your vault passphrase.')
      return
    }

    try {
      setStatus('deriving')
      startProgressAnimation()

      await vaultUnlock(passphrase, salt, wrappedKey)

      finishProgressAnimation()
      setStatus('unlocked')
      const safeNext =
        next && (next.startsWith('/vault') || next.startsWith('/session')) ? next : '/vault'
      router.push(safeNext)
    } catch (err) {
      finishProgressAnimation()
      setStatus('idle')

      const msg = err instanceof Error ? err.message : ''
      const isWrongKey =
        msg.includes('operation') ||
        msg.includes('OperationError') ||
        msg.includes('DataError')

      setError(isWrongKey ? 'Incorrect passphrase.' : 'Something went wrong. Please try again.')
    }
  }

  const busy = status === 'deriving'
  const isUnlocked = status === 'unlocked'

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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '5px 13px 5px 11px', borderRadius: 9999, border: '1px solid #2D2B45', background: 'rgba(17,17,24,0.55)', backdropFilter: 'blur(8px)', marginBottom: 26 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#818CF8', flexShrink: 0 }} />
            <span style={{ fontSize: 12, letterSpacing: '0.04em', color: '#94A3B8' }}>AES-256 · Client-side only</span>
          </div>
          <h1 style={{ fontSize: 'clamp(32px,3.6vw,46px)', lineHeight: 1.08, letterSpacing: '-0.025em', fontWeight: 600, margin: 0, color: '#E2E8F0' }}>
            One phrase.<br />
            <span style={{ background: 'linear-gradient(100deg,#A5B4FC 0%,#A78BFA 45%,#FB7185 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Everything remembered.</span>
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: '#94A3B8', margin: '22px 0 0', maxWidth: 430 }}>
            Your passphrase derives the key that decrypts your vault locally. Nocturne never sees it — not during setup, not now, not ever.
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
            Decrypted in your browser
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: '#3F485C' }}>No network call during unlock</span>
        </div>
      </section>

      {/* FORM PANEL */}
      <section
        data-form
        style={{ position: 'relative', width: 520, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', background: '#09090F' }}
      >
        <div data-formbg style={{ display: 'none', position: 'absolute', inset: 0, background: 'radial-gradient(620px circle at 50% 0%, rgba(99,102,241,0.08), transparent 60%)', pointerEvents: 'none' }} />

        <div data-anim style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 360 }}>
          {/* Mobile logo */}
          <a href="/" style={{ display: 'none', alignItems: 'center', gap: 10, marginBottom: 32, textDecoration: 'none' }} className="auth-mobile-logo">
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(145deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#09090F', fontWeight: 700, fontSize: 15 }}>N</span>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0' }}>Nocturne</span>
          </a>

          {showRecovery && recoverySalt ? (
            <RecoveryForm recoverySalt={recoverySalt} onBack={() => setShowRecovery(false)} />
          ) : (
            <>
              {/* Lock / Unlock icon */}
              <div style={{ marginBottom: 20 }}>
                <motion.div
                  animate={isUnlocked ? {
                    rotate: reduced ? 0 : [0, -15, 10, 0],
                    scale: reduced ? 1 : [1, 0.9, 1.1, 1],
                    transition: { duration: 0.4, ease: 'easeOut' },
                  } : {}}
                >
                  {isUnlocked
                    ? <Unlock size={28} strokeWidth={1.25} style={{ color: '#818CF8' }} />
                    : <Lock size={28} strokeWidth={1.25} style={{ color: '#818CF8' }} />
                  }
                </motion.div>
              </div>

              <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#E2E8F0' }}>
                {isUnlocked ? 'Vault unlocked' : 'Unlock your vault'}
              </h2>
              <p style={{ fontSize: 14, color: '#94A3B8', margin: '0 0 30px', lineHeight: 1.6 }}>
                Enter your passphrase to decrypt your study sessions. This key never leaves your device.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <PassphraseInput
                  label="Vault passphrase"
                  autoComplete="current-password"
                  placeholder="Your vault passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  disabled={busy}
                  error={error ?? undefined}
                />

                {/* Key derivation progress */}
                {busy && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>Deriving keys…</span>
                      <span style={{ fontSize: 12, color: '#5B6478', fontFamily: 'monospace' }}>{Math.round(progress)}%</span>
                    </div>
                    <div style={{ height: 3, width: '100%', background: '#1E1E2E', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#6366F1', borderRadius: 9999, width: `${progress}%`, transition: 'width 150ms linear' }} />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  data-btn
                  data-shine
                  style={{ width: '100%', height: 46, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, fontSize: 15, fontWeight: 500, background: '#6366F1', color: '#09090F', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', boxShadow: '0 8px 26px rgba(99,102,241,0.32)', opacity: busy ? 0.7 : 1 }}
                >
                  {busy ? 'Unlocking…' : 'Unlock vault'}
                </button>

                {recoverySalt && (
                  <button
                    type="button"
                    onClick={() => setShowRecovery(true)}
                    disabled={busy}
                    data-link
                    style={{ position: 'relative', background: 'none', border: 'none', padding: 0, fontSize: 13.5, color: '#5B6478', cursor: busy ? 'not-allowed' : 'pointer', textAlign: 'center', marginTop: 4 }}
                  >
                    Forgot your passphrase? Use recovery kit
                  </button>
                )}
              </form>

              {/* Trust footer */}
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
            </>
          )}
        </div>
      </section>
    </div>
  )
}
