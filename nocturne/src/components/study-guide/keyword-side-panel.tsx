'use client'

// Side panel showing details for the active keyword.
// Slides in from right when a chip is clicked (DESIGN_SYSTEM.md §7 fadeUp).

import { useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Zap, Layers } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'

const slideIn = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } },
  exit: { opacity: 0, x: 24, transition: { duration: 0.15 } },
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="h-1 w-full bg-bg-subtle rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function KeywordSidePanel() {
  const keywords = useSessionStore((s) => s.keywords)
  const activeKeywordId = useSessionStore((s) => s.activeKeywordId)
  const setActiveKeyword = useSessionStore((s) => s.setActiveKeyword)
  const jumpToSlide = useSessionStore((s) => s.jumpToSlide)
  const flashcards = useSessionStore((s) => s.flashcards)

  const keyword = keywords.find((k) => k.id === activeKeywordId) ?? null
  const maxMentions = Math.max(...keywords.map((k) => k.mentionCount), 1)
  const maxDwell = Math.max(...keywords.map((k) => k.dwellTimeMs), 1)

  const fc = flashcards.find((f) => f.keywordTerm === keyword?.term) ?? null

  const handleClose = useCallback(() => setActiveKeyword(null), [setActiveKeyword])

  const isRed = keyword?.zone === 'red'

  return (
    <AnimatePresence>
      {keyword && (
        <motion.div
          key={keyword.id}
          variants={slideIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="absolute right-0 top-0 bottom-0 w-64 bg-bg-elevated border-l border-border-default flex flex-col z-10 shadow-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-default shrink-0">
            <div className="flex items-center gap-1.5">
              {isRed ? (
                <Zap size={14} strokeWidth={1.5} className="text-rose-300" />
              ) : (
                <Layers size={14} strokeWidth={1.5} className="text-violet-300" />
              )}
              <span
                className={[
                  'text-label font-medium truncate',
                  isRed ? 'text-rose-300' : 'text-violet-300',
                ].join(' ')}
              >
                {keyword.term}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="text-text-tertiary hover:text-text-secondary transition-colors"
              aria-label="Close"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4">
            {/* Zone badge */}
            <span
              className={[
                'self-start text-caption px-2 py-0.5 rounded-full',
                isRed
                  ? 'bg-rose-900 text-rose-200'
                  : 'bg-violet-900 text-violet-200',
              ].join(' ')}
            >
              {isRed ? 'Red Zone' : 'Likely Zone'}
              {' · '}
              {keyword.source === 'real_guide'
                ? 'Study Guide'
                : keyword.source === 'anki'
                ? 'Anki Import'
                : 'Synthetic'}
            </span>

            {/* Metrics */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-label text-text-secondary">Mentions</span>
                  <span className="text-label text-text-tertiary">{keyword.mentionCount}×</span>
                </div>
                <Bar
                  value={keyword.mentionCount}
                  max={maxMentions}
                  color={isRed ? 'bg-rose-300' : 'bg-violet-400'}
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-label text-text-secondary">Dwell time</span>
                  <span className="text-label text-text-tertiary">
                    {Math.round(keyword.dwellTimeMs / 1000)}s
                  </span>
                </div>
                <Bar
                  value={keyword.dwellTimeMs}
                  max={maxDwell}
                  color={isRed ? 'bg-rose-300' : 'bg-violet-400'}
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-label text-text-secondary">Lecture confidence</span>
                  <span className="text-label text-text-tertiary">
                    {Math.round(keyword.lectureConfidence * 100)}%
                  </span>
                </div>
                <Bar
                  value={keyword.lectureConfidence * 100}
                  max={100}
                  color="bg-indigo-500"
                />
              </div>
            </div>

            {/* Slides */}
            {keyword.slideIndices.length > 0 && (
              <div>
                <p className="text-label text-text-tertiary mb-1.5">Appears on</p>
                <div className="flex flex-wrap gap-1.5">
                  {keyword.slideIndices.map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => jumpToSlide(idx)}
                      className="text-caption px-2 py-0.5 rounded-btn border border-border-default text-text-secondary hover:bg-bg-subtle hover:text-indigo-400 transition-colors"
                    >
                      Slide {idx}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Flashcard */}
            {fc && (
              <div className="border border-border-default rounded-card p-2.5 bg-bg-overlay">
                <p className="text-label text-text-tertiary mb-1.5">Flashcard</p>
                <p className="text-body-sm text-text-secondary leading-relaxed">{fc.back}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
