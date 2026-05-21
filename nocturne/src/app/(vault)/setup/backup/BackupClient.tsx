'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, Download, KeyRound } from 'lucide-react'
import { getPendingRecoveryBlob, clearPendingRecoveryBlob } from '@/lib/crypto/vault'
import { formatRecoveryKit, downloadRecoveryKit } from '@/lib/crypto/recovery'
import { OnboardingProgress } from '@/components/onboarding/onboarding-progress'

interface Props {
  userId: string
}

export function BackupClient({ userId: _userId }: Props) {
  const router = useRouter()
  const [blob, setBlob] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [hasStored, setHasStored] = useState(false)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    const pending = getPendingRecoveryBlob()
    if (!pending) {
      router.replace('/setup')
      return
    }
    setBlob(pending)
  }, [router])

  function handleDownload() {
    if (!blob) return
    downloadRecoveryKit(blob)
    setHasStored(true)
  }

  async function handleCopy() {
    if (!blob) return
    await navigator.clipboard.writeText(formatRecoveryKit(blob))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleOpenVault() {
    if (!hasStored || opening) return
    setOpening(true)
    document.cookie = 'nocturne-vault-warm=1; max-age=3600; path=/; SameSite=Strict'
    clearPendingRecoveryBlob()
    router.push('/vault')
  }

  if (!blob) return null

  const kitContent = formatRecoveryKit(blob)

  return (
    <div className="flex flex-col gap-8">
      {/* Step indicator + header */}
      <div className="flex flex-col gap-3">
        <OnboardingProgress currentStep={3} totalSteps={3} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <KeyRound size={28} strokeWidth={1.25} className="text-indigo-400" />
            <h1 className="text-display font-medium text-text-primary">Save your backup key</h1>
          </div>
          <p className="text-body text-text-secondary">
            If you lose your vault passphrase, this is your only way back in. Store it somewhere
            safe — a password manager, encrypted drive, or printed copy.
          </p>
        </div>
      </div>

      {/* Key display */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-caption uppercase tracking-[0.07em] text-text-secondary">
            Your backup key
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-label text-text-secondary hover:text-text-primary transition-colors"
          >
            {copied ? (
              <Check size={13} strokeWidth={1.5} className="text-indigo-400" />
            ) : (
              <Copy size={13} strokeWidth={1.5} />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="rounded-card border border-dashed border-border-default bg-bg-subtle p-3 font-mono text-mono-sm text-text-secondary break-all select-all leading-relaxed">
          {kitContent}
        </div>
      </div>

      {/* Download */}
      <button
        type="button"
        onClick={handleDownload}
        className="w-full h-9 px-4 rounded-btn text-body font-medium bg-bg-subtle border border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors flex items-center justify-center gap-2"
      >
        <Download size={14} strokeWidth={1.5} />
        {hasStored ? 'Download again' : 'Download backup key'}
      </button>

      {/* Confirmation checkbox */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={hasStored}
          onChange={(e) => setHasStored(e.target.checked)}
          className="mt-0.5 accent-indigo-500 w-4 h-4 shrink-0 cursor-pointer"
        />
        <span className="text-body-sm text-text-secondary">
          I've stored my backup key somewhere safe.
        </span>
      </label>

      {/* Open vault */}
      <button
        type="button"
        onClick={handleOpenVault}
        disabled={!hasStored || opening}
        className={[
          'h-9 px-4 rounded-btn text-body font-medium transition-colors',
          hasStored && !opening
            ? 'bg-indigo-500 text-white hover:bg-indigo-600 cursor-pointer'
            : 'bg-indigo-500 text-white cursor-not-allowed opacity-30',
        ].join(' ')}
      >
        {opening ? 'Opening vault…' : 'Open vault'}
      </button>
    </div>
  )
}
