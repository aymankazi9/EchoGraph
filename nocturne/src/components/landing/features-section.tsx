'use client'

import { useEffect, useRef } from 'react'

const FEATURES = [
  {
    title: 'Red Zone Detection',
    body: 'Cross-references your study guide against slide density and verbal repetition to surface the highest-yield keywords.',
    red: true,
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={9} cy={9} r={7} />
        <circle cx={9} cy={9} r={3.5} />
        <circle cx={9} cy={9} r={0.9} fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: 'Emphasis Detection',
    body: 'Measures how long the professor dwells on each slide and how often they repeat each term. Not what was said — what was stressed.',
    red: false,
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 13 L6 7 L10 11 L16 3" />
        <path d="M12 3 h4 v4" />
      </svg>
    ),
  },
  {
    title: 'Confidence Score',
    body: 'Each Red Zone keyword gets a per-keyword score derived from slide density, verbal mentions, and study-guide alignment.',
    red: false,
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2 a7 7 0 1 1 -7 7" />
        <path d="M9 5 v4 l3 2" />
      </svg>
    ),
  },
  {
    title: 'Anki Integration',
    body: 'Import your existing deck to seed the guide. Export Red Zone cards as a valid .apkg, tagged and ready for spaced repetition.',
    red: false,
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x={2} y={3} width={14} height={10} rx={2} />
        <path d="M6 16 h6 M2 7 h14" />
      </svg>
    ),
  },
  {
    title: 'Zero-Knowledge Encrypted',
    body: 'Files are AES-GCM encrypted in the browser before upload. The server stores opaque blobs it cannot read.',
    red: false,
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x={4} y={8} width={10} height={7} rx={1.5} />
        <path d="M6 8 V6 a3 3 0 0 1 6 0 v2" />
      </svg>
    ),
  },
  {
    title: 'Runs in Your Browser',
    body: 'Whisper and BERT run as WASM Web Workers on your device. No audio leaves your machine on the free tier.',
    red: false,
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={9} cy={9} r={7} />
        <path d="M2 9 h14 M9 2 a11 11 0 0 1 0 14 M9 2 a11 11 0 0 0 0 14" />
      </svg>
    ),
  },
]

export function FeaturesSection() {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-feat]'))
    const handlers: Array<{ card: HTMLElement; fn: (e: PointerEvent) => void }> = []

    cards.forEach((card) => {
      const fn = (e: PointerEvent) => {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--mx', e.clientX - r.left + 'px')
        card.style.setProperty('--my', e.clientY - r.top + 'px')
      }
      card.addEventListener('pointermove', fn)
      handlers.push({ card, fn })
    })

    return () => {
      handlers.forEach(({ card, fn }) => card.removeEventListener('pointermove', fn))
    }
  }, [])

  return (
    <section
      id="features"
      style={{
        scrollMarginTop: 80,
        padding: 'clamp(72px,9vw,120px) 24px',
        borderTop: '1px solid #191827',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div data-reveal="" style={{ textAlign: 'center', marginBottom: 52 }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#5B6478',
              margin: '0 0 14px',
            }}
          >
            What&apos;s inside
          </p>
          <h2
            style={{
              fontSize: 'clamp(28px,4vw,40px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: 0,
              color: '#E2E8F0',
            }}
          >
            Everything the serious student needs.
          </h2>
        </div>

        {/* 3×2 grid */}
        <div
          ref={gridRef}
          data-reveal=""
          data-cards-3=""
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 1,
            background: '#1E1E2E',
            border: '1px solid #1E1E2E',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              data-feat=""
              {...(f.red ? { 'data-feat-red': '' } : {})}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                padding: '32px 28px',
                background: '#111118',
                transition: 'background .4s',
              }}
            >
              <span
                data-feat-glyph=""
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  border: '1px solid #2D2B45',
                  color: f.red ? '#FB7185' : '#818CF8',
                }}
              >
                {f.icon}
              </span>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: '#E2E8F0',
                  margin: 0,
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: '#94A3B8',
                  margin: 0,
                }}
              >
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
