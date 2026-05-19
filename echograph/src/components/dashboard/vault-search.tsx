'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useDashboardStore } from '@/store/dashboard-store'

interface Props {
  inputRef?: React.RefObject<HTMLInputElement | null>
}

export function VaultSearch({ inputRef: externalRef }: Props) {
  const searchQuery = useDashboardStore((s) => s.searchQuery)
  const setSearchQuery = useDashboardStore((s) => s.setSearchQuery)

  // Local state drives the visible input value immediately (responsive).
  // The store update is debounced 150ms.
  const [localValue, setLocalValue] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const internalRef = useRef<HTMLInputElement>(null)
  const ref = externalRef ?? internalRef

  // Sync when store is externally reset (e.g., clearFilters sets searchQuery '').
  useEffect(() => {
    if (searchQuery === '' && localValue !== '') {
      setLocalValue('')
    }
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setLocalValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearchQuery(value), 150)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (localValue !== '') {
        setLocalValue('')
        setSearchQuery('')
      } else {
        ref.current?.blur()
      }
    }
  }

  function clearSearch() {
    setLocalValue('')
    setSearchQuery('')
    ref.current?.focus()
  }

  return (
    <div className="relative w-full">
      <Search
        size={16}
        strokeWidth={1.5}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
      />
      <input
        ref={ref}
        id="vault-search-input"
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search sessions…"
        className={[
          'w-full h-9 pl-9 pr-8',
          'bg-bg-input border border-border-default rounded-input',
          'text-body text-text-primary placeholder:text-text-tertiary',
          'transition-colors duration-75',
          'focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-teal-300/40',
        ].join(' ')}
      />
      {localValue && (
        <button
          type="button"
          onClick={clearSearch}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}
