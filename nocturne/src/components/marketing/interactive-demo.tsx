'use client'

import { useState, useEffect, useRef } from 'react'
import { SUBJECTS, ZONE_COLORS, MODE_LABELS, MODE_CAPTIONS } from './demo-data'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = 0 | 1 | 2

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ModeTabBar({ mode, onSelect }: { mode: Mode; onSelect: (m: Mode) => void }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: '3px',
        gap: '3px',
        borderRadius: '9px',
        background: '#09090F',
        border: '1px solid #1E1E2E',
      }}
    >
      {MODE_LABELS.map((label, i) => {
        const active = i === mode
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(i as Mode)}
            style={{
              height: 30,
              padding: '0 13px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: active ? 600 : 400,
              background: active ? '#1C1B28' : 'transparent',
              color: active ? '#E2E8F0' : '#5B6478',
              boxShadow: active ? '0 0 0 1px #2D2B45' : 'none',
              transition: 'all .2s',
              fontFamily: 'inherit',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function SubjectDropdown({
  subject,
  open,
  onToggle,
  onSelect,
}: {
  subject: number
  open: boolean
  onToggle: () => void
  onSelect: (i: number) => void
}) {
  const cur = SUBJECTS[subject]
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '7px 11px',
          borderRadius: 7,
          border: '1px solid #1E1E2E',
          background: '#09090F',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: '#94A3B8',
          cursor: 'pointer',
          transition: 'border-color .2s, color .2s',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#F43F5E',
            boxShadow: '0 0 10px rgba(244,63,94,0.7)',
            flexShrink: 0,
          }}
        />
        {cur.code} · {cur.topic} · {cur.time}
        <span style={{ color: '#5B6478', fontSize: 9, marginLeft: 1 }}>▼</span>
      </button>

      {open && (
        <>
          <div
            onClick={onToggle}
            style={{ position: 'fixed', inset: 0, zIndex: 29 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              zIndex: 30,
              minWidth: 248,
              border: '1px solid #2D2B45',
              borderRadius: 9,
              background: '#16151F',
              boxShadow: '0 14px 36px rgba(0,0,0,0.55)',
              overflow: 'hidden',
              padding: 4,
            }}
          >
            {SUBJECTS.map((sub, i) => (
              <button
                key={sub.code}
                type="button"
                onClick={() => onSelect(i)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 14px',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 6,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  background: i === subject ? '#1C1B28' : 'transparent',
                  color: i === subject ? '#E2E8F0' : '#94A3B8',
                  transition: 'background .15s, color .15s',
                }}
              >
                {sub.code} · {sub.topic}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function DemoTranscript({ subject, mode, scanning }: { subject: number; mode: Mode; scanning: boolean }) {
  const cur = SUBJECTS[subject]

  const zoneOf = (name: string) => {
    const kw = cur.KW.find((k) => k.name === name)
    return kw ? kw.m[mode] : { z: 'none' as const, c: 0 }
  }

  return (
    <div
      style={{
        position: 'relative',
        padding: '26px 26px 24px',
        borderRight: '1px solid #1E1E2E',
        overflow: 'hidden',
      }}
    >
      <p
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#5B6478',
          margin: '0 0 16px',
        }}
      >
        Lecture transcript
      </p>
      <p style={{ fontSize: 17, lineHeight: 1.85, margin: 0, color: '#94A3B8' }}>
        {cur.src.map((tok, i) => {
          if ('t' in tok) {
            return <span key={i} style={{ transition: 'color .4s' }}>{tok.t}</span>
          }
          const z = zoneOf(tok.k)
          if (z.z === 'none') {
            return (
              <span
                key={i}
                style={{
                  color: '#C2CAD6',
                  borderBottom: '1px dashed #2D2B45',
                  transition: 'all .45s',
                }}
              >
                {tok.k}
              </span>
            )
          }
          const zc = ZONE_COLORS[z.z]
          return (
            <span
              key={i}
              style={{
                color: zc.text,
                background: `rgba(${zc.rgb},0.12)`,
                borderBottom: `1px solid rgba(${zc.rgb},0.5)`,
                borderRadius: 3,
                padding: '1px 4px',
                transition: 'all .45s',
              }}
            >
              {tok.k}
            </span>
          )
        })}
      </p>

      {scanning && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: 90,
            background:
              'linear-gradient(90deg, transparent, rgba(129,140,248,0.16), rgba(167,139,250,0.05), transparent)',
            animation: 'noct-sweep 0.72s cubic-bezier(.4,0,.2,1)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}

function DemoSidebar({ subject, mode }: { subject: number; mode: Mode }) {
  const cur = SUBJECTS[subject]

  const detected = cur.KW
    .map((k) => ({ name: k.name, m: k.m[mode] }))
    .filter((x) => x.m.c > 0)
    .sort((a, b) => b.m.c - a.m.c)

  const redCount = cur.KW.filter((k) => k.m[mode].z === 'red').length
  const likelyCount = cur.KW.filter((k) => k.m[mode].z === 'likely').length
  const summary =
    redCount > 0 ? `${redCount} Red · ${likelyCount} Likely` : `${likelyCount} Likely`

  return (
    <div style={{ padding: '26px 24px 24px', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <p
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#5B6478',
            margin: 0,
          }}
        >
          Surfaced keywords
        </p>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#94A3B8' }}>
          {summary}
        </span>
      </div>

      <p
        style={{
          fontSize: 12.5,
          color: '#5B6478',
          margin: '0 0 18px',
          minHeight: 32,
          lineHeight: 1.5,
        }}
      >
        {MODE_CAPTIONS[mode]}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {detected.map((x) => {
          const zc = ZONE_COLORS[x.m.z as keyof typeof ZONE_COLORS]
          return (
            <div key={x.name}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13.5,
                    color: '#E2E8F0',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: zc.bar,
                      flexShrink: 0,
                      boxShadow: `0 0 8px rgba(${zc.rgb},0.6)`,
                    }}
                  />
                  {x.name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: zc.text,
                    flexShrink: 0,
                  }}
                >
                  {x.m.c}%
                </span>
              </div>

              <div
                style={{
                  height: 5,
                  borderRadius: 9999,
                  background: '#1C1B28',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${x.m.c}%`,
                    borderRadius: 9999,
                    background: `linear-gradient(90deg, rgba(${zc.rgb},0.5), ${zc.bar})`,
                    transition: 'width .7s cubic-bezier(.16,1,.3,1)',
                  }}
                />
              </div>

              <span
                style={{
                  display: 'inline-block',
                  marginTop: 5,
                  fontSize: 10.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: zc.text,
                  opacity: 0.8,
                }}
              >
                {zc.label}
              </span>
            </div>
          )
        })}
      </div>

      {detected.length === 0 && (
        <p style={{ fontSize: 13, color: '#5B6478', marginTop: 8 }}>
          No keywords detected yet. Add a recording or study guide.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function InteractiveDemo() {
  const [mode, setModeState] = useState<Mode>(2)
  const [scanning, setScanning] = useState(false)
  const [subject, setSubjectState] = useState(0)
  const [subjectOpen, setSubjectOpen] = useState(false)
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerScan = () => {
    setScanning(true)
    if (scanTimer.current) clearTimeout(scanTimer.current)
    scanTimer.current = setTimeout(() => setScanning(false), 740)
  }

  const selectMode = (m: Mode) => {
    if (m === mode) return
    setModeState(m)
    triggerScan()
  }

  const selectSubject = (i: number) => {
    setSubjectState(i)
    setSubjectOpen(false)
    triggerScan()
  }

  useEffect(() => () => { if (scanTimer.current) clearTimeout(scanTimer.current) }, [])

  return (
    <section className="px-6 py-20 md:py-28 border-t border-border-subtle">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-3">
            Live demo
          </p>
          <h2 className="text-heading font-medium text-text-primary">
            Works with whatever you have
          </h2>
          <p className="text-body text-text-secondary max-w-[520px] mx-auto mt-4">
            Add what you have, and Nocturne sharpens its read. Step through a real lecture moment below.
          </p>
        </div>

        {/* Demo panel */}
        <div
          style={{
            border: '1px solid #1E1E2E',
            borderRadius: 14,
            background: '#111118',
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              padding: '16px 20px',
              borderBottom: '1px solid #1E1E2E',
              background: 'rgba(22,21,31,0.6)',
            }}
          >
            <SubjectDropdown
              subject={subject}
              open={subjectOpen}
              onToggle={() => setSubjectOpen((v) => !v)}
              onSelect={selectSubject}
            />
            <ModeTabBar mode={mode} onSelect={selectMode} />
          </div>

          {/* Content grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.45fr 1fr',
            }}
          >
            <DemoTranscript subject={subject} mode={mode} scanning={scanning} />
            <DemoSidebar subject={subject} mode={mode} />
          </div>
        </div>
      </div>
    </section>
  )
}
