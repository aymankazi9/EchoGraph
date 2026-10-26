'use client'

import { useEffect, useRef, useState } from 'react'
import type { LiveStatus, LiveWord } from '@/lib/live-transcription'

// ─── Constants ────────────────────────────────────────────────────────────────

const LAG_WARN_SEC  = 24
const PERM_NOTE_KEY = 'nocturne:rec-perm-noted'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)            return `${bytes} B`
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecordingBarProps {
  liveStatus:     LiveStatus
  liveWords:      LiveWord[]
  /** 0–1 RMS-derived level from AnalyserNode, sampled ~4×/s */
  level:          number
  /** Seconds of audio buffered in the Whisper queue, not yet transcribed */
  lagSec:         number
  silenceDetected: boolean
  /** Running byte estimate from MediaRecorder blobs */
  estimatedBytes: number
  /** Non-fatal transcript DB write error forwarded from onWarning; never changes the recording phase */
  dbWriteError?:  string | null
  /** IDB quota exceeded — crash recovery disabled; forwarded from onWarning */
  quotaWarning?:  boolean
  onStop:         () => void
  onDiscard:      () => void
  keywordZoneMap?: Map<string, 'red' | 'likely'>
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecordingBar({
  liveStatus, liveWords, level, lagSec, silenceDetected,
  estimatedBytes, dbWriteError, quotaWarning,
  onStop, onDiscard, keywordZoneMap,
}: RecordingBarProps) {
  const { phase } = liveStatus

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [permNoteDismissed, setPermNoteDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false
    return !!sessionStorage.getItem(PERM_NOTE_KEY)
  })
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  // ── ARIA live region state ─────────────────────────────────────────────────
  // Updated on phase transitions, silence, and lag threshold crossing.
  // NOT updated on every elapsed second or every word arrival.
  const [ariaMsg, setAriaMsg] = useState('')
  const prevPhaseRef   = useRef<string>('')
  const lagWarnFiredRef = useRef(false)

  // Phase transitions → single ARIA announcement
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (prev === phase) return
    switch (phase) {
      case 'requesting_mic': setAriaMsg('Requesting microphone access…'); break
      case 'model_loading':  setAriaMsg('Loading transcription model…'); break
      case 'recording':      setAriaMsg('Recording started'); break
      case 'saving':         setAriaMsg('Saving recording…'); break
      case 'saved':          setAriaMsg('Recording saved'); break
      case 'error':          setAriaMsg(`Recording error: ${liveStatus.message}`); break
    }
  }, [phase, liveStatus])

  // Silence (fires once when flag flips to true)
  useEffect(() => {
    if (silenceDetected) setAriaMsg('No audio detected — make sure your microphone is working')
  }, [silenceDetected])

  // Lag (fires once per lag episode; resets when lag clears)
  useEffect(() => {
    if (lagSec >= LAG_WARN_SEC && !lagWarnFiredRef.current) {
      lagWarnFiredRef.current = true
      setAriaMsg('Transcription is behind — audio is still being captured')
    } else if (lagSec < LAG_WARN_SEC) {
      lagWarnFiredRef.current = false
    }
  }, [lagSec])

  // ── Handlers ───────────────────────────────────────────────────────────────

  function dismissPermNote() {
    sessionStorage.setItem(PERM_NOTE_KEY, '1')
    setPermNoteDismissed(true)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      role="region"
      aria-label="Recording status"
      style={{ flexShrink: 0, borderTop: '1px solid #16151E', background: '#0A0A0F', display: 'flex', flexDirection: 'column' }}
    >
      {/* ── Keyframe + utility class definitions ─────────────────────────── */}
      {/* Injected once per mount; classes are used by dot elements and level bar.
          prefers-reduced-motion disables both the pulse and the width transition. */}
      <style>{`
        @keyframes rec-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
        .rec-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #FB7185; display: inline-block; flex-shrink: 0;
          animation: rec-pulse 1.4s ease-in-out infinite;
        }
        .rec-dot-sm {
          width: 6px; height: 6px; border-radius: 50%;
          background: #FB7185; display: inline-block; flex-shrink: 0;
          animation: rec-pulse 1.4s ease-in-out infinite;
        }
        .rec-dot-saved {
          width: 6px; height: 6px; border-radius: 50%;
          background: #4ADE80; display: inline-block; flex-shrink: 0;
        }
        .level-fill {
          height: 100%;
          background: linear-gradient(90deg, #FB7185 0%, #F43F5E 100%);
          border-radius: 2px;
          transition: width 0.15s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .rec-dot, .rec-dot-sm { animation: none; opacity: 1; transform: none; }
          .level-fill { transition: none; }
        }
      `}</style>

      {/* Visually-hidden ARIA live region — screen reader only */}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute', width: 1, height: 1, padding: 0,
          overflow: 'hidden', clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap', border: 0,
        }}
      >
        {ariaMsg}
      </span>

      {/* ── Compact states: requesting_mic / model_loading / saving / saved / error ── */}
      {phase !== 'recording' && (
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 10 }}>

          {/* Status indicator */}
          {phase === 'saved' ? (
            <span className="rec-dot-saved" />
          ) : phase === 'error' ? (
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="#FB7185" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="9" cy="9" r="7" />
              <path d="M9 6 V10 M9 13 V13.1" />
            </svg>
          ) : (
            <span className="rec-dot-sm" />
          )}

          {/* Status text */}
          <span style={{ fontSize: 12.5, color: '#94A3B8' }}>
            {phase === 'requesting_mic' && 'Requesting microphone access…'}
            {phase === 'model_loading'  && `Loading transcription model… ${liveStatus.progress}%`}
            {phase === 'saving'         && 'Saving recording…'}
            {phase === 'saved'          && 'Recording saved'}
            {phase === 'error'          && `Error: ${liveStatus.message}`}
          </span>

          {/* Model load progress bar */}
          {phase === 'model_loading' && (
            <div style={{ flex: 1, maxWidth: 100, height: 3, borderRadius: 2, background: '#1E1E2E', overflow: 'hidden', marginLeft: 4 }}>
              <div style={{ height: '100%', width: `${liveStatus.progress}%`, background: '#6366F1', borderRadius: 2, transition: 'width 0.3s ease-out' }} />
            </div>
          )}
        </div>
      )}

      {/* ── Expanded recording state ────────────────────────────────────── */}
      {phase === 'recording' && (
        <>
          {/* Permission note — shows once until dismissed (sessionStorage-backed) */}
          {!permNoteDismissed && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 18px',
              borderBottom: '1px solid #16151E',
              background: 'rgba(99,102,241,0.05)',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11.5, color: '#818CF8' }}>
                Make sure you have permission to record this lecture.
              </span>
              <button
                type="button"
                onClick={dismissPermNote}
                aria-label="Dismiss permission note"
                style={{
                  width: 22, height: 22, flexShrink: 0, marginLeft: 12,
                  borderRadius: 5, border: 'none', background: 'transparent',
                  color: '#4B5563', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M2 2 L10 10 M10 2 L2 10" />
                </svg>
              </button>
            </div>
          )}

          {/* Top row: dot · timer · status badges · spacer · size · discard · stop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px 5px', flexShrink: 0 }}>
            <span className="rec-dot" />
            <span style={{
              fontSize: 13, color: '#E2E8F0',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'var(--font-mono), monospace',
              flexShrink: 0, letterSpacing: '0.01em',
            }}>
              {formatElapsed(liveStatus.elapsedSec)}
            </span>

            {/* Interrupted — PCM drift detected */}
            {liveStatus.drifted && (
              <span style={{
                fontSize: 10.5, color: '#FBBF24', flexShrink: 0,
                padding: '2px 7px', borderRadius: 5,
                background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.22)',
              }}>
                Interrupted
              </span>
            )}

            {/* Transcript DB write error */}
            {dbWriteError && (
              <span
                title={dbWriteError}
                style={{
                  fontSize: 10.5, color: '#FB7185', flexShrink: 0,
                  padding: '2px 7px', borderRadius: 5,
                  background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.22)',
                  cursor: 'default',
                }}
              >
                Transcript error
              </span>
            )}

            <div style={{ flex: 1 }} />

            {/* Estimated size */}
            {estimatedBytes > 0 && (
              <span style={{
                fontSize: 11, color: '#3F485C',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}>
                {formatBytes(estimatedBytes)}
              </span>
            )}

            {/* Discard (two-step inline confirmation) */}
            {confirmingDiscard ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Discard recording?</span>
                <button
                  type="button"
                  onClick={() => { setConfirmingDiscard(false); onDiscard() }}
                  style={{
                    height: 26, padding: '0 10px', borderRadius: 7,
                    border: '1px solid rgba(251,113,133,0.4)',
                    background: 'rgba(251,113,133,0.12)',
                    color: '#FB7185', fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Yes, discard
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDiscard(false)}
                  style={{
                    height: 26, padding: '0 10px', borderRadius: 7,
                    border: '1px solid #23222F', background: '#0D0D14',
                    color: '#5B6478', fontSize: 11.5, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDiscard(true)}
                style={{
                  height: 26, padding: '0 10px', borderRadius: 7, flexShrink: 0,
                  border: '1px solid #1E1E2E', background: 'transparent',
                  color: '#3F485C', fontSize: 11.5, cursor: 'pointer',
                }}
              >
                Discard
              </button>
            )}

            {/* Stop (primary action) */}
            <button
              type="button"
              onClick={onStop}
              style={{
                height: 30, padding: '0 14px', borderRadius: 8, flexShrink: 0,
                border: '1px solid rgba(251,113,133,0.4)',
                background: 'rgba(251,113,133,0.12)',
                color: '#FB7185', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="8" height="8" viewBox="0 0 10 10" fill="#FB7185">
                <rect x="0" y="0" width="10" height="10" rx="1.5" />
              </svg>
              Stop
            </button>
          </div>

          {/* Level meter */}
          <div style={{ padding: '2px 18px 5px', flexShrink: 0 }}>
            <div style={{ height: 4, borderRadius: 3, background: '#1B1A29', overflow: 'hidden' }}>
              <div className="level-fill" style={{ width: `${Math.min(100, Math.round(level * 100))}%` }} />
            </div>
          </div>

          {/* Last 10–15 words, with keyword zone highlights */}
          <div style={{
            padding: '0 18px 6px', fontSize: 13, color: '#5B6478',
            lineHeight: 1.65, maxHeight: 52, overflowY: 'auto', flexShrink: 0,
          }}>
            <span style={{
              fontSize: 9.5, color: '#3F485C',
              fontFamily: 'var(--font-mono), monospace',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              marginRight: 8,
            }}>
              Updates every few seconds
            </span>
            {liveWords.length > 0
              ? liveWords.map((w) => {
                  const clean = w.word.toLowerCase().replace(/[^a-z0-9]/g, '')
                  const zone  = keywordZoneMap?.get(clean)
                  return (
                    <span
                      key={w.id}
                      style={zone ? {
                        color: zone === 'red' ? '#FDA4AF' : '#FDE68A',
                        background: zone === 'red' ? 'rgba(251,113,133,0.1)' : 'rgba(251,191,36,0.08)',
                        borderRadius: 3, padding: '0 2px',
                      } : undefined}
                    >
                      {w.word}{' '}
                    </span>
                  )
                })
              : <span style={{ color: '#3F485C', fontStyle: 'italic' }}>Listening…</span>
            }
          </div>

          {/* Warning notices (silence, lag, quota) */}
          {(silenceDetected || lagSec >= LAG_WARN_SEC || quotaWarning) && (
            <div style={{ padding: '0 18px 8px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
              {silenceDetected && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#FBBF24' }}>
                  <svg width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M9 3 L16 15 H2 Z" /><path d="M9 8 V11.5 M9 13.5 V13.6" />
                  </svg>
                  No audio detected — check your microphone
                </div>
              )}
              {lagSec >= LAG_WARN_SEC && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#94A3B8' }}>
                  <svg width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="9" cy="9" r="7" /><path d="M9 5 V9 L12.5 11" />
                  </svg>
                  Transcription is behind — audio is still being captured
                </div>
              )}
              {quotaWarning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#FBBF24' }}>
                  <svg width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M9 3 L16 15 H2 Z" /><path d="M9 8 V11.5 M9 13.5 V13.6" />
                  </svg>
                  Storage full — crash recovery unavailable
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
