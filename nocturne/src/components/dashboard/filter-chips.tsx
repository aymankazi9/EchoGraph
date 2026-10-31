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
  onClick,
}: {
  label: string
  selected: boolean
  variant: 'status' | 'input'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center px-3 py-1 text-caption border cursor-pointer transition-colors"
      style={{
        background: selected ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'var(--color-bg-subtle)',
        borderColor: selected ? 'color-mix(in srgb, var(--color-accent) 45%, transparent)' : 'var(--color-border-default)',
        color: selected ? 'var(--color-accent)' : 'var(--color-text-secondary)',
      }}
      onClick={onClick}
    >
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
            <span
              className="w-4 h-4 text-caption flex items-center justify-center font-medium leading-none"
              style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }}
            >
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
