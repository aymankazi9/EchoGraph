'use client'

import { useDashboardStore, type StatusFilter, type InputFilter } from '@/store/dashboard-store'

// ─── Status filter config ─────────────────────────────────────────────────────

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'ready',        label: 'Ready' },
  { value: 'processing',   label: 'Processing' },
  { value: 'transcribing', label: 'Transcribing' },
  { value: 'synced',       label: 'Synced' },
]

const INPUT_CHIPS: { value: InputFilter; label: string }[] = [
  { value: 'has_slides', label: 'Has slides' },
  { value: 'has_audio',  label: 'Has audio' },
  { value: 'has_guide',  label: 'Has guide' },
]

// ─── Chip component ───────────────────────────────────────────────────────────

function Chip({
  label,
  selected,
  variant,
  onClick,
}: {
  label: string
  selected: boolean
  variant: 'status' | 'input'
  onClick: () => void
}) {
  const base = 'inline-flex items-center px-3 py-1 rounded-full text-caption border cursor-pointer transition-colors'
  const unselected = 'bg-bg-subtle border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary'
  const selectedStatus = 'bg-teal-500/20 border-teal-300/50 text-teal-200'
  const selectedInput = 'bg-purple-500/20 border-purple-300/50 text-purple-200'

  const cls = [
    base,
    selected
      ? variant === 'status' ? selectedStatus : selectedInput
      : unselected,
  ].join(' ')

  return (
    <button type="button" className={cls} onClick={onClick}>
      {label}
    </button>
  )
}

// ─── FilterChips ──────────────────────────────────────────────────────────────

interface Props {
  /** Rendered to the right of the chips (sort control slot). */
  sortSlot?: React.ReactNode
}

export function FilterChips({ sortSlot }: Props) {
  const statusFilter = useDashboardStore((s) => s.statusFilter)
  const inputFilters = useDashboardStore((s) => s.inputFilters)
  const setStatusFilter = useDashboardStore((s) => s.setStatusFilter)
  const toggleInputFilter = useDashboardStore((s) => s.toggleInputFilter)
  const clearFilters = useDashboardStore((s) => s.clearFilters)

  const activeCount =
    (statusFilter !== 'all' ? 1 : 0) + inputFilters.length

  return (
    <div className="flex items-center justify-between gap-3">
      {/* Left: label + chips */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {/* "Filters" label + count badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-caption text-text-tertiary">Filters</span>
          {activeCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-teal-300 text-text-inverse text-caption flex items-center justify-center font-medium leading-none">
              {activeCount}
            </span>
          )}
        </div>

        {/* Divider before chips */}
        <div className="w-px h-4 bg-border-default shrink-0" />

        {/* Status chips */}
        {STATUS_CHIPS.map((c) => (
          <Chip
            key={c.value}
            label={c.label}
            selected={statusFilter === c.value}
            variant="status"
            onClick={() => setStatusFilter(c.value)}
          />
        ))}

        {/* Divider between chip groups */}
        <div className="w-px h-4 bg-border-default shrink-0" />

        {/* Input filter chips */}
        {INPUT_CHIPS.map((c) => (
          <Chip
            key={c.value}
            label={c.label}
            selected={inputFilters.includes(c.value)}
            variant="input"
            onClick={() => toggleInputFilter(c.value)}
          />
        ))}

        {/* Clear all link */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-caption text-text-tertiary hover:text-text-secondary transition-colors ml-1"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Right: sort slot */}
      {sortSlot && <div className="shrink-0">{sortSlot}</div>}
    </div>
  )
}
