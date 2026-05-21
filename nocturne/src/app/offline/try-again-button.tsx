'use client'

export function TryAgainButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-5 h-9 px-5 rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
    >
      Try again
    </button>
  )
}
