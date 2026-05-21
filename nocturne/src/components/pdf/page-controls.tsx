'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'

interface Props {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function PageControls({ currentPage, totalPages, onPageChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleInputCommit() {
    const val = parseInt(inputRef.current?.value ?? '', 10)
    if (!isNaN(val) && val >= 1 && val <= totalPages) {
      onPageChange(val)
    } else if (inputRef.current) {
      // Reset to current page on invalid input
      inputRef.current.value = String(currentPage)
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 h-10 border-t border-border-default shrink-0 bg-bg-elevated px-4">
      {/* Prev */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="w-8 h-8 flex items-center justify-center rounded-btn text-text-secondary hover:bg-bg-subtle hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
      </button>

      {/* Page number input */}
      <div className="flex items-center gap-1.5 text-label text-text-secondary">
        <input
          ref={inputRef}
          type="number"
          min={1}
          max={totalPages}
          defaultValue={currentPage}
          key={currentPage} // reset uncontrolled input on external navigation
          onBlur={handleInputCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
          }}
          className="w-12 h-7 text-center text-label text-text-primary bg-bg-input border border-border-default rounded-input focus:border-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          aria-label="Current page"
        />
        <span>/</span>
        <span>{totalPages}</span>
      </div>

      {/* Next */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-btn text-text-secondary hover:bg-bg-subtle hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Next page"
      >
        <ChevronRight size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}
