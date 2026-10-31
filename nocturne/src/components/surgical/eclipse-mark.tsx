import { useId } from 'react'

// The "red lunar eclipse" brand mark — THEME_SURGICAL.md §7. Replaces the indigo→violet
// gradient tile everywhere in the surgical theme.
export function EclipseMark({ size = 24, className }: { size?: number; className?: string }) {
  const maskId = useId()
  const ring = size >= 32 ? 1 : 1.25
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <mask id={maskId}>
          <rect width="24" height="24" fill="#FFFFFF" />
          <circle cx="11" cy="13" r="10.7" fill="#000000" />
        </mask>
      </defs>
      <circle cx="13.3" cy="10.7" r="9.5" fill="#FF3B30" mask={`url(#${maskId})`} />
      <circle cx="11" cy="13" r="9.4" stroke="#EDEDED" strokeWidth={ring} />
    </svg>
  )
}
