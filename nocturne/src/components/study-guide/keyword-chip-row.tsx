'use client'

// Horizontally scrollable row of Red/Likely Zone keyword chips.
// "Find videos" button appears on the right when Red Zone keywords exist.
// Hidden when all keywords are Likely Zone only (synthetic guide).

import { motion } from 'framer-motion'
import { useSessionStore } from '@/store/session-store'
import { staggerContainer, chipReveal } from '@/lib/motion'
import { Zap, Layers, ExternalLink } from 'lucide-react'

export function KeywordChipRow() {
  const keywords = useSessionStore((s) => s.keywords)
  const activeKeywordId = useSessionStore((s) => s.activeKeywordId)
  const setActiveKeyword = useSessionStore((s) => s.setActiveKeyword)
  const youtubePanelOpen = useSessionStore((s) => s.youtubePanelOpen)
  const setYoutubePanelOpen = useSessionStore((s) => s.setYoutubePanelOpen)

  if (keywords.length === 0) return null

  const hasRedZone = keywords.some((k) => k.zone === 'red')

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-t border-border-default overflow-x-auto scrollbar-thin shrink-0"
      role="list"
      aria-label="Keywords"
    >
      <span className="text-caption uppercase tracking-wide text-text-tertiary shrink-0">
        Keywords
      </span>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate={keywords.length > 0 ? 'visible' : 'hidden'}
        className="flex items-center gap-2"
      >
        {keywords.map((kw) => {
          const isRed = kw.zone === 'red'
          const isActive = kw.id === activeKeywordId

          return (
            <motion.div key={kw.id} variants={chipReveal}>
              <button
                type="button"
                role="listitem"
                onClick={() => setActiveKeyword(isActive ? null : kw.id)}
                className={[
                  'flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0',
                  'text-caption transition-colors whitespace-nowrap border',
                  isRed
                    ? isActive
                      ? 'bg-rose-900/60 text-rose-200 border-rose-900'
                      : 'bg-rose-900/40 text-rose-200 border-rose-900 hover:bg-rose-900/60'
                    : isActive
                    ? 'bg-violet-900/60 text-violet-200 border-violet-900'
                    : 'bg-violet-900/40 text-violet-200 border-violet-900 hover:bg-violet-900/60',
                ].join(' ')}
              >
                {isRed ? (
                  <Zap size={10} strokeWidth={1.5} />
                ) : (
                  <Layers size={10} strokeWidth={1.5} />
                )}
                {kw.term}
              </button>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Spacer */}
      <div className="flex-1 shrink-0 min-w-[8px]" />

      {/* "Find videos" — only when Red Zone keywords exist */}
      {hasRedZone && (
        <button
          type="button"
          onClick={() => setYoutubePanelOpen(!youtubePanelOpen)}
          className={[
            'flex items-center gap-1 shrink-0 text-caption transition-colors whitespace-nowrap',
            'px-2 py-0.5 rounded-btn',
            youtubePanelOpen
              ? 'text-indigo-400'
              : 'text-text-tertiary hover:text-text-secondary',
          ].join(' ')}
        >
          <ExternalLink size={12} strokeWidth={1.5} />
          Find videos
        </button>
      )}
    </div>
  )
}
