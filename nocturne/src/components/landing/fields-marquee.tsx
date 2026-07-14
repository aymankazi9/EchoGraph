const FIELDS = [
  'Pre-med',
  'Medical school',
  'Nursing',
  'Pharmacology',
  'Engineering',
  'Computer Science',
  'Organic Chemistry',
  'Physics',
  'Biochemistry',
  'Law',
  'Graduate STEM',
  'PhD programs',
]

export function FieldsMarquee() {
  return (
    <section
      style={{
        borderTop: '1px solid #191827',
        borderBottom: '1px solid #191827',
        padding: '22px 0',
        background: 'rgba(17,17,24,0.4)',
        overflow: 'hidden',
      }}
    >
      <p
        style={{
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#5B6478',
          margin: '0 0 16px',
          textAlign: 'center',
        }}
      >
        Built for high-stakes fields
      </p>

      <div
        data-marquee=""
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {/* Left fade */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: 120,
            zIndex: 2,
            pointerEvents: 'none',
            background: 'linear-gradient(90deg, #0C0C13, transparent)',
          }}
        />
        {/* Right fade */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: 120,
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
            animation: 'noct-marquee 44s linear infinite',
          }}
        >
          {/* First copy */}
          <div style={{ display: 'flex', gap: 10, paddingRight: 10 }}>
            {FIELDS.map((field) => (
              <span
                key={field}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 16px',
                  borderRadius: 9999,
                  border: '1px solid #1E1E2E',
                  whiteSpace: 'nowrap',
                  fontSize: 14,
                  color: '#94A3B8',
                  transition: 'color .3s, border-color .3s',
                }}
              >
                {field}
              </span>
            ))}
          </div>
          {/* Duplicate for seamless loop */}
          <div aria-hidden="true" style={{ display: 'flex', gap: 10, paddingRight: 10 }}>
            {FIELDS.map((field) => (
              <span
                key={field + '-dup'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 16px',
                  borderRadius: 9999,
                  border: '1px solid #1E1E2E',
                  whiteSpace: 'nowrap',
                  fontSize: 14,
                  color: '#94A3B8',
                  transition: 'color .3s, border-color .3s',
                }}
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
