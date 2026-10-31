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
          ? 'bg-bg-subtle text-text-primary'
          : isRed
          ? 'text-[#FF3B30] underline decoration-[#FF3B30] hover:bg-[rgba(255,59,48,0.06)]'
          : isLikely
          ? 'text-text-primary underline decoration-text-tertiary hover:bg-bg-subtle'
          : 'text-text-primary hover:bg-bg-subtle',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {word}{' '}
    </motion.span>
  )
}
