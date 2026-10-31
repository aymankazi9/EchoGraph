// THEME_SURGICAL.md §4 "Key/value spec rows" — used by the privacy key-chain and similar
// label/value listings. A label starting with "↓" renders as a dim connector row (no border,
// tighter padding) rather than a full bordered row.
export function SpecRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  const arrow = label[0] === '↓'
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto',
        gap: 16,
        padding: arrow ? '8px 0 8px 16px' : '13px 0',
        borderTop: arrow ? 'none' : '1px solid rgba(255,255,255,0.1)',
        borderBottom: isLast ? '1px solid rgba(255,255,255,0.1)' : 'none',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          color: arrow ? '#76767B' : '#EDEDED',
          letterSpacing: '0.1em',
          fontSize: arrow ? 11 : 12,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          color: arrow ? '#76767B' : '#9A9A9F',
          fontSize: arrow ? 11 : 12,
        }}
      >
        {value}
      </span>
    </div>
  )
}
