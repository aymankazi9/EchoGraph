'use client'

const STEPS = [
  {
    step: '01',
    label: 'Slides only',
    title: 'Start with your deck',
    body: 'Nocturne extracts text from every slide and generates a Synthetic Study Guide automatically. Likely Zone keywords appear immediately.',
    chips: ['PDF viewer', 'Synthetic guide', 'Flashcards'],
    hi: false,
  },
  {
    step: '02',
    label: 'Add a recording',
    title: 'Layer in the lecture',
    body: 'Whisper transcribes your audio in-browser. The silence-gap engine syncs each word to its slide, measuring dwell time per topic.',
    chips: ['Word-level sync', 'Emphasis detection', 'Confidence'],
    hi: false,
  },
  {
    step: '03',
    label: 'Full session',
    title: 'Surface the Red Zone',
    body: 'Cross-reference your study guide against what the professor emphasized. Red Zone keywords are scored, hot-linked, and exported.',
    chips: ['Red Zone scoring', 'Heatmap', 'Anki export'],
    hi: true,
  },
]

export function HowItWorksSection() {
  return (
    <section
      id="how"
      style={{
        scrollMarginTop: 80,
        padding: 'clamp(72px,9vw,120px) 24px',
        borderTop: '1px solid #191827',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div data-reveal="" style={{ marginBottom: 52, textAlign: 'center' }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#5B6478',
              margin: '0 0 14px',
            }}
          >
            How it works
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
            Works with whatever you have.
          </h2>
        </div>

        {/* Cards */}
        <div
          data-reveal=""
          data-cards-3=""
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 18,
          }}
        >
          {STEPS.map((s) => (
            <div
              key={s.step}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 24,
                borderRadius: 12,
                minHeight: 240,
                background: '#111118',
                border: '1px solid ' + (s.hi ? 'rgba(244,63,94,0.35)' : '#1E1E2E'),
                boxShadow: s.hi
                  ? '0 0 0 1px rgba(244,63,94,0.1), 0 12px 40px rgba(244,63,94,0.08)'
                  : 'none',
                transition:
                  'transform .45s cubic-bezier(.22,1,.36,1), border-color .45s, box-shadow .45s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-6px)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.transform = 'none'
              }}
            >
              {/* Step number + label */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    color: s.hi ? '#FB7185' : '#818CF8',
                  }}
                >
                  {s.step}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    color: '#5B6478',
                  }}
                >
                  {s.label}
                </span>
              </div>

              {/* Title */}
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#E2E8F0',
                  margin: '0 0 10px',
                }}
              >
                {s.title}
              </h3>

              {/* Body */}
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: '#94A3B8',
                  margin: '0 0 18px',
                }}
              >
                {s.body}
              </p>

              {/* Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
                {s.chips.map((chip) => (
                  <span
                    key={chip}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 9px',
                      borderRadius: 9999,
                      fontSize: 11.5,
                      background: s.hi ? 'rgba(244,63,94,0.12)' : '#1C1B28',
                      color: s.hi ? '#FB7185' : '#5B6478',
                      border:
                        '1px solid ' + (s.hi ? 'rgba(244,63,94,0.25)' : '#191827'),
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
