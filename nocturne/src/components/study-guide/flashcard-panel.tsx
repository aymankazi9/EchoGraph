'use client'

// Flashcard review panel + Anki export button.
// Mounted as a slide-down from the bottom bar.

import { useState, useCallback } from 'react'
import { Download, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSessionStore } from '@/store/session-store'
import { useNotificationStore } from '@/store/notification-store'
import { createClient } from '@/lib/supabase'

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } },
  exit: { opacity: 0, y: 4, transition: { duration: 0.15 } },
}

interface Props {
  sessionTitle: string
  userId: string
}

export function FlashcardPanel({ sessionTitle, userId }: Props) {
  const flashcards = useSessionStore((s) => s.flashcards)
  const notify = useNotificationStore((s) => s.notify)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [exporting, setExporting] = useState(false)

  const card = flashcards[idx]

  const next = useCallback(() => {
    setIdx((i) => Math.min(i + 1, flashcards.length - 1))
    setFlipped(false)
  }, [flashcards.length])

  const prev = useCallback(() => {
    setIdx((i) => Math.max(i - 1, 0))
    setFlipped(false)
  }, [])

  const handleExport = useCallback(async () => {
    if (flashcards.length === 0 || exporting) return
    setExporting(true)
    try {
      const { generateApkg } = await import('@/lib/study-guide/anki-export')
      const data = await generateApkg(flashcards, sessionTitle)
      const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sessionTitle.replace(/[^a-z0-9]/gi, '_')}.apkg`
      a.click()
      URL.revokeObjectURL(url)
      notify({ type: 'success', message: 'Anki deck exported', duration: 2000 })
      createClient().from('users').update({ checklist_exported: true }).eq('id', userId)
    } finally {
      setExporting(false)
    }
  }, [flashcards, sessionTitle, userId, exporting, notify])

  if (flashcards.length === 0) return null

  return (
    <div className="border-t border-border-default px-4 py-3 bg-bg-elevated">
      <div className="flex items-center justify-between mb-3">
        <span className="text-caption uppercase tracking-wide text-text-tertiary">
          Flashcards · {flashcards.length}
        </span>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className={[
            'flex items-center gap-1 text-label text-text-secondary',
            'hover:text-indigo-400 transition-colors',
            exporting ? 'opacity-40' : '',
          ].join(' ')}
        >
          <Download size={12} strokeWidth={1.5} />
          {exporting ? 'Exporting…' : 'Export .apkg'}
        </button>
      </div>

      {card && (
        <div className="flex items-center gap-3">
          {/* Prev */}
          <button
            type="button"
            onClick={prev}
            disabled={idx === 0}
            className="text-text-tertiary hover:text-text-secondary disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} strokeWidth={1.5} className="rotate-180" />
          </button>

          {/* Card */}
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className={[
              'flex-1 min-h-[72px] rounded-card border text-left px-3 py-2.5 transition-colors',
              card.zone === 'red'
                ? 'border-rose-900 bg-rose-900/40 hover:bg-red-500/15'
                : 'border-purple-500 bg-violet-500/10 hover:bg-violet-500/15',
            ].join(' ')}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={flipped ? 'back' : 'front'}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {!flipped ? (
                  <p
                    className={[
                      'text-body font-medium',
                      card.zone === 'red' ? 'text-rose-200' : 'text-violet-200',
                    ].join(' ')}
                  >
                    {card.front}
                  </p>
                ) : (
                  <p className="text-body-sm text-text-secondary">{card.back}</p>
                )}
              </motion.div>
            </AnimatePresence>
            <p className="text-caption text-text-tertiary mt-1">
              {flipped ? 'Back' : 'Tap to flip'} · {idx + 1}/{flashcards.length}
            </p>
          </button>

          {/* Next */}
          <button
            type="button"
            onClick={next}
            disabled={idx === flashcards.length - 1}
            className="text-text-tertiary hover:text-text-secondary disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
}
