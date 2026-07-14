const COMPARE_ROWS = [
  { label: 'Transcribes the lecture',                otter: true,  notion: false, turbo: true  },
  { label: 'Auto-generates notes & summaries',        otter: true,  notion: true,  turbo: true  },
  { label: 'Makes flashcards & practice quizzes',     otter: false, notion: false, turbo: true  },
  { label: 'Measures what the professor emphasized',  otter: false, notion: false, turbo: false },
  { label: 'Ranks every term by exam likelihood',     otter: false, notion: false, turbo: false },
  { label: 'Cross-references your own study guide',   otter: false, notion: false, turbo: false },
  { label: 'Slide-dwell + verbal-repetition heatmap', otter: false, notion: false, turbo: false },
  { label: 'Audio never leaves your device',          otter: false, notion: false, turbo: false },
  { label: 'Exports a valid, tagged Anki .apkg',      otter: false, notion: false, turbo: false },
]

const COL_HEAD: { label: string; sub?: string; nocturne?: boolean }[] = [
  { label: '' },
  { label: 'Otter.ai' },
  { label: 'Notion AI' },
  { label: 'Turbo AI' },
  { label: 'Nocturne', nocturne: true },
]

export function CompareSection() {
  return (
    <section
      style={{
        padding: 'clamp(72px,9vw,120px) 24px',
        borderTop: '1px solid #191827',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Header */}
        <div data-reveal="" style={{ textAlign: 'center', marginBottom: 44 }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#5B6478',
              margin: '0 0 14px',
            }}
          >
            Why it&apos;s different
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
            A note-taker records. Nocturne ranks.
          </h2>
          <p style={{ fontSize: 16, color: '#94A3B8', maxWidth: 560, margin: '16px auto 0' }}>
            Otter, Notion, and Turbo hand you notes and flashcards to grind through. Nocturne tells you which terms matter — ranked by how likely each one is to be on the exam.
          </p>
        </div>

        {/* Table */}
        <div
          data-reveal=""
          style={{
            border: '1px solid #1E1E2E',
            borderRadius: 14,
            overflow: 'hidden',
            background: '#111118',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 680 }}>
              {/* Header row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.9fr 1fr 1fr 1fr 1fr',
                }}
              >
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #1E1E2E' }} />
                {[
                  { label: 'Otter.ai', nocturne: false },
                  { label: 'Notion AI', nocturne: false },
                  { label: 'Turbo AI', nocturne: false },
                  { label: 'Nocturne', nocturne: true },
                ].map((col) => (
                  <div
                    key={col.label}
                    style={{
                      padding: '16px 10px',
                      borderBottom: '1px solid #1E1E2E',
                      borderLeft: '1px solid ' + (col.nocturne ? 'rgba(99,102,241,0.35)' : '#1E1E2E'),
                      textAlign: 'center',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: col.nocturne ? '#A5B4FC' : '#64708A',
                      fontWeight: col.nocturne ? 600 : 400,
                      background: col.nocturne ? 'rgba(99,102,241,0.07)' : 'transparent',
                    }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>

              {/* Data rows */}
              {COMPARE_ROWS.map((row, ri) => (
                <div
                  key={ri}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.9fr 1fr 1fr 1fr 1fr',
                    borderTop: ri === 0 ? 'none' : '1px solid #1E1E2E',
                  }}
                >
                  <div style={{ padding: '15px 22px', fontSize: 14, color: '#E2E8F0' }}>
                    {row.label}
                  </div>
                  {[row.otter, row.notion, row.turbo].map((val, ci) => (
                    <div
                      key={ci}
                      style={{
                        padding: '15px 10px',
                        borderLeft: '1px solid #1E1E2E',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        color: val ? '#64708A' : '#33324a',
                      }}
                    >
                      {val ? '✓' : '—'}
                    </div>
                  ))}
                  {/* Nocturne column — always ✓ */}
                  <div
                    style={{
                      padding: '15px 10px',
                      borderLeft: '1px solid rgba(99,102,241,0.35)',
                      background: 'rgba(99,102,241,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#818CF8',
                    }}
                  >
                    ✓
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
