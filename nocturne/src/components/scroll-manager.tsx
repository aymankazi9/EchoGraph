'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function ScrollManager() {
  const pathname = usePathname()

  useEffect(() => {
    // Re-enable smooth scroll after the route has settled
    const t = setTimeout(() => {
      document.documentElement.setAttribute('data-sb', 'smooth')
    }, 80)

    return () => {
      // Disable before the next route transition so navigation jumps instantly
      clearTimeout(t)
      document.documentElement.removeAttribute('data-sb')
    }
  }, [pathname])

  return null
}
