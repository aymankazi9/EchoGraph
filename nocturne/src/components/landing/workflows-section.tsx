const STEPS = [
  {
    n: '01',
    title: 'Ingest raw sources',
    desc: 'Lecture audio, slide decks, and an optional study guide. No tagging, no cleanup, no templates to fill in.',
    meta: '.m4a .mp3 .wav · .pdf .pptx · .docx .apkg',
  },
  {
    n: '02',
    title: 'Align on-device',
    desc: 'Whisper transcribes locally. Every word is synced to the slide on screen, so Nocturne knows how long the professor dwelled and how often each term came back.',
    meta: 'word-level timestamps · silence-gap slide sync',
  },
  {
    n: '03',
    title: 'Extract the Red Zone',
    desc: 'Each term gets a confidence score from dwell time, repetition, and study-guide alignment. The top tier is your Red Zone, ready to export as tagged Anki cards.',
    meta: 'red_zone.json · export → .apkg',
  },
]

export function WorkflowsSection() {
  return (
    <section
      id="workflows"
      style={{
        position: 'relative',
        scrollMarginTop: 64,
        padding: 'clamp(88px,10vw,140px) clamp(20px,4vw,40px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        data-split
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,0.9fr) minmax(0,1.1fr)',
          gap: 'clamp(40px,6vw,100px)',
          alignItems: 'start',
        }}
      >
        <div data-sticky className="wf-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', color: '#FF3B30' }}>PATH A</span>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontStretch: '82%',
              fontWeight: 600,
              fontSize: 'clamp(36px,4.6vw,64px)',
              lineHeight: 0.98,
              letterSpacing: '-0.035em',
            }}
          >
            The Zero-Effort Pipeline.
          </h2>
          <p style={{ margin: 0, maxWidth: 420, fontSize: 16, color: '#9A9A9F', textWrap: 'pretty' }}>
            Drop in what you already have. Nocturne transcribes, aligns, and ranks without a
            single prompt, then hands you the Red Zone.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              paddingTop: 22,
              marginTop: 6,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              maxWidth: 420,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(40px,4vw,56px)', lineHeight: 1.05, letterSpacing: '-0.02em', color: '#FF3B30' }}>
              1m 36s
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: '#76767B' }}>
              48-MIN LECTURE → RANKED RED ZONE
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              style={{
                display: 'grid',
                gridTemplateColumns: 'clamp(84px,10vw,140px) minmax(0,1fr)',
                gap: 24,
                padding: '40px 0',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                borderBottom: i === STEPS.length - 1 ? '1px solid rgba(255,255,255,0.08)' : undefined,
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(28px,3vw,40px)', letterSpacing: '0.24em', color: '#FF3B30', lineHeight: 1 }}>
                {s.n}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: '-0.015em' }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 15, color: '#9A9A9F', maxWidth: 520, textWrap: 'pretty' }}>{s.desc}</p>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#76767B' }}>{s.meta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .wf-sticky { position: sticky; top: 120px; }
        @media (max-width: 767px) {
          .wf-sticky { position: static; }
        }
      `}</style>
    </section>
  )
}
