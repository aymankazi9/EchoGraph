'use client'

import { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PassphraseInput } from '@/components/ui/passphrase-input'
import { createClient } from '@/lib/supabase'
import { vaultChangePassphrase } from '@/lib/crypto/vault'

interface Props {
  open: boolean
  onClose: () => void
  userId: string
  pbkdf2Salt: string
  encryptedMasterKey: string
  onChanged: () => void
}

type Phase = 'idle' | 'verifying' | 'updating'

function generateSaltB64(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

export function ChangePassphraseModal({
  open, onClose, userId, pbkdf2Salt, encryptedMasterKey, onChanged,
}: Props) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [currentError, setCurrentError] = useState<string | null>(null)
  const [nextError, setNextError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const busy = phase !== 'idle'

  function reset() {
    setCurrent(''); setNext(''); setConfirm('')
    setCurrentError(null); setNextError(null); setConfirmError(null)
    setPhase('idle')
  }

  function handleClose() {
    if (busy) return
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCurrentError(null); setNextError(null); setConfirmError(null)

    let valid = true
    if (next.length < 12) { setNextError('Passphrase must be at least 12 characters'); valid = false }
    if (next !== confirm) { setConfirmError('Passphrases do not match'); valid = false }
    if (!valid) return

    try {
      setPhase('verifying')
      const newSalt = generateSaltB64()
      const { newWrappedKeyB64 } = await vaultChangePassphrase(
        current, pbkdf2Salt, encryptedMasterKey, next, newSalt,
      )

      setPhase('updating')
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ pbkdf2_salt: newSalt, encrypted_master_key: newWrappedKeyB64, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) throw error

      reset()
      onClose()
      onChanged()
    } catch (err) {
      setPhase('idle')
      const msg = err instanceof Error ? err.message : String(err)
      const isWrongKey = msg.includes('operation') || msg.includes('OperationError') || msg.includes('DataError')
      setCurrentError(isWrongKey ? 'Incorrect passphrase.' : `Something went wrong: ${msg}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-[440px] bg-bg-elevated border border-border-default rounded-modal">
        <DialogHeader>
          <DialogTitle className="text-subheading font-medium text-text-primary">
            Change vault passphrase
          </DialogTitle>
        </DialogHeader>
        <p className="text-caption text-text-secondary -mt-2">
          Your files will not be re-encrypted. Only the wrapper around your Master Key changes.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <PassphraseInput
            label="Current passphrase"
            autoComplete="current-password"
            placeholder="Your current vault passphrase"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={busy}
            error={currentError ?? undefined}
          />
          <PassphraseInput
            label="New passphrase"
            autoComplete="new-password"
            placeholder="At least 12 characters"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            disabled={busy}
            error={nextError ?? undefined}
          />
          <PassphraseInput
            label="Confirm new passphrase"
            autoComplete="new-password"
            placeholder="Repeat new passphrase"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
            error={confirmError ?? undefined}
          />

          {busy && (
            <div className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">
                {phase === 'verifying' ? 'Verifying & generating new keys…' : 'Saving…'}
              </span>
              <div className="h-1 w-full rounded-full bg-bg-subtle overflow-hidden">
                <div className="h-full w-full bg-amber-200/50 animate-pulse rounded-full" />
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className="h-9 px-4 rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-9 px-4 rounded-btn text-body font-medium bg-teal-300 text-text-inverse hover:bg-teal-400 transition-colors disabled:opacity-60"
            >
              {busy ? 'Working…' : 'Change passphrase'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
