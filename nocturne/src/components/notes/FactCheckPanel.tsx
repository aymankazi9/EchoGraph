'use client'

// Fact-check results side panel — rendered next to the notes editor when the
// user triggers a fact-check run.  No state is persisted; the panel is ephemeral.

import { CheckCircle, X, AlertTriangle } from 'lucide-react'

export interface FlaggedItem {
  excerpt:         string
  explanation:     string
  lectureEvidence: string | null
}

interface Props {
  flags:         FlaggedItem[]
  activeExcerpt: string | null
  onFlagClick:   (excerpt: string) => void
  onClose:       () => void
}

export function FactCheckPanel({ flags, activeExcerpt, onFlagClick, onClose }: Props) {
  return (
    <div
      style={{
        width: 288,
        flexShrink: 0,
        borderLeft: '1px solid #1E1E2E',
        background: '#0B0B11',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px 10px',
          borderBottom: '1px solid #1E1E2E',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <AlertTriangle size={13} strokeWidth={1.75} style={{ color: '#FBBF24', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E2E8F0', letterSpacing: '-0.01em' }}>
            Fact-check
          </span>
          {flags.length > 0 && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                lineHeight: 1,
                padding: '2px 6px',
                borderRadius: 9999,
                background: 'rgba(251,191,36,0.12)',
                color: '#FDE68A',
                border: '1px solid rgba(251,191,36,0.25)',
              }}
            >
              {flags.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close fact-check panel"
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: '#5B6478',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={12} strokeWidth={1.75} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 0' }}>
        {flags.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '40px 20px',
              textAlign: 'center',
            }}
          >
            <CheckCircle size={22} strokeWidth={1.5} style={{ color: '#34D399' }} />
            <p style={{ fontSize: 12.5, color: '#5B6478', margin: 0, lineHeight: 1.6 }}>
              No inconsistencies found — your notes match the lecture content.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
            {flags.map((flag, i) => {
              const isActive = flag.excerpt === activeExcerpt
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onFlagClick(flag.excerpt)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 10px 10px 12px',
                    borderRadius: 8,
                    border: isActive
                      ? '1px solid rgba(251,191,36,0.3)'
                      : '1px solid transparent',
                    background: isActive
                      ? 'rgba(251,191,36,0.06)'
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.12s, border-color 0.12s',
                    borderLeft: `3px solid ${isActive ? '#FBBF24' : 'rgba(251,191,36,0.3)'}`,
                  }}
                >
                  {/* Excerpt */}
                  <p
                    style={{
                      fontSize: 11.5,
                      color: '#94A3B8',
                      margin: '0 0 6px',
                      lineHeight: 1.55,
                      fontStyle: 'italic',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
                    }}
                  >
                    &ldquo;{flag.excerpt}&rdquo;
                  </p>

                  {/* Explanation */}
                  <p
                    style={{
                      fontSize: 12,
                      color: '#CBD5E1',
                      margin: 0,
                      lineHeight: 1.55,
                    }}
                  >
                    {flag.explanation}
                  </p>

                  {/* Lecture evidence */}
                  {flag.lectureEvidence && (
                    <p
                      style={{
                        fontSize: 11,
                        color: '#5B6478',
                        margin: '6px 0 0',
                        lineHeight: 1.5,
                        paddingTop: 6,
                        borderTop: '1px solid #1E1E2E',
                      }}
                    >
                      <span style={{ color: '#3F485C', fontWeight: 600, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: '0.05em' }}>
                        Lecture says:{' '}
                      </span>
                      {flag.lectureEvidence}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
