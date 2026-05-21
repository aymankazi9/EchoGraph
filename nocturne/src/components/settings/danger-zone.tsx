'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { DeleteAccountModal } from './delete-account-modal'

interface Props {
  userId: string
  pbkdf2Salt: string
  encryptedMasterKey: string
}

export function DangerZone({ userId, pbkdf2Salt, encryptedMasterKey }: Props) {
  const [step2Open, setStep2Open] = useState(false)

  return (
    <div>
      <p className="text-caption uppercase tracking-[0.07em] text-red-300 mb-4">Danger zone</p>

      <div className="flex items-start justify-between py-3 gap-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-body-sm text-text-primary">Delete account</span>
          <span className="text-caption text-text-tertiary">
            Permanently deletes your vault, all encrypted files, and your account. This cannot be
            undone.
          </span>
        </div>

        {/* Step 1 — AlertDialog confirmation */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="shrink-0 h-9 px-4 rounded-btn text-body border border-red-500 text-red-300 hover:bg-red-500/10 transition-colors"
            >
              Delete account
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-bg-overlay border border-border-default max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-subheading font-medium text-text-primary">
                Are you absolutely sure?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-body-sm text-text-secondary whitespace-pre-line">
                {`This will permanently delete:\n· All your encrypted files from storage\n· Your vault and all sessions\n· Your account and encryption keys\n\nThis cannot be undone. Your files cannot be recovered by anyone, including us.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-9 px-4 rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle bg-transparent">
                Keep my account
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => setStep2Open(true)}
                className="h-9 px-4 rounded-btn text-body border border-red-500 text-red-300 hover:bg-red-500/20 bg-transparent transition-colors"
              >
                Yes, delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Step 2 — passphrase confirmation */}
      <DeleteAccountModal
        open={step2Open}
        onClose={() => setStep2Open(false)}
        userId={userId}
        pbkdf2Salt={pbkdf2Salt}
        encryptedMasterKey={encryptedMasterKey}
      />
    </div>
  )
}
