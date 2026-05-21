'use client'

// Individual transcript word. Subscribes to store.activeWordId for playhead highlighting.
// Accepts optional keywordZone / keywordId for Red/Likely Zone hot-linking.

import { useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useSessionStore } from '@/store/session-store'
import { useMotion } from '@/lib/motion'

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
  const { reduced } = useMotion()

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
    <motion.span
      ref={spanRef}
      onClick={handleClick}
      data-start-ms={startMs}
      data-end-ms={endMs}
      animate={isActive ? {
        scale: reduced ? 1 : 1.02,
        transition: { type: 'spring', stiffness: 500, damping: 30 }
      } : { scale: 1 }}
      style={{ display: 'inline-block' }}
      className={[
        'cursor-pointer select-text leading-relaxed rounded-sm px-0.5',
        'text-body transition-colors duration-[80ms]',
        // Playhead highlight takes priority over keyword zone
        isActive
          ? 'text-indigo-400 bg-indigo-500/20'
          : isRed
          ? 'text-rose-300 bg-rose-900/20 underline decoration-rose-900 hover:bg-rose-900/30'
          : isLikely
          ? 'text-violet-300 bg-violet-900/15 hover:bg-violet-900/25'
          : 'text-text-primary hover:text-indigo-400',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {word}{' '}
    </motion.span>
  )
}
