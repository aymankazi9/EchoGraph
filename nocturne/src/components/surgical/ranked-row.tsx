// THEME_SURGICAL.md §4 "Data rows / metric blocks" — the Red Zone ranked-term row:
// rank · term + confidence bar · mono value · mono zone label.
export function RankedRow({
  rank,
  term,
  confidence,
  zone,
}: {
  rank: string
  term: string
  confidence: string
  zone: 'RED' | 'LIKELY'
}) {
  const red = zone === 'RED'
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '44px minmax(0,1fr) 56px 72px',
        alignItems: 'center',
        padding: '10px 22px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#76767B' }}>{rank}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingRight: 16, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13.5,
            color: '#EDEDED',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {term}
        </span>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }}>
          <div
            style={{
              height: 1,
              width: `${parseFloat(confidence) * 100}%`,
              background: red ? '#FF3B30' : '#9A9A9F',
            }}
          />
        </div>
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: red ? '#FF3B30' : '#9A9A9F' }}>
        {confidence}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textAlign: 'right',
          color: red ? '#FF3B30' : '#76767B',
        }}
      >
        {zone}
      </span>
    </div>
  )
}
