// THEME_SURGICAL.md §4 "Benchmark / comparison table" — mono comparison grid with the last
// column (this product) highlighted in crimson.
export function BenchmarkTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: { id: string; label: string; values: string[] }[]
}) {
  const templateCols = `56px minmax(0,2.2fr) repeat(${columns.length},minmax(0,1fr))`
  return (
    <div style={{ minWidth: 680, fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: templateCols,
          borderBottom: '1px solid rgba(255,255,255,0.14)',
          fontSize: 10.5,
          letterSpacing: '0.14em',
        }}
      >
        <span style={{ padding: '14px 0 14px 18px', color: '#76767B' }}>ID</span>
        <span style={{ padding: '14px 12px', color: '#76767B' }}>CAPABILITY</span>
        {columns.map((c, i) => {
          const last = i === columns.length - 1
          return (
            <span
              key={c}
              style={{
                padding: '14px 12px',
                color: last ? '#FF3B30' : '#76767B',
                borderLeft: last ? '1px solid rgba(255,59,48,0.4)' : undefined,
                background: last ? 'rgba(255,59,48,0.05)' : undefined,
              }}
            >
              {c}
            </span>
          )
        })}
      </div>
      {rows.map((r, i) => (
        <div
          key={r.id}
          style={{
            display: 'grid',
            gridTemplateColumns: templateCols,
            alignItems: 'center',
            background: i % 2 ? 'rgba(255,255,255,0.025)' : 'transparent',
            borderTop: i ? '1px solid rgba(255,255,255,0.05)' : 'none',
          }}
        >
          <span style={{ padding: '12px 0 12px 18px', color: '#5E5E62' }}>{r.id}</span>
          <span style={{ padding: 12, fontFamily: 'var(--font-sans)', fontSize: 14, color: '#CFCFD2' }}>
            {r.label}
          </span>
          {r.values.map((v, i2) => {
            const last = i2 === r.values.length - 1
            return (
              <span
                key={i2}
                style={{
                  padding: 12,
                  color: last ? '#EDEDED' : '#76767B',
                  borderLeft: last ? '1px solid rgba(255,59,48,0.4)' : undefined,
                  background: last ? 'rgba(255,59,48,0.05)' : undefined,
                }}
              >
                {v}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
