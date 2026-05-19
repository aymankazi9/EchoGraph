'use client'

// Horizontally scrollable row of Red/Likely Zone keyword chips.
// "Find videos" button appears on the right when Red Zone keywords exist.
// Hidden when all keywords are Likely Zone only (synthetic guide).

import { useSessionStore } from '@/store/session-store'
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

      {keywords.map((kw) => {
        const isRed = kw.zone === 'red'
        const isActive = kw.id === activeKeywordId

        return (
          <button
            key={kw.id}
            type="button"
            role="listitem"
            onClick={() => setActiveKeyword(isActive ? null : kw.id)}
            className={[
              'flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0',
              'text-caption transition-colors whitespace-nowrap',
              isRed
                ? isActive
                  ? 'bg-red-300 text-red-50'
                  : 'bg-red-500 text-red-100 hover:bg-red-400'
                : isActive
                ? 'bg-purple-400 text-purple-50'
                : 'bg-purple-500 text-purple-100 hover:bg-purple-400',
            ].join(' ')}
          >
            {isRed ? (
              <Zap size={10} strokeWidth={1.5} />
            ) : (
              <Layers size={10} strokeWidth={1.5} />
            )}
            {kw.term}
          </button>
        )
      })}

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
              ? 'text-teal-300'
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
