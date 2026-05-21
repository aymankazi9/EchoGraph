'use client'

import { motion } from 'framer-motion'
import { Shield, Lock } from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } },
}

const keyPoints = [
  'Vault passphrase never leaves your device — not even hashed',
  'Master Key is non-extractable; created with extractable: false',
  'Files are AES-GCM 256 encrypted before upload — the server stores opaque blobs',
  'PBKDF2 at 310,000 iterations runs in a Web Worker, never on the main thread',
  'Whisper + BERT run locally via WASM — no audio or text leaves the browser on Free tier',
  'Row-Level Security enforced on all database tables and storage buckets',
  'No password reset exists. There is no backdoor.',
]

export function PrivacyCallout() {
  return (
    <section className="px-6 py-20 md:py-28 border-t border-border-subtle">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        {/* Left — headline */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="flex flex-col gap-5"
        >
          <div className="flex items-center gap-2">
            <Shield size={18} strokeWidth={1.5} className="text-indigo-400" />
            <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary">
              Zero-knowledge architecture
            </p>
          </div>

          <h2 className="text-heading font-medium text-text-primary leading-snug">
            The server stores data it cannot read.
          </h2>
          <p className="text-body text-text-secondary leading-relaxed">
            Nocturne's encryption model is not a marketing claim — it's a structural constraint. Your vault passphrase derives the key that wraps your Master Key. That passphrase never leaves your browser.
          </p>

          {/* Key hierarchy — text only */}
          <div className="mt-2 rounded-card border border-border-default bg-bg-elevated p-4 font-mono text-mono-sm text-text-secondary space-y-1 leading-relaxed">
            <p className="text-text-tertiary text-caption uppercase tracking-[0.07em] mb-2 font-sans">3-Tier key hierarchy</p>
            <p>Passphrase <span className="text-text-tertiary">(your memory only)</span></p>
            <p className="pl-4 text-text-tertiary">↓ PBKDF2 · 310,000 iterations · SHA-256</p>
            <p>KEK <span className="text-text-tertiary">(memory only, discarded after unwrap)</span></p>
            <p className="pl-4 text-text-tertiary">↓ AES-KW unwrap</p>
            <p>Master Key <span className="text-text-tertiary">(non-extractable CryptoKey)</span></p>
            <p className="pl-4 text-text-tertiary">↓ AES-GCM 256 · unique IV per file</p>
            <p>Encrypted .bin blob <span className="text-text-tertiary">(stored in Supabase)</span></p>
          </div>
        </motion.div>

        {/* Right — guarantees list */}
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="flex flex-col gap-3 mt-1"
        >
          {keyPoints.map((point) => (
            <motion.li
              key={point}
              variants={staggerItem}
              className="flex items-start gap-3"
            >
              <Lock size={14} strokeWidth={1.5} className="text-indigo-400 mt-0.5 shrink-0" />
              <span className="text-body text-text-secondary leading-relaxed">{point}</span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
