import type { CSSProperties, ReactNode } from 'react'

// THEME_SURGICAL.md §2 — the Geist Mono uppercase eyebrow/label pattern used for section
// eyebrows, table headers, and metadata throughout the surgical theme.
export function MonoLabel({
  children,
  color = '#76767B',
  size = 11,
  tracking = '0.16em',
  style,
}: {
  children: ReactNode
  color?: string
  size?: number
  tracking?: string
  style?: CSSProperties
}) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: size, letterSpacing: tracking, color, ...style }}>
      {children}
    </span>
  )
}
