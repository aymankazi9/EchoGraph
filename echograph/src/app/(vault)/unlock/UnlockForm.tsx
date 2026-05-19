'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { PassphraseInput } from '@/components/ui/passphrase-input'
import { RecoveryForm } from './RecoveryForm'
import { vaultUnlock } from '@/lib/crypto/vault'

interface Props {
  salt: string
  wrappedKey: string
  recoverySalt: string | null
  next: string | null
}

type Status = 'idle' | 'deriving'

export function UnlockForm({ salt, wrappedKey, recoverySalt, next }: Props) {
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [showRecovery, setShowRecovery] = useState(false)
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

    if (!passphrase) {
      setError('Enter your vault passphrase.')
      return
    }

    try {
      setStatus('deriving')
      startProgressAnimation()

      await vaultUnlock(passphrase, salt, wrappedKey)

      finishProgressAnimation()
      const safeNext =
        next && (next.startsWith('/vault') || next.startsWith('/session')) ? next : '/vault'
      router.push(safeNext)
    } catch (err) {
      finishProgressAnimation()
      setStatus('idle')

      // AES-KW decryption failure = wrong passphrase
      const msg = err instanceof Error ? err.message : ''
      const isWrongKey =
        msg.includes('operation') ||
        msg.includes('OperationError') ||
        msg.includes('DataError')

      setError(isWrongKey ? 'Incorrect passphrase.' : 'Something went wrong. Please try again.')
    }
  }

  const busy = status === 'deriving'

  if (showRecovery && recoverySalt) {
    return <RecoveryForm recoverySalt={recoverySalt} onBack={() => setShowRecovery(false)} />
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Lock size={32} strokeWidth={1.25} className="text-teal-300" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-display font-medium text-text-primary">Unlock your vault</h1>
          <p className="text-body text-text-secondary">
            Enter your vault passphrase to decrypt your study sessions. This passphrase never
            leaves your device.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <PassphraseInput
          label="Vault passphrase"
          autoComplete="current-password"
          placeholder="Your vault passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          disabled={busy}
          error={error ?? undefined}
        />

        {/* Progress bar */}
        {busy && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-label text-text-secondary">Deriving keys…</span>
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
          {busy ? 'Unlocking…' : 'Unlock vault'}
        </button>

        {recoverySalt && (
          <button
            type="button"
            onClick={() => setShowRecovery(true)}
            disabled={busy}
            className="text-label text-text-secondary hover:text-text-primary transition-colors text-center"
          >
            Use Recovery Key instead
          </button>
        )}
      </form>
    </div>
  )
}
