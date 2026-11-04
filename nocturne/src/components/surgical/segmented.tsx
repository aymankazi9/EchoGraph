// THEME_SURGICAL.md §4 "Segmented (billing)" — the monthly/yearly style toggle.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: React.ReactNode }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, gap: 3, border: '1px solid rgba(255,255,255,0.1)' }}>
      {options.map((opt) => {
        const on = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            className="segmented-btn"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '0 12px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              letterSpacing: '0.12em',
              background: on ? '#EDEDED' : 'transparent',
              color: on ? '#0A0A0A' : '#9A9A9F',
              transition: 'background .2s, color .2s',
            }}
          >
            {opt.label}
          </button>
        )
      })}

      <style>{`
        .segmented-btn { height: 30px; }
        @media (max-width: 767px) {
          .segmented-btn { height: 44px; }
        }
      `}</style>
    </div>
  )
}
