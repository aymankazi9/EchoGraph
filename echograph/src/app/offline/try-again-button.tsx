'use client'

export function TryAgainButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-5 h-9 px-5 rounded-btn text-body font-medium bg-teal-300 text-text-inverse hover:bg-teal-400 transition-colors"
    >
      Try again
    </button>
  )
}
