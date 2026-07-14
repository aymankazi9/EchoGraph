'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Download } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSessionStore } from '@/store/session-store'
import { useNotificationStore } from '@/store/notification-store'
import { createClient } from '@/lib/supabase'
import { computeNextReview, type Rating } from '@/lib/scoring/srs'
import type { Flashcard } from '@/store/session-store'

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } },
  exit: { opacity: 0, y: 4, transition: { duration: 0.15 } },
}

const RATINGS: { rating: Rating; label: string; color: string; border: string; bg: string }[] = [
  { rating: 'again', label: 'Again', color: '#FDA4AF', border: 'rgba(251,113,133,0.35)', bg: 'rgba(251,113,133,0.08)' },
  { rating: 'hard',  label: 'Hard',  color: '#FDE68A', border: 'rgba(251,191,36,0.35)',  bg: 'rgba(251,191,36,0.08)'  },
  { rating: 'good',  label: 'Good',  color: '#A5B4FC', border: 'rgba(99,102,241,0.35)',  bg: 'rgba(99,102,241,0.08)'  },
  { rating: 'easy',  label: 'Easy',  color: '#6EE7B7', border: 'rgba(16,185,129,0.35)',  bg: 'rgba(16,185,129,0.08)'  },
]

interface LatestReview {
  easeFactor: number
  intervalDays: number
  dueAt: string
}

interface Props {
  sessionTitle: string
  userId: string
}

export function FlashcardPanel({ sessionTitle, userId }: Props) {
  const flashcards = useSessionStore((s) => s.flashcards)
  const notify = useNotificationStore((s) => s.notify)
  const supabase = useMemo(() => createClient(), [])

  const [reviewMap, setReviewMap] = useState<Record<string, LatestReview>>({})
  const [reviewsLoaded, setReviewsLoaded] = useState(false)
  // queue is built once when reviews load; ratings advance queueIdx without rebuilding
  const [queue, setQueue] = useState<Flashcard[]>([])
  const [queueIdx, setQueueIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Load latest review record per card
  useEffect(() => {
    if (flashcards.length === 0) { setReviewsLoaded(true); return }

    const ids = flashcards.map((f) => f.id)
    supabase
      .from('flashcard_reviews')
      .select('flashcard_id, ease_factor, interval_days, due_at')
      .in('flashcard_id', ids)
      .order('reviewed_at', { ascending: false })
      .then(({ data }) => {
        const map: Record<string, LatestReview> = {}
        for (const row of data ?? []) {
          const id = row.flashcard_id as string
          if (!map[id]) {
            map[id] = {
              easeFactor: row.ease_factor as number,
              intervalDays: row.interval_days as number,
              dueAt: row.due_at as string,
            }
          }
        }
        setReviewMap(map)
        setReviewsLoaded(true)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount; flashcard list is stable within a session

  // Build due-today queue once when reviews finish loading
  useEffect(() => {
    if (!reviewsLoaded) return
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)
    const due = flashcards.filter((fc) => {
      const r = reviewMap[fc.id]
      return !r || new Date(r.dueAt) <= endOfDay
    })
    setQueue(due)
    setQueueIdx(0)
    setFlipped(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewsLoaded]) // intentionally excludes flashcards/reviewMap — queue is fixed at load time

  const card = queue[queueIdx] ?? null
  // true only after reviews loaded; initial empty queue before load uses reviewsLoaded gate below
  const noDue = reviewsLoaded && queue.length === 0
  const sessionComplete = reviewsLoaded && queue.length > 0 && queueIdx >= queue.length

  const handleRate = useCallback(async (r: Rating) => {
    if (!card || submitting) return
    setSubmitting(true)

    const existing = reviewMap[card.id]
    const result = computeNextReview(r, existing?.easeFactor ?? 2.5, existing?.intervalDays ?? 0)

    setReviewMap((prev) => ({
      ...prev,
      [card.id]: {
        easeFactor: result.easeFactor,
        intervalDays: result.intervalDays,
        dueAt: result.dueAt.toISOString(),
      },
    }))
    setFlipped(false)
    setQueueIdx((i) => i + 1)
    setSubmitting(false)

    // fire-and-forget — RLS on user_id protects the row
    supabase.from('flashcard_reviews').insert({
      flashcard_id: card.id,
      user_id: userId,
      rating: r,
      ease_factor: result.easeFactor,
      interval_days: result.intervalDays,
      due_at: result.dueAt.toISOString(),
    })
  }, [card, submitting, reviewMap, userId, supabase])

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
      supabase.from('users').update({ checklist_exported: true }).eq('id', userId)
    } finally {
      setExporting(false)
    }
  }, [flashcards, sessionTitle, userId, exporting, notify, supabase])

  if (flashcards.length === 0) return null

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', letterSpacing: '-0.01em' }}>Study</span>
          {reviewsLoaded && (
            <span style={{ fontSize: 12, color: '#3F485C' }}>
              {noDue || sessionComplete ? `${flashcards.length} cards` : `${queue.length - queueIdx} due · ${flashcards.length} total`}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#3F485C', background: 'none', border: 'none', cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.5 : 1 }}
        >
          <Download size={12} strokeWidth={1.5} />
          {exporting ? 'Exporting…' : 'Export .apkg'}
        </button>
      </div>

      {/* Loading */}
      {!reviewsLoaded && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#3F485C', fontSize: 13 }}>
          Loading…
        </div>
      )}

      {/* No cards due today */}
      {noDue && (
        <div style={{ textAlign: 'center', padding: '40px 24px', borderRadius: 14, border: '1px solid #1A1A28', background: '#0C0C13' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#E2E8F0', margin: '0 0 6px' }}>All caught up</p>
          <p style={{ fontSize: 13, color: '#3F485C', margin: 0 }}>No cards due today. Come back tomorrow.</p>
        </div>
      )}

      {/* Session complete */}
      {sessionComplete && (
        <div style={{ textAlign: 'center', padding: '40px 24px', borderRadius: 14, border: '1px solid #1A1A28', background: '#0C0C13' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#E2E8F0', margin: '0 0 6px' }}>Session complete</p>
          <p style={{ fontSize: 13, color: '#3F485C', margin: 0 }}>You reviewed all {queue.length} due cards.</p>
        </div>
      )}

      {/* Card */}
      {reviewsLoaded && card && (
        <>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#3F485C', flexShrink: 0 }}>
              {queueIdx + 1} / {queue.length}
            </span>
            <div style={{ flex: 1, height: 2, borderRadius: 9999, background: '#16151F', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 9999,
                background: 'linear-gradient(90deg, #6366F1, #818CF8)',
                width: `${(queueIdx / queue.length) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* Card face — click to flip */}
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            style={{
              width: '100%',
              minHeight: 160,
              padding: '24px 20px',
              borderRadius: 14,
              cursor: 'pointer',
              textAlign: 'left',
              border: `1px solid ${card.zone === 'red' ? 'rgba(251,113,133,0.25)' : 'rgba(99,102,241,0.25)'}`,
              background: card.zone === 'red' ? 'rgba(251,113,133,0.05)' : 'rgba(99,102,241,0.05)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div key={flipped ? 'back' : 'front'} variants={fadeUp} initial="hidden" animate="visible" exit="exit">
                {flipped ? (
                  <p style={{ fontSize: 14, color: '#94A3B8', margin: 0, lineHeight: 1.65 }}>{card.back}</p>
                ) : (
                  <p style={{ fontSize: 17, fontWeight: 600, color: '#E2E8F0', margin: 0, lineHeight: 1.4 }}>{card.front}</p>
                )}
              </motion.div>
            </AnimatePresence>
            <span style={{ fontSize: 11, color: '#3F485C' }}>
              {flipped ? 'Answer · click to see question' : 'Click to reveal answer'}
            </span>
          </button>

          {/* Rating buttons — only visible after flip */}
          <AnimatePresence>
            {flipped && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}
              >
                {RATINGS.map(({ rating, label, color, border, bg }) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => handleRate(rating)}
                    disabled={submitting}
                    style={{
                      height: 40,
                      borderRadius: 9,
                      border: `1px solid ${border}`,
                      background: bg,
                      color,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.5 : 1,
                      transition: 'opacity 0.1s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
