'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PassphraseInput } from '@/components/ui/passphrase-input'
import { ChangePassphraseModal } from './change-passphrase-modal'
import { vaultRederiveRecovery } from '@/lib/crypto/vault'
import { downloadRecoveryKit } from '@/lib/crypto/recovery'
import { useNotificationStore } from '@/store/notification-store'

interface Props {
  userId: string
  pbkdf2Salt: string
  encryptedMasterKey: string
  recoverySalt: string | null
}

function Row({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-border-subtle last:border-0 gap-6">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-body-sm text-text-secondary">{label}</span>
        {description && <span className="text-caption text-text-tertiary">{description}</span>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SecuritySection({ userId, pbkdf2Salt, encryptedMasterKey, recoverySalt }: Props) {
  const notify = useNotificationStore((s) => s.notify)
  const [passphraseModalOpen, setPassphraseModalOpen] = useState(false)
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false)
  const [passphraseSaved, setPassphraseSaved] = useState(false)

  // Recovery re-download state
  const [recoveryPassphrase, setRecoveryPassphrase] = useState('')
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [recoveryBusy, setRecoveryBusy] = useState(false)

  async function handleRecoveryDownload(e: React.FormEvent) {
    e.preventDefault()
    if (!recoverySalt) return
    setRecoveryError(null)
    setRecoveryBusy(true)
    try {
      const recoveryWrappedKeyB64 = await vaultRederiveRecovery(
        recoveryPassphrase, pbkdf2Salt, encryptedMasterKey, recoverySalt,
      )
      downloadRecoveryKit(recoveryWrappedKeyB64)
      notify({ type: 'info', message: 'Recovery Key saved', duration: 2000 })
      setRecoveryModalOpen(false)
      setRecoveryPassphrase('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isWrongKey = msg.includes('operation') || msg.includes('OperationError') || msg.includes('DataError')
      setRecoveryError(isWrongKey ? 'Incorrect passphrase.' : 'Something went wrong. Try again.')
    } finally {
      setRecoveryBusy(false)
    }
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary">Security</p>
          <AnimatePresence>
            {passphraseSaved && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-caption text-teal-300"
              >
                Passphrase updated
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <Row
          label="Vault passphrase"
          description="Your passphrase encrypts your Master Key. EchoGraph cannot reset it."
        >
          <button
            type="button"
            onClick={() => setPassphraseModalOpen(true)}
            className="text-body-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Change passphrase
          </button>
        </Row>

        <Row
          label="Recovery Key"
          description="Download a backup key in case you forget your passphrase."
        >
          <button
            type="button"
            onClick={() => { setRecoveryError(null); setRecoveryPassphrase(''); setRecoveryModalOpen(true) }}
            disabled={!recoverySalt}
            className="text-body-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
          >
            Download again
          </button>
        </Row>

        <Row label="Active devices" description="Session management is available post-beta.">
          <span className="text-caption text-text-tertiary">1 device</span>
        </Row>
      </div>

      {/* Passphrase change modal */}
      <ChangePassphraseModal
        open={passphraseModalOpen}
        onClose={() => setPassphraseModalOpen(false)}
        userId={userId}
        pbkdf2Salt={pbkdf2Salt}
        encryptedMasterKey={encryptedMasterKey}
        onChanged={() => {
          setPassphraseSaved(true)
          setTimeout(() => setPassphraseSaved(false), 3000)
        }}
      />

      {/* Recovery re-download modal */}
      <Dialog open={recoveryModalOpen} onOpenChange={(o) => !o && !recoveryBusy && setRecoveryModalOpen(false)}>
        <DialogContent className="max-w-[440px] bg-bg-elevated border border-border-default rounded-modal">
          <DialogHeader>
            <DialogTitle className="text-subheading font-medium text-text-primary">
              Re-download Recovery Kit
            </DialogTitle>
          </DialogHeader>
          <p className="text-caption text-text-secondary -mt-2">
            Enter your vault passphrase to re-derive your Recovery Kit. The same key will be
            produced every time.
          </p>
          <form onSubmit={handleRecoveryDownload} className="flex flex-col gap-4 mt-2">
            <PassphraseInput
              label="Vault passphrase"
              autoComplete="current-password"
              placeholder="Your vault passphrase"
              value={recoveryPassphrase}
              onChange={(e) => setRecoveryPassphrase(e.target.value)}
              disabled={recoveryBusy}
              error={recoveryError ?? undefined}
            />
            {recoveryBusy && (
              <div className="h-1 w-full rounded-full bg-bg-subtle overflow-hidden">
                <div className="h-full w-full bg-amber-200/50 animate-pulse rounded-full" />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRecoveryModalOpen(false)}
                disabled={recoveryBusy}
                className="h-9 px-4 rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recoveryBusy || !recoveryPassphrase}
                className="h-9 px-4 rounded-btn text-body font-medium bg-teal-300 text-text-inverse hover:bg-teal-400 transition-colors disabled:opacity-60"
              >
                {recoveryBusy ? 'Deriving…' : 'Download'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
