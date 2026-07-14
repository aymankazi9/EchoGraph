// Signal bar indices and heights (from the DC script)
const SIG_IDX: Record<number, number> = { 16: 96, 33: 80, 52: 100, 69: 86 }
const TOTAL_BARS = 80

// Pre-compute sinusoidal heights for noise bars so they're stable across renders
function getNoiseHeight(i: number): number {
  return 8 + (Math.sin(i * 1.7) * 0.5 + 0.5) * 22
}

export function ProblemSection() {
  return (
    <section
      id="problem"
      style={{
        scrollMarginTop: 80,
        padding: 'clamp(72px,9vw,120px) 24px',
        borderTop: '1px solid #191827',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <div data-reveal="" style={{ textAlign: 'center', marginBottom: 48 }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#FB7185',
              margin: '0 0 14px',
            }}
          >
            The problem
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
            A lecture is mostly noise.
          </h2>
          <p
            style={{
              fontSize: 'clamp(16px,2vw,18px)',
              lineHeight: 1.7,
              color: '#94A3B8',
              maxWidth: 600,
              margin: '20px auto 0',
            }}
          >
            Fifty minutes of talking. Three slides that actually matter. Somewhere in the transcript are the{' '}
            <span style={{ color: '#FB7185', fontWeight: 500 }}>
              four phrases that carry the exam
            </span>
            {' '}— and you&apos;re meant to find them by re-reading everything.
          </p>
        </div>

        {/* Bar chart */}
        <div
          data-reveal=""
          data-delay="120"
          style={{
            position: 'relative',
            border: '1px solid #1E1E2E',
            borderRadius: 14,
            background: '#111118',
            padding: '30px 30px 26px',
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Radial glow */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(620px circle at 70% -25%, rgba(244,63,94,0.06), transparent 60%)',
              pointerEvents: 'none',
            }}
          />

          {/* Chart header: label + legend */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 22,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#5B6478',
                margin: 0,
              }}
            >
              Professor emphasis · one lecture
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 12,
                  color: '#5B6478',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: '#23222F',
                  }}
                />
                Talking
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 12,
                  color: '#94A3B8',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: 'linear-gradient(#FB7185,#F43F5E)',
                    boxShadow: '0 0 8px rgba(244,63,94,0.6)',
                  }}
                />
                Tested
              </span>
            </div>
          </div>

          {/* Bars */}
          <div style={{ position: 'relative', height: 160 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 3,
                height: '100%',
              }}
            >
              {Array.from({ length: TOTAL_BARS }, (_, i) => {
                const sig = SIG_IDX[i]
                if (sig !== undefined) {
                  return (
                    <div
                      key={i}
                      style={{
                        flex: '1 1 0',
                        minWidth: 0,
                        height: `${sig}%`,
                        borderRadius: '3px 3px 0 0',
                        background: 'linear-gradient(#FB7185,#F43F5E)',
                        boxShadow: '0 0 14px rgba(244,63,94,0.6)',
                        animation: 'noct-barpulse 2.6s ease-in-out infinite',
                        animationDelay: `${((i % 6) * 0.18).toFixed(2)}s`,
                        position: 'relative',
                        zIndex: 1,
                      }}
                    />
                  )
                }
                const h = getNoiseHeight(i)
                return (
                  <div
                    key={i}
                    style={{
                      flex: '1 1 0',
                      minWidth: 0,
                      height: `${h.toFixed(1)}%`,
                      borderRadius: '3px 3px 0 0',
                      background: '#23222F',
                    }}
                  />
                )
              })}
            </div>
            {/* Scanning overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '-13%',
                width: 90,
                background: 'linear-gradient(90deg, transparent, rgba(129,140,248,0.12), transparent)',
                animation: 'noct-scanfield 5.5s linear infinite',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Timestamps */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: '#3F485C',
            }}
          >
            <span>00:00</span>
            <span>50:00</span>
          </div>

          {/* Bottom stat row */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              marginTop: 22,
              paddingTop: 22,
              borderTop: '1px solid #1E1E2E',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: '#FB7185',
                }}
              >
                4
              </span>
              <span style={{ fontSize: 14, color: '#E2E8F0' }}>phrases decide the grade</span>
            </div>
            <span style={{ fontSize: 13, color: '#5B6478' }}>
              ≈ 8,400 words spoken · the rest is noise
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
