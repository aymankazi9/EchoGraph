'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { PassphraseInput } from '@/components/ui/passphrase-input'
import { RecoveryModal } from '@/components/onboarding/recovery-modal'
import { vaultSetup } from '@/lib/crypto/vault'
import { createClient } from '@/lib/supabase'

interface Props {
  userId: string
}

type Status = 'idle' | 'deriving' | 'saving'

function generateSaltB64(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

export function SetupForm({ userId }: Props) {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [recoveryWrappedKeyB64, setRecoveryWrappedKeyB64] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()

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

    if (passphrase.length < 12) {
      setError('Passphrase must be at least 12 characters.')
      return
    }
    if (passphrase !== confirm) {
      setError('Passphrases do not match.')
      return
    }

    try {
      setStatus('deriving')
      startProgressAnimation()

      const salt = generateSaltB64()
      const recoverySalt = generateSaltB64()
      const { wrappedKeyB64, recoveryWrappedKeyB64: recoveryBlob } = await vaultSetup(
        passphrase,
        salt,
        recoverySalt,
      )

      finishProgressAnimation()
      setStatus('saving')

      const supabase = createClient()
      const { error: dbError } = await supabase
        .from('users')
        .update({
          pbkdf2_salt: salt,
          encrypted_master_key: wrappedKeyB64,
          recovery_salt: recoverySalt,
        })
        .eq('id', userId)

      if (dbError) throw new Error(dbError.message)

      // Show Recovery Kit modal — vault opens only after user confirms download.
      setStatus('idle')
      setRecoveryWrappedKeyB64(recoveryBlob)
    } catch (err) {
      finishProgressAnimation()
      setStatus('idle')
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  const busy = status !== 'idle'
  const statusLabel =
    status === 'deriving' ? 'Deriving keys…' : status === 'saving' ? 'Saving…' : null

  return (
    <>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <Shield size={32} strokeWidth={1.25} className="text-teal-300" />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-display font-medium text-text-primary">Set your vault passphrase</h1>
            <p className="text-body text-text-secondary">
              This passphrase encrypts your data and never leaves your device. If you lose it and
              your Recovery Kit, your data cannot be recovered — by anyone.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <PassphraseInput
            label="Passphrase"
            autoComplete="new-password"
            placeholder="At least 12 characters"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            disabled={busy}
            error={undefined}
          />
          <PassphraseInput
            label="Confirm passphrase"
            autoComplete="new-password"
            placeholder="Repeat your passphrase"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
            error={undefined}
          />

          {/* Progress bar — visible while PBKDF2 is running */}
          {busy && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <span className="text-label text-text-secondary">{statusLabel}</span>
                <span className="text-label text-text-tertiary">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full bg-bg-subtle rounded-pill overflow-hidden">
                <div
                  className="h-full bg-teal-300 rounded-pill transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-label text-red-200" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className={[
              'h-9 px-4 rounded-btn text-body font-medium transition-colors',
              busy
                ? 'bg-teal-400 text-text-inverse cursor-not-allowed opacity-60'
                : 'bg-teal-300 text-text-inverse hover:bg-teal-400',
            ].join(' ')}
          >
            {busy ? 'Working…' : 'Set passphrase'}
          </button>
        </form>
      </div>

      {/* Recovery Kit modal — rendered outside the form flow, gated by download + two checkboxes */}
      <AnimatePresence>
        {recoveryWrappedKeyB64 && (
          <RecoveryModal
            recoveryWrappedKeyB64={recoveryWrappedKeyB64}
            onConfirm={() => router.push('/vault')}
          />
        )}
      </AnimatePresence>
    </>
  )
}
