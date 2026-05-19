'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PassphraseInput } from '@/components/ui/passphrase-input'
import { createClient } from '@/lib/supabase'
import { vaultUnlock, vaultLogout } from '@/lib/crypto/vault'

interface Props {
  open: boolean
  onClose: () => void
  userId: string
  pbkdf2Salt: string
  encryptedMasterKey: string
}

export function DeleteAccountModal({
  open, onClose, userId, pbkdf2Salt, encryptedMasterKey,
}: Props) {
  const router = useRouter()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function handleClose() {
    if (busy) return
    setPassphrase('')
    setError(null)
    onClose()
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    try {
      // Step 1: verify passphrase by attempting to unlock with it
      await vaultUnlock(passphrase, pbkdf2Salt, encryptedMasterKey)

      const supabase = createClient()

      // Step 2: list and delete all storage files for this user
      const { data: fileList } = await supabase.storage
        .from('echograph-files')
        .list(userId, { limit: 1000 })

      if (fileList && fileList.length > 0) {
        const paths = fileList.map((f) => `${userId}/${f.name}`)
        await supabase.storage.from('echograph-files').remove(paths)
      }

      // Step 3: delete the users row (CASCADE removes sessions, files, keywords, etc.)
      await supabase.from('users').delete().eq('id', userId)

      // Step 4: call Edge Function to delete auth.users record
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId }),
      })

      // Step 5: clear MK + sign out
      await vaultLogout(supabase)

      // Step 6: redirect with deleted banner
      router.push('/?deleted=true')
    } catch (err) {
      setBusy(false)
      const msg = err instanceof Error ? err.message : String(err)
      const isWrongKey = msg.includes('operation') || msg.includes('OperationError') || msg.includes('DataError')
      setError(isWrongKey ? 'Incorrect passphrase.' : `Deletion failed: ${msg}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-[440px] bg-bg-elevated border border-border-default rounded-modal">
        <DialogHeader>
          <DialogTitle className="text-subheading font-medium text-text-primary">
            Enter your passphrase to confirm
          </DialogTitle>
        </DialogHeader>
        <p className="text-caption text-text-secondary -mt-2">
          We require your vault passphrase to confirm account deletion.
        </p>

        <form onSubmit={handleDelete} className="flex flex-col gap-4 mt-2">
          <PassphraseInput
            label="Vault passphrase"
            autoComplete="current-password"
            placeholder="Your vault passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            disabled={busy}
            error={error ?? undefined}
          />

          {busy && (
            <div className="h-1 w-full rounded-full bg-bg-subtle overflow-hidden">
              <div className="h-full w-full bg-red-200/40 animate-pulse rounded-full" />
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
              disabled={busy || !passphrase}
              className="h-9 px-4 rounded-btn text-body font-medium border border-red-500 text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-40"
            >
              {busy ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
