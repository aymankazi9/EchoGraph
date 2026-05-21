'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { vaultUnlockWithRecovery } from '@/lib/crypto/vault'
import { parseRecoveryKey } from '@/lib/crypto/recovery'

interface Props {
  recoverySalt: string
  onBack: () => void
}

export function RecoveryForm({ recoverySalt, onBack }: Props) {
  const [rawKey, setRawKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    let payload: string
    try {
      payload = parseRecoveryKey(rawKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid Recovery Kit format.')
      return
    }

    try {
      setBusy(true)
      await vaultUnlockWithRecovery(payload, recoverySalt)
      router.push('/dashboard')
    } catch (err) {
      setBusy(false)
      const msg = err instanceof Error ? err.message : ''
      const isWrongKey =
        msg.includes('OperationError') || msg.includes('DataError') || msg.includes('operation')
      setError(
        isWrongKey
          ? 'Recovery Kit did not match. Check that you pasted the correct key.'
          : 'Something went wrong. Please try again.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <KeyRound size={32} strokeWidth={1.25} className="text-indigo-400" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-display font-medium text-text-primary">Recover vault access</h1>
          <p className="text-body text-text-secondary">
            Paste the contents of your <span className="font-mono text-body">nocturne-recovery-kit.txt</span> file
            below.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-label text-text-secondary" htmlFor="recovery-key">
            Recovery Kit
          </label>
          <textarea
            id="recovery-key"
            value={rawKey}
            onChange={(e) => setRawKey(e.target.value)}
            disabled={busy}
            placeholder="EG-v1:…"
            rows={3}
            spellCheck={false}
            className={[
              'w-full rounded-input border bg-bg-input font-mono text-body-sm text-text-primary placeholder:text-text-tertiary p-2.5 resize-none',
              'focus:outline-none focus:border-indigo-500 focus:shadow-teal',
              error ? 'border-rose-400 shadow-red' : 'border-border-default',
              busy ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
          />
        </div>

        {error && (
          <p className="text-label text-rose-300" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !rawKey.trim()}
          className={[
            'h-9 px-4 rounded-btn text-body font-medium transition-colors',
            busy || !rawKey.trim()
              ? 'bg-indigo-600 text-text-inverse cursor-not-allowed opacity-60'
              : 'bg-indigo-500 text-text-inverse hover:bg-indigo-600',
          ].join(' ')}
        >
          {busy ? 'Unlocking…' : 'Unlock with Recovery Kit'}
        </button>

        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="text-label text-text-secondary hover:text-text-primary transition-colors text-center"
        >
          ← Back to passphrase
        </button>
      </form>
    </div>
  )
}
