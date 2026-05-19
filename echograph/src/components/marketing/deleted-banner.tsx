'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

export function DeletedBanner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (searchParams.get('deleted') === 'true') {
      setShow(true)
      // Clean the param from the URL immediately
      router.replace('/', { scroll: false })
    }
  }, [searchParams, router])

  if (!show) return null

  return (
    <div className="w-full border-b border-border-subtle bg-bg-elevated px-6 py-3 flex items-center justify-between">
      <p className="text-body-sm text-text-secondary">
        Your account has been deleted. All encrypted files are gone.
      </p>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        className="ml-4 text-text-tertiary hover:text-text-secondary transition-colors shrink-0"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}
