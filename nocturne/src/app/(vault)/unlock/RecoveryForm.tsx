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
      router.push('/vault')
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Header */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <KeyRound size={28} strokeWidth={1.25} style={{ color: '#818CF8' }} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 6px', color: '#E2E8F0' }}>
          Recover vault access
        </h2>
        <p style={{ fontSize: 14, color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>
          Paste the contents of your{' '}
          <span style={{ fontFamily: 'monospace', fontSize: 13 }}>nocturne-recovery-kit.txt</span>{' '}
          file below.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="recovery-key" style={{ fontSize: 12.5, color: '#94A3B8', letterSpacing: '0.02em' }}>
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
            style={{
              width: '100%',
              borderRadius: 9,
              background: '#13121C',
              border: `1px solid ${error ? '#FB7185' : '#2D2B45'}`,
              color: '#E2E8F0',
              padding: '10px 14px',
              fontSize: 13,
              fontFamily: 'monospace',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              opacity: busy ? 0.6 : 1,
              cursor: busy ? 'not-allowed' : 'auto',
            }}
          />
        </div>

        {error && (
          <p style={{ fontSize: 12.5, color: '#FB7185', margin: 0 }} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !rawKey.trim()}
          data-btn
          data-shine
          style={{ width: '100%', height: 46, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, fontSize: 15, fontWeight: 500, background: '#6366F1', color: '#09090F', border: 'none', cursor: busy || !rawKey.trim() ? 'not-allowed' : 'pointer', boxShadow: '0 8px 26px rgba(99,102,241,0.32)', opacity: busy || !rawKey.trim() ? 0.6 : 1 }}
        >
          {busy ? 'Unlocking…' : 'Unlock with Recovery Kit'}
        </button>

        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 13.5, color: '#5B6478', cursor: busy ? 'not-allowed' : 'pointer', textAlign: 'center', marginTop: 4 }}
        >
          ← Back to passphrase
        </button>
      </form>
    </div>
  )
}
