'use client'

// EnhancementOverlay  — blocking overlay shown on Study/Quiz tabs while cards
//                       are being enhanced.  Visible only for Midnight+ users.
// EnhancementTimeoutBanner — non-blocking strip shown after the 180 s hard
//                            timeout, offering a retry.

import { useEffect, useState } from 'react'
import { useEnhancementStore } from '@/store/enhancement-store'

const ESCAPE_AFTER_SEC = 10
const TIMEOUT_SEC = 180

// ── Blocking overlay ──────────────────────────────────────────────────────────

interface OverlayProps {
  sessionId: string
  onDismiss: () => void
}

export function EnhancementOverlay({ sessionId, onDismiss }: OverlayProps) {
  const runSessionId = useEnhancementStore((s) => s.sessionId)
  const isRunning    = useEnhancementStore((s) => s.isRunning)
  const completed    = useEnhancementStore((s) => s.completed)
  const total        = useEnhancementStore((s) => s.total)
  const startedAt    = useEnhancementStore((s) => s.startedAt)
  const dismissed    = useEnhancementStore((s) => s.dismissed)

  // Tick every second so elapsed/pct stay live.
  // We derive elapsed from startedAt (stable store value) so a tab-switch that
  // re-mounts the component picks up the correct elapsed time immediately.
  const [, setTick] = useState(0)
  const visible =
    runSessionId === sessionId &&
    isRunning &&
    !dismissed &&
    completed < total

  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [visible])

  // Hard timeout: check on every tick
  useEffect(() => {
    if (!visible || !startedAt) return
    if (Math.floor((Date.now() - startedAt) / 1000) >= TIMEOUT_SEC) {
      useEnhancementStore.getState().timeout()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])  // re-runs via the tick above because visible depends on store state

  if (!visible) return null

  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0
  const pct     = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(7,7,12,0.88)', backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 22, padding: 40,
    }}>
      <style>{`@keyframes enh-spin { to { transform: rotate(360deg) } }`}</style>

      {/* Spinner */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        border: '2px solid rgba(99,102,241,0.18)',
        borderTopColor: '#818CF8',
        animation: 'enh-spin 0.75s linear infinite',
      }} />

      {/* Message */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 14.5, fontWeight: 600, color: '#E2E8F0', margin: '0 0 5px' }}>
          Flashcards are being made.
        </p>
        <p style={{ fontSize: 13, color: '#4B5563', margin: 0 }}>
          Please wait a moment.
        </p>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
          width: '100%', maxWidth: 220,
        }}>
          <span style={{
            fontSize: 11.5, color: '#4B5563',
            fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
          }}>
            {completed} of {total}
          </span>
          <div style={{
            width: '100%', height: 2, borderRadius: 2,
            background: 'rgba(99,102,241,0.12)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, #4F46E5, #818CF8)',
              width: `${pct}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Escape hatch — appears after ESCAPE_AFTER_SEC */}
      {elapsed >= ESCAPE_AFTER_SEC && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', padding: '2px 0',
            fontSize: 12, color: '#374151', cursor: 'pointer',
            textDecoration: 'underline', textDecorationColor: '#1F2937',
            textUnderlineOffset: 3,
          }}
        >
          Study now with basic cards →
        </button>
      )}
    </div>
  )
}

// ── Timeout retry banner ──────────────────────────────────────────────────────

interface BannerProps {
  sessionId: string
  onRetry: () => void
}

export function EnhancementTimeoutBanner({ sessionId, onRetry }: BannerProps) {
  const runSessionId = useEnhancementStore((s) => s.sessionId)
  const timedOut     = useEnhancementStore((s) => s.timedOut)

  if (runSessionId !== sessionId || !timedOut) return null

  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 18px', gap: 12,
      background: 'rgba(234,179,8,0.05)',
      borderBottom: '1px solid rgba(234,179,8,0.12)',
    }}>
      <span style={{ fontSize: 12.5, color: '#92813A' }}>
        Some cards couldn&apos;t be improved.
      </span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          flexShrink: 0, height: 26, padding: '0 11px', borderRadius: 6, cursor: 'pointer',
          border: '1px solid rgba(234,179,8,0.22)',
          background: 'rgba(234,179,8,0.07)',
          fontSize: 12, color: '#B8972E',
        }}
      >
        Retry
      </button>
    </div>
  )
}
