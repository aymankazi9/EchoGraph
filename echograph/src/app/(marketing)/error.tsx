'use client'

export default function MarketingError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-body font-medium text-text-primary">Something went wrong</p>
        <button
          onClick={reset}
          className="h-8 px-4 rounded-btn text-body-sm font-medium bg-teal-300 text-text-inverse hover:bg-teal-400 transition-colors"
        >
          Reload page
        </button>
      </div>
    </div>
  )
}
