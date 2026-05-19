'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-5 max-w-sm text-center">
        <AlertTriangle size={32} strokeWidth={1.25} className="text-amber-400" />
        <div className="flex flex-col gap-1.5">
          <p className="text-body font-medium text-text-primary">Something went wrong</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="text-caption text-text-tertiary font-mono">{error.message}</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="h-8 px-4 rounded-btn text-body-sm font-medium bg-teal-300 text-text-inverse hover:bg-teal-400 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/vault"
            className="h-8 px-4 rounded-btn text-body-sm font-medium bg-bg-subtle text-text-secondary hover:text-text-primary transition-colors flex items-center"
          >
            Go to vault
          </Link>
        </div>
      </div>
    </div>
  )
}
