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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A', padding: '48px 24px' }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Step indicator + header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <OnboardingProgress currentStep={3} totalSteps={3} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <KeyRound size={28} strokeWidth={1.25} style={{ color: '#9A9A9F' }} />
              <h1 style={{ fontFamily: 'var(--font-display)', fontStretch: '82%', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: '#EDEDED', margin: 0 }}>Save your backup key</h1>
            </div>
            <p style={{ fontSize: 14, color: '#9A9A9F', margin: 0, lineHeight: 1.6 }}>
              If you lose your vault passphrase, this is your only way back in. Store it somewhere
              safe — a password manager, encrypted drive, or printed copy.
            </p>
          </div>
        </div>

        {/* Key display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: '#76767B' }}>YOUR BACKUP KEY</span>
            <button
              type="button"
              onClick={handleCopy}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#9A9A9F', cursor: 'pointer', transition: 'color .2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#EDEDED' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9A9A9F' }}
            >
              {copied ? <Check size={13} strokeWidth={1.5} style={{ color: '#EDEDED' }} /> : <Copy size={13} strokeWidth={1.5} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div style={{ border: '1px dashed rgba(255,255,255,0.18)', background: '#0C0C0D', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#9A9A9F', wordBreak: 'break-all', lineHeight: 1.6, userSelect: 'all' }}>
            {kitContent}
          </div>
        </div>

        {/* Download */}
        <button
          type="button"
          onClick={handleDownload}
          style={{ width: '100%', height: 36, padding: '0 16px', fontSize: 14, fontWeight: 500, background: 'transparent', border: '1px solid rgba(255,255,255,0.16)', color: '#EDEDED', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Download size={14} strokeWidth={1.5} />
          {hasStored ? 'Download again' : 'Download backup key'}
        </button>

        {/* Confirmation checkbox */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={hasStored}
            onChange={(e) => setHasStored(e.target.checked)}
            style={{ marginTop: 2, accentColor: '#FF3B30', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13.5, color: '#9A9A9F' }}>
            I&apos;ve stored my backup key somewhere safe.
          </span>
        </label>

        {/* Open vault */}
        <button
          type="button"
          onClick={handleOpenVault}
          disabled={!hasStored || opening}
          style={{
            height: 36,
            padding: '0 16px',
            fontSize: 14,
            fontWeight: 500,
            background: '#FF3B30',
            color: '#0A0A0A',
            border: 'none',
            cursor: hasStored && !opening ? 'pointer' : 'not-allowed',
            opacity: hasStored && !opening ? 1 : 0.4,
          }}
        >
          {opening ? 'Opening vault…' : 'Open vault'}
        </button>
      </div>
    </div>
  )
}
