'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDashboardStore, type SortOrder } from '@/store/dashboard-store'

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest',       label: 'Newest first' },
  { value: 'oldest',       label: 'Oldest first' },
  { value: 'most_red_zone', label: 'Most Red Zone' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'largest',      label: 'Largest first' },
]

export function SortControl() {
  const sortOrder = useDashboardStore((s) => s.sortOrder)
  const setSortOrder = useDashboardStore((s) => s.setSortOrder)

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-caption text-text-tertiary whitespace-nowrap">Sort</span>
      <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
        <SelectTrigger className="h-auto py-1 px-2 bg-transparent border-0 shadow-none text-body-sm text-text-secondary hover:text-text-primary hover:bg-bg-subtle rounded-btn transition-colors w-auto gap-1 focus:ring-0 focus:ring-offset-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-bg-elevated border border-border-default rounded-card shadow-md">
          {SORT_OPTIONS.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className="text-body-sm text-text-secondary cursor-pointer hover:text-text-primary focus:bg-bg-subtle focus:text-text-primary"
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
