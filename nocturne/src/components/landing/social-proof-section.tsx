const SCHOOL_PALETTE = ['#818CF8', '#A78BFA', '#F472B6', '#38BDF8', '#2DD4BF', '#FBBF24']

const SCHOOLS = [
  { name: 'UC Berkeley', abbr: 'UCB' },
  { name: 'UCLA', abbr: 'UCLA' },
  { name: 'Stanford', abbr: 'SU' },
  { name: 'USC', abbr: 'USC' },
  { name: 'UC San Diego', abbr: 'UCSD' },
  { name: 'Caltech', abbr: 'CIT' },
  { name: 'UC Davis', abbr: 'UCD' },
  { name: 'UC Irvine', abbr: 'UCI' },
  { name: 'Cal Poly SLO', abbr: 'CP' },
  { name: 'San Diego State', abbr: 'SDSU' },
  { name: 'San José State', abbr: 'SJSU' },
  { name: 'UC Santa Barbara', abbr: 'UCSB' },
].map((s, i) => ({ ...s, color: SCHOOL_PALETTE[i % SCHOOL_PALETTE.length] }))

const REVIEWS = [
  {
    initials: 'MR',
    name: 'Maya R.',
    sub: 'Biochemistry · UC San Diego',
    body: '"Nocturne flagged three terms my professor kept circling back to — all three were on the midterm. I stopped re-reading everything."',
  },
  {
    initials: 'DK',
    name: 'Devin K.',
    sub: 'Mechanical Engineering · Cal Poly SLO',
    body: '"I used to transcribe lectures and never look back. The Red Zone ranking is the part Otter never gave me — it tells me where to actually spend my time."',
  },
  {
    initials: 'PS',
    name: 'Priya S.',
    sub: 'Pre-Med · UCLA',
    body: '"The fact that my audio never leaves my laptop is what sold me. The exam-likelihood scores are what kept me through finals."',
  },
]

function SchoolItem({ school }: { school: (typeof SCHOOLS)[0] }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 11,
        padding: '8px 18px 8px 9px',
        borderRadius: 9999,
        border: '1px solid #1E1E2E',
        background: '#0F0F17',
        whiteSpace: 'nowrap',
        transition: 'border-color .3s',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 28,
          padding: '0 8px',
          minWidth: 28,
          borderRadius: 7,
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.02em',
          color: school.color,
          background: school.color + '1A',
          border: '1px solid ' + school.color + '40',
          flexShrink: 0,
        }}
      >
        {school.abbr}
      </span>
      <span style={{ fontSize: 14, color: '#94A3B8' }}>{school.name}</span>
    </span>
  )
}

export function SocialProofSection() {
  return (
    <section
      id="loved"
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
              color: '#818CF8',
              margin: '0 0 14px',
            }}
          >
            Loved by students
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
            Built in the library, tested before exams.
          </h2>
          <p style={{ fontSize: 16, color: '#94A3B8', maxWidth: 480, margin: '16px auto 0' }}>
            From the beta cohort using Nocturne to walk into midterms already knowing what to study.
          </p>
        </div>

        {/* Stats */}
        <div
          data-reveal=""
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 1,
            background: '#1E1E2E',
            border: '1px solid #1E1E2E',
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 42,
          }}
        >
          {/* Lectures processed */}
          <div style={{ flex: '1 1 180px', minWidth: 150, textAlign: 'center', padding: '30px 18px', background: '#111118' }}>
            <div style={{ fontSize: 'clamp(28px,3.4vw,38px)', fontWeight: 600, letterSpacing: '-0.02em', color: '#E2E8F0' }}>
              14,200<span style={{ color: '#5B6478' }}>+</span>
            </div>
            <div style={{ fontSize: 13, color: '#5B6478', marginTop: 6 }}>Lectures processed</div>
          </div>
          {/* Students in the beta */}
          <div style={{ flex: '1 1 180px', minWidth: 150, textAlign: 'center', padding: '30px 18px', background: '#111118' }}>
            <div style={{ fontSize: 'clamp(28px,3.4vw,38px)', fontWeight: 600, letterSpacing: '-0.02em', color: '#E2E8F0' }}>
              3,800<span style={{ color: '#5B6478' }}>+</span>
            </div>
            <div style={{ fontSize: 13, color: '#5B6478', marginTop: 6 }}>Students in the beta</div>
          </div>
          {/* Average beta rating */}
          <div style={{ flex: '1 1 180px', minWidth: 150, textAlign: 'center', padding: '30px 18px', background: '#111118' }}>
            <div style={{ fontSize: 'clamp(28px,3.4vw,38px)', fontWeight: 600, letterSpacing: '-0.02em', color: '#E2E8F0' }}>
              4.8<span style={{ fontSize: 18, color: '#5B6478' }}>/5</span>
            </div>
            <div style={{ fontSize: 13, color: '#5B6478', marginTop: 6 }}>Average beta rating</div>
          </div>
          {/* Felt more exam-ready */}
          <div style={{ flex: '1 1 180px', minWidth: 150, textAlign: 'center', padding: '30px 18px', background: '#111118' }}>
            <div style={{ fontSize: 'clamp(28px,3.4vw,38px)', fontWeight: 600, letterSpacing: '-0.02em', color: '#818CF8' }}>
              92<span style={{ fontSize: 18 }}>%</span>
            </div>
            <div style={{ fontSize: 13, color: '#5B6478', marginTop: 6 }}>Felt more exam-ready</div>
          </div>
        </div>

        {/* Testimonials */}
        <div
          data-reveal=""
          data-cards-3=""
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 18,
          }}
        >
          {REVIEWS.map((r) => (
            <div
              key={r.initials}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                padding: '26px 24px',
                borderRadius: 12,
                background: '#111118',
                border: '1px solid #1E1E2E',
              }}
            >
              <div style={{ display: 'flex', gap: 3, color: '#818CF8', fontSize: 13, letterSpacing: 1 }}>
                ★★★★★
              </div>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: '#CBD5E1',
                  margin: 0,
                  flex: 1,
                }}
              >
                {r.body}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#A5B4FC',
                    flexShrink: 0,
                  }}
                >
                  {r.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: '#E2E8F0' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#5B6478' }}>{r.sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Schools marquee */}
        <div data-reveal="" style={{ marginTop: 52 }}>
          <p
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#5B6478',
              margin: '0 0 22px',
              textAlign: 'center',
            }}
          >
            Used by students across the UC, CSU &amp; California private systems
          </p>
          <div data-marquee="" style={{ position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: 90,
                zIndex: 2,
                pointerEvents: 'none',
                background: 'linear-gradient(90deg, #0C0C13, transparent)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: 90,
                zIndex: 2,
                pointerEvents: 'none',
                background: 'linear-gradient(-90deg, #0C0C13, transparent)',
              }}
            />
            <div
              data-marquee-track=""
              style={{
                display: 'flex',
                width: 'max-content',
                animation: 'noct-marquee 52s linear infinite',
              }}
            >
              <div style={{ display: 'flex', gap: 12, paddingRight: 12 }}>
                {SCHOOLS.map((s) => (
                  <SchoolItem key={s.name} school={s} />
                ))}
              </div>
              <div aria-hidden="true" style={{ display: 'flex', gap: 12, paddingRight: 12 }}>
                {SCHOOLS.map((s) => (
                  <SchoolItem key={s.name + '-dup'} school={s} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
