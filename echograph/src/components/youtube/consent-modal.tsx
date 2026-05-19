'use client'

// Consent gate for YouTube API calls.
// Per CONTEXT.md §10 rule 9: all external API calls require per-session explicit consent.
// Modal cannot be dismissed by backdrop click — only via explicit button choice.

import { AnimatePresence, motion } from 'framer-motion'
import { Shield } from 'lucide-react'

// DESIGN_SYSTEM.md §7 modalEntry variant.
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

export function ConsentModal({ open, onAllow, onDeny }: Props) {
  return (
    <AnimatePresence>
      {open && (
        // Backdrop — click does nothing (consent flows must use explicit buttons)
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
          aria-modal="true"
          role="dialog"
          aria-labelledby="consent-title"
        >
          <motion.div
            variants={modalEntry}
            initial="hidden"
            animate="visible"
            exit="exit"
            // Stop clicks from reaching backdrop
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] mx-4 bg-bg-elevated rounded-modal border border-border-default shadow-lg p-6 flex flex-col gap-5"
          >
            <div className="flex items-start gap-3">
              <Shield size={20} strokeWidth={1.5} className="text-teal-300 shrink-0 mt-0.5" />
              <div>
                <h2
                  id="consent-title"
                  className="text-subheading font-medium text-text-primary mb-2"
                >
                  This feature requires an external connection
                </h2>
                <p className="text-body-sm text-text-secondary leading-relaxed">
                  To search YouTube, EchoGraph will send your Red Zone keywords to the YouTube
                  Data API. No audio, slides, or personal information is included — only the
                  keyword text. This connection is made over HTTPS. YouTube&apos;s privacy policy
                  applies to this request.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onAllow}
                className="w-full h-9 rounded-btn bg-teal-300 text-text-inverse text-body font-medium hover:bg-teal-400 transition-colors"
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
