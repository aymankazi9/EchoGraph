'use client'

// Individual transcript word. Subscribes to store.activeWordId for playhead highlighting.
// Accepts optional keywordZone / keywordId for Red/Likely Zone hot-linking.

import { useRef, useEffect, useCallback } from 'react'
import { useSessionStore } from '@/store/session-store'

interface Props {
  id: string
  word: string
  startMs: number
  endMs: number
  keywordZone?: 'red' | 'likely' | null
  keywordId?: string | null
}

export function WordSpan({ id, word, startMs, endMs, keywordZone, keywordId }: Props) {
  const spanRef = useRef<HTMLSpanElement>(null)

  const jumpToWord = useSessionStore((s) => s.jumpToWord)
  const setActiveKeyword = useSessionStore((s) => s.setActiveKeyword)
  // Selector returns a stable boolean — only this span re-renders when its active state flips.
  const isActive = useSessionStore(useCallback((s) => s.activeWordId === id, [id]))

  useEffect(() => {
    if (isActive && spanRef.current) {
      spanRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isActive])

  const handleClick = useCallback(() => {
    jumpToWord(id)
    if (keywordId) setActiveKeyword(keywordId)
  }, [id, jumpToWord, keywordId, setActiveKeyword])

  const isRed = keywordZone === 'red'
  const isLikely = keywordZone === 'likely'

  return (
    <span
      ref={spanRef}
      onClick={handleClick}
      data-start-ms={startMs}
      data-end-ms={endMs}
      className={[
        'inline cursor-pointer select-text leading-relaxed rounded-sm px-0.5',
        'text-body transition-colors duration-[80ms]',
        // Playhead highlight takes priority over keyword zone
        isActive
          ? 'text-teal-300 bg-teal-500/20'
          : isRed
          ? 'text-red-200 bg-red-500/20 underline decoration-red-500 hover:bg-red-500/30'
          : isLikely
          ? 'text-purple-200 bg-purple-500/15 hover:bg-purple-500/25'
          : 'text-text-primary hover:text-teal-300',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {word}{' '}
    </span>
  )
}
