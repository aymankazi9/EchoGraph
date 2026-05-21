'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Download, Copy, Check } from 'lucide-react'
import { formatRecoveryKit, downloadRecoveryKit } from '@/lib/crypto/recovery'

interface Props {
  recoveryWrappedKeyB64: string
  onConfirm: () => void
}

const modalEntry = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.15, ease: [0.4, 0.0, 1.0, 1.0] as [number, number, number, number] },
  },
}

export function RecoveryModal({ recoveryWrappedKeyB64, onConfirm }: Props) {
  const [hasDownloaded, setHasDownloaded] = useState(false)
  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)
  const [copied, setCopied] = useState(false)

  const kitContent = formatRecoveryKit(recoveryWrappedKeyB64)
  const canOpen = hasDownloaded && check1 && check2

  function handleDownload() {
    downloadRecoveryKit(recoveryWrappedKeyB64)
    setHasDownloaded(true)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(kitContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />

      <AnimatePresence>
        <motion.div
          key="recovery-modal"
          variants={modalEntry}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative w-full max-w-[480px] bg-bg-elevated border border-border-default rounded-modal shadow-lg flex flex-col gap-6 p-6"
        >
          {/* Header */}
          <div className="flex flex-col gap-4">
            <AlertTriangle size={32} strokeWidth={1.25} className="text-rose-300" />
            <div className="flex flex-col gap-1.5">
              <h2 className="text-subheading font-medium text-text-primary">
                We cannot recover your account
              </h2>
              <p className="text-body text-text-secondary">
                Nocturne uses zero-knowledge encryption. Your vault passphrase never leaves your
                device — and neither does this Recovery Kit. If you lose both, your data is
                permanently inaccessible. There is no account recovery, no support ticket, no
                exception.
              </p>
            </div>
          </div>

          {/* Recovery key display */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-caption uppercase tracking-[0.07em] text-text-secondary">
                Your Recovery Kit
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-label text-text-secondary hover:text-text-primary transition-colors"
              >
                {copied ? (
                  <Check size={14} strokeWidth={1.5} />
                ) : (
                  <Copy size={14} strokeWidth={1.5} />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="rounded-card border border-dashed border-border-default bg-bg-subtle p-3 font-mono text-mono-sm text-text-secondary break-all select-all leading-relaxed">
              {kitContent}
            </div>
          </div>

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            className="w-full h-9 px-4 rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={16} strokeWidth={1.5} />
            {hasDownloaded ? 'Download again' : 'Download Recovery Kit'}
          </button>

          {/* Checkboxes */}
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={check1}
                onChange={(e) => setCheck1(e.target.checked)}
                className="mt-0.5 accent-indigo-500 w-4 h-4 shrink-0 cursor-pointer"
              />
              <span className="text-body-sm text-text-secondary">
                I understand that losing my vault passphrase and Recovery Kit means my data cannot
                be recovered by anyone, including Nocturne.
              </span>
            </label>

            <label
              className={[
                'flex items-start gap-3',
                hasDownloaded ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={check2}
                onChange={(e) => setCheck2(e.target.checked)}
                disabled={!hasDownloaded}
                className="mt-0.5 accent-indigo-500 w-4 h-4 shrink-0"
              />
              <span className="text-body-sm text-text-secondary">
                I have downloaded my Recovery Kit and stored it somewhere safe.
              </span>
            </label>
          </div>

          {/* Open vault */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canOpen}
            className={[
              'h-9 px-4 rounded-btn text-body font-medium transition-colors',
              canOpen
                ? 'bg-indigo-500 text-text-inverse hover:bg-indigo-600 cursor-pointer'
                : 'bg-indigo-500 text-text-inverse cursor-not-allowed opacity-30',
            ].join(' ')}
          >
            Open vault
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
