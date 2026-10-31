'use client'

export function TryAgainButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-5 h-9 px-5 rounded-btn text-body font-medium text-text-inverse transition-colors"
      style={{ background: 'var(--color-accent)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-accent)' }}
    >
      Try again
    </button>
  )
}
