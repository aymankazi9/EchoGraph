'use client'

// Custom seek bar with sync_map slide-transition tick marks.
// Spec: 4px track, teal-300 fill, amber-200 tick marks 2×8px at syncMap boundaries.

import { useRef, useCallback } from 'react'
import { useSessionStore } from '@/store/session-store'

export function SeekBar() {
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const seekTo = useSessionStore((s) => s.seekTo)
  const currentTimeMs = useSessionStore((s) => s.currentTimeMs)
  const durationMs = useSessionStore((s) => s.durationMs)
  const syncMap = useSessionStore((s) => s.syncMap)

  const pct = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0

  const seekFromPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!trackRef.current || durationMs === 0) return
      const rect = trackRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      seekTo(Math.round(ratio * durationMs))
    },
    [durationMs, seekTo],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      isDragging.current = true
      ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      seekFromPointer(e)
    },
    [seekFromPointer],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return
      seekFromPointer(e)
    },
    [seekFromPointer],
  )

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative h-5 flex items-center cursor-pointer select-none"
      role="slider"
      aria-valuenow={Math.round(currentTimeMs / 1000)}
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs / 1000)}
      aria-label="Seek"
    >
      {/* Track */}
      <div className="relative w-full h-1 bg-border-default rounded-full overflow-visible">
        {/* Played fill */}
        <div
          className="absolute inset-y-0 left-0 bg-teal-300 rounded-full pointer-events-none"
          style={{ width: `${pct}%` }}
        />

        {/* Slide-transition tick marks — 2px wide × 8px tall, amber-200 */}
        {durationMs > 0 &&
          syncMap.map((seg, i) => {
            const tickPct = (seg.startMs / durationMs) * 100
            if (tickPct <= 0.5 || tickPct >= 99.5) return null
            return (
              <div
                key={i}
                className="absolute bg-amber-200 pointer-events-none"
                style={{
                  left: `${tickPct}%`,
                  top: '-4px',
                  width: '2px',
                  height: '8px',
                  transform: 'translateX(-50%)',
                }}
              />
            )
          })}
      </div>
    </div>
  )
}
