import { SearchX } from 'lucide-react'
import Link from 'next/link'

export default function AppNotFound() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-5 max-w-sm text-center">
        <SearchX size={32} strokeWidth={1.25} className="text-text-tertiary" />
        <div className="flex flex-col gap-1.5">
          <p className="text-body font-medium text-text-primary">Page not found</p>
          <p className="text-body-sm text-text-secondary">
            This page doesn't exist or you don't have access to it.
          </p>
        </div>
        <Link
          href="/vault"
          className="h-8 px-4 rounded-btn text-body-sm font-medium bg-teal-300 text-text-inverse hover:bg-teal-400 transition-colors"
        >
          Back to vault
        </Link>
      </div>
    </div>
  )
}
