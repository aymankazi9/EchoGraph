'use client'

// Consent gate for Ask tab RAG calls.
// Per CONTEXT.md §10 rule 9: all external API calls require per-session explicit consent.
// Modal cannot be dismissed by backdrop click — only via explicit button choice.

import { AnimatePresence, motion } from 'framer-motion'
import { Shield } from 'lucide-react'

// DESIGN_SYSTEM.md §7 modalEntry variant — identical to youtube/consent-modal.tsx
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

interface Props {
  open: boolean
  onAllow: () => void
  onDeny: () => void
}

export function AskConsentModal({ open, onAllow, onDeny }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
          aria-modal="true"
          role="dialog"
          aria-labelledby="ask-consent-title"
        >
          <motion.div
            variants={modalEntry}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] mx-4 bg-bg-elevated rounded-modal border border-border-default shadow-lg p-6 flex flex-col gap-5"
          >
            <div className="flex items-start gap-3">
              <Shield size={20} strokeWidth={1.5} className="text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h2
                  id="ask-consent-title"
                  className="text-subheading font-medium text-text-primary mb-2"
                >
                  This feature sends content to a server
                </h2>
                <p className="text-body-sm text-text-secondary leading-relaxed">
                  To answer your question, Nocturne will decrypt this session&apos;s transcript
                  and slide text client-side, then send it to a Nocturne server endpoint
                  for this query only. The content is used to generate your answer and is
                  not stored in plaintext at any point — it is request-scoped and discarded
                  immediately after the response is returned.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onAllow}
                className="w-full h-9 rounded-btn bg-indigo-500 text-text-inverse text-body font-medium hover:bg-indigo-600 transition-colors"
              >
                Allow for this session
              </button>
              <button
                type="button"
                onClick={onDeny}
                className="w-full h-9 rounded-btn text-body text-text-secondary hover:bg-bg-subtle transition-colors"
              >
                Keep everything local
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
