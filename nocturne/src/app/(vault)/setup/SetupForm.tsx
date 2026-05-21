'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { PassphraseInput } from '@/components/ui/passphrase-input'
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress'
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

function computeStrength(pw: string): number {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[\d!@#$%^&*()\-_=+[\]{};':",.<>/?`~\\|]/.test(pw)) score++
  if (pw.length >= 16) score++
  return score
}

const STRENGTH_LABEL: Record<number, string> = {
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
}

const STRENGTH_COLOR: Record<number, string> = {
  1: 'bg-rose-400',
  2: 'bg-amber-300',
  3: 'bg-indigo-400',
  4: 'bg-indigo-500',
}

export function SetupForm({ userId }: Props) {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()

  const strength = passphrase.length > 0 ? computeStrength(passphrase) : 0
  const confirmMatches = confirm.length > 0 && confirm === passphrase

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

    if (strength < 2) {
      setError('Choose a stronger passphrase — try adding length or a number.')
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
      const { wrappedKeyB64 } = await vaultSetup(passphrase, salt, recoverySalt)

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

      router.push('/setup/backup')
    } catch (err) {
      finishProgressAnimation()
      setStatus('idle')
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  const busy = status !== 'idle'
  const canSubmit = !busy && strength >= 2 && passphrase === confirm && confirm.length > 0

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <OnboardingProgress currentStep={2} totalSteps={3} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-display font-medium text-text-primary">Create your vault key</h1>
          <p className="text-body text-text-secondary">
            This passphrase encrypts your data locally. It never leaves your device.
          </p>
          <p className="text-label text-text-tertiary">Encrypted locally · never transmitted</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Passphrase + strength bar */}
        <div className="flex flex-col gap-2">
          <PassphraseInput
            label="Passphrase"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            disabled={busy}
          />
          {passphrase.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex gap-0.5">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={[
                      'h-1 flex-1 rounded-pill transition-colors duration-200',
                      strength >= level ? STRENGTH_COLOR[Math.min(strength, 4)] : 'bg-bg-subtle',
                    ].join(' ')}
                  />
                ))}
              </div>
              <span className="text-label text-text-tertiary w-12 text-right">
                {STRENGTH_LABEL[strength] ?? ''}
              </span>
            </div>
          )}
        </div>

        {/* Confirm passphrase */}
        <div className="relative">
          <PassphraseInput
            label="Confirm passphrase"
            autoComplete="new-password"
            placeholder="Repeat your passphrase"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
          />
          {confirmMatches && (
            <div className="absolute right-9 top-[26px] flex items-center h-9 pr-0.5">
              <Check size={14} strokeWidth={2} className="text-indigo-400" />
            </div>
          )}
        </div>

        {/* PBKDF2 progress */}
        {busy && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-label text-text-secondary">
                {status === 'deriving' ? 'Deriving keys…' : 'Saving…'}
              </span>
              <span className="text-label text-text-tertiary">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-bg-subtle rounded-pill overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-pill transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-label text-rose-300" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className={[
            'h-9 px-4 rounded-btn text-body font-medium transition-colors',
            canSubmit
              ? 'bg-indigo-500 text-white hover:bg-indigo-600'
              : 'bg-indigo-500 text-white cursor-not-allowed opacity-40',
          ].join(' ')}
        >
          {busy ? 'Working…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
