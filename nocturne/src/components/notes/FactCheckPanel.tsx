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
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        background: '#0A0A0A',
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
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <AlertTriangle size={13} strokeWidth={1.75} style={{ color: '#76767B', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#EDEDED', letterSpacing: '-0.01em' }}>
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
                background: 'rgba(255,255,255,0.06)',
                color: '#9A9A9F',
                border: '1px solid rgba(255,255,255,0.14)',
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
            borderRadius: 2,
            border: 'none',
            background: 'transparent',
            color: '#76767B',
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
            <CheckCircle size={22} strokeWidth={1.5} style={{ color: '#EDEDED' }} />
            <p style={{ fontSize: 12.5, color: '#76767B', margin: 0, lineHeight: 1.6 }}>
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
                    borderRadius: 2,
                    border: isActive
                      ? '1px solid rgba(255,255,255,0.14)'
                      : '1px solid transparent',
                    background: isActive
                      ? 'rgba(255,255,255,0.05)'
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.12s, border-color 0.12s',
                    borderLeft: `3px solid ${isActive ? '#EDEDED' : 'rgba(255,255,255,0.14)'}`,
                  }}
                >
                  {/* Excerpt */}
                  <p
                    style={{
                      fontSize: 11.5,
                      color: '#9A9A9F',
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
                      color: '#EDEDED',
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
                        color: '#76767B',
                        margin: '6px 0 0',
                        lineHeight: 1.5,
                        paddingTop: 6,
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span style={{ color: '#76767B', fontWeight: 600, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: '0.05em' }}>
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
