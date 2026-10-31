import type { ReactNode } from 'react'

// THEME_SURGICAL.md §4 "Data rows / metric blocks" — mono eyebrow above a big mono value.
export function MetricBlock({
  label,
  value,
  suffix,
  valueColor = '#EDEDED',
}: {
  label: string
  value: ReactNode
  suffix?: ReactNode
  valueColor?: string
}) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', color: '#76767B' }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 44,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: valueColor,
          marginTop: 6,
        }}
      >
        {value}
        {suffix != null && <span style={{ fontSize: 16, color: '#76767B' }}> {suffix}</span>}
      </div>
    </div>
  )
}
