const SPECS = ['100% LOCAL EXECUTION', 'ZERO-KNOWLEDGE PRIVACY', 'WASM / WHISPER ENGINE', 'OFFLINE FIRST']

export function SpecBar() {
  return (
    <section style={{ position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div data-spec className="spec-grid" style={{ maxWidth: 1280, margin: '0 auto', display: 'grid' }}>
        {SPECS.map((label, i) => (
          <div
            key={label}
            style={{
              padding: '26px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              letterSpacing: '0.14em',
              color: '#CFCFD2',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              borderRight: i === SPECS.length - 1 ? '1px solid rgba(255,255,255,0.08)' : undefined,
            }}
          >
            <span style={{ width: 5, height: 5, background: '#FF3B30', flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      <style>{`
        .spec-grid { grid-template-columns: repeat(4,minmax(0,1fr)); }
        @media (max-width: 767px) {
          .spec-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
        }
      `}</style>
    </section>
  )
}
