'use client'

import { SearchX } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboard-store'

export function EmptyFilteredState() {
  const searchQuery = useDashboardStore((s) => s.searchQuery)
  const statusFilter = useDashboardStore((s) => s.statusFilter)
  const inputFilters = useDashboardStore((s) => s.inputFilters)
  const clearFilters = useDashboardStore((s) => s.clearFilters)

  const hasSearch = searchQuery.trim() !== ''
  const hasFilters = statusFilter !== 'all' || inputFilters.length > 0

  let body: React.ReactNode
  if (hasSearch && hasFilters) {
    body = (
      <>
        No sessions match{' '}
        <span className="text-text-primary">&ldquo;{searchQuery}&rdquo;</span>{' '}
        with the selected filters.
      </>
    )
  } else if (hasSearch) {
    body = (
      <>
        No sessions found for{' '}
        <span className="text-text-primary">&ldquo;{searchQuery}&rdquo;</span>.
      </>
    )
  } else {
    body = 'No sessions match the selected filters.'
  }

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <SearchX size={32} strokeWidth={1.5} className="text-text-tertiary" />
      <div className="flex flex-col gap-1.5">
        <p className="text-body font-medium text-text-primary">No sessions match</p>
        <p className="text-body-sm text-text-secondary max-w-xs">{body}</p>
      </div>
      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-body-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
