import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Lock, Key, FileText, Check, X, ChevronRight, Mail } from 'lucide-react'
import { PageFade } from '@/components/marketing/page-fade'

export const metadata: Metadata = {
  title: 'Security — Nocturne',
  description: 'How Nocturne protects your data with zero-knowledge encryption. Your files are unreadable to us by design.',
}

const keySteps = [
  {
    icon: Key,
    label: 'Your passphrase',
    sub: 'Never stored, never transmitted',
    color: 'text-amber-200',
    bg: 'bg-amber-400/10 border-amber-400/20',
  },
  {
    icon: Shield,
    label: 'PBKDF2 derivation',
    sub: '310,000 iterations · SHA-256',
    color: 'text-indigo-300',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
  },
  {
    icon: Lock,
    label: 'Master Key',
    sub: 'AES-GCM 256 · memory-only',
    color: 'text-violet-300',
    bg: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    icon: FileText,
    label: 'Encrypted blobs',
    sub: 'Stored in Supabase Storage',
    color: 'text-text-secondary',
    bg: 'bg-bg-elevated border-border-default',
  },
]

const weCan = [
  'Store your encrypted file blobs',
  'Record file metadata (size, upload date)',
  'Verify your identity via Google OAuth',
  'Deliver your encrypted Master Key blob',
]

const weCannot = [
  'Read your lecture audio or slides',
  'Read your transcripts or keywords',
  'Reset your vault passphrase',
  'Recover your data if you lose your passphrase',
  'Decrypt anything stored on our servers',
]

export default function SecurityPage() {
  return (
    <PageFade>
    <div className="px-6 py-16 md:py-24">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-14">
          <p className="text-caption uppercase tracking-[0.07em] text-indigo-400 mb-3">
            Security
          </p>
          <h1 className="text-heading font-medium text-text-primary mb-3">
            Zero-knowledge by design
          </h1>
          <p className="text-body text-text-secondary max-w-xl">
            Nocturne servers store your data but cannot read it. Encryption happens in your browser,
            before anything leaves your device. Your vault passphrase never touches our servers — ever.
          </p>
        </div>

        {/* Key hierarchy */}
        <section className="mb-14">
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-6">
            3-Tier Key Hierarchy
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {keySteps.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.label} className="flex sm:flex-col items-center gap-3 sm:gap-2 flex-1">
                  <div className={`p-3 rounded-card border ${step.bg} shrink-0`}>
                    <Icon size={18} strokeWidth={1.5} className={step.color} />
                  </div>
                  <div className="sm:text-center">
                    <p className="text-body-sm font-medium text-text-primary">{step.label}</p>
                    <p className="text-caption text-text-tertiary">{step.sub}</p>
                  </div>
                  {i < keySteps.length - 1 && (
                    <ChevronRight
                      size={14}
                      strokeWidth={1.5}
                      className="text-text-tertiary shrink-0 sm:hidden"
                    />
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-body-sm text-text-tertiary mt-6">
            Your passphrase derives a Key-Encryption-Key (KEK) via PBKDF2 in your browser.
            The KEK unwraps your Master Key (AES-KW). The KEK is immediately discarded.
            The Master Key encrypts every file using AES-GCM 256 with a unique 96-bit IV per chunk.
            The Master Key is non-extractable and lives only in browser memory for your session.
          </p>
        </section>

        {/* Can / Cannot */}
        <section className="mb-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-card border border-border-default bg-bg-elevated">
              <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-4">
                Nocturne can
              </p>
              <ul className="flex flex-col gap-3">
                {weCan.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check size={14} strokeWidth={2} className="text-indigo-400 mt-0.5 shrink-0" />
                    <span className="text-body-sm text-text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-5 rounded-card border border-border-default bg-bg-elevated">
              <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-4">
                Nocturne cannot
              </p>
              <ul className="flex flex-col gap-3">
                {weCannot.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <X size={14} strokeWidth={2} className="text-red-300 mt-0.5 shrink-0" />
                    <span className="text-body-sm text-text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Additional details */}
        <section className="mb-14 flex flex-col gap-6">
          <div className="p-5 rounded-card border border-border-default bg-bg-elevated">
            <h2 className="text-subheading font-medium text-text-primary mb-2">No password reset</h2>
            <p className="text-body-sm text-text-secondary">
              Because your vault passphrase never reaches our servers, we cannot reset it.
              At signup, you download a Recovery Kit — a backup of your Master Key encrypted
              with a recovery passphrase you set once. Keep it somewhere safe. Loss of both
              your vault passphrase and your Recovery Kit means permanent data loss. By design.
            </p>
          </div>
          <div className="p-5 rounded-card border border-border-default bg-bg-elevated">
            <h2 className="text-subheading font-medium text-text-primary mb-2">All ML runs in your browser</h2>
            <p className="text-body-sm text-text-secondary">
              Whisper transcription and BERT keyword extraction run as WebAssembly in your browser.
              Your audio and text never leave your device on the free tier.
              Scholar tier offers optional server-side transcription (VibeVoice-ASR) with explicit
              per-session consent — you opt in each time, and audio is discarded immediately after transcription.
            </p>
          </div>
          <div className="p-5 rounded-card border border-border-default bg-bg-elevated">
            <h2 className="text-subheading font-medium text-text-primary mb-2">Row-level security</h2>
            <p className="text-body-sm text-text-secondary">
              Every database table and storage bucket enforces Supabase Row-Level Security.
              Your data rows and storage paths are restricted to your user ID — no query can
              return another user&apos;s data, even if our application code has a bug.
            </p>
          </div>
        </section>

        {/* Responsible disclosure */}
        <section id="disclosure" className="pt-8 border-t border-border-subtle">
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-3">
            Responsible Disclosure
          </p>
          <h2 className="text-subheading font-medium text-text-primary mb-3">
            Found a security issue?
          </h2>
          <p className="text-body-sm text-text-secondary mb-4">
            We take security reports seriously. If you&apos;ve found a vulnerability, please email us
            privately before public disclosure. We&apos;ll acknowledge your report within 48 hours
            and work to resolve confirmed issues quickly.
          </p>
          {/* TODO: confirm final domain before launch */}
          <a
            href="mailto:security@nocturne.app"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors"
          >
            <Mail size={14} strokeWidth={1.5} />
            security@nocturne.app
          </a>
        </section>
      </div>
    </div>
    </PageFade>
  )
}
