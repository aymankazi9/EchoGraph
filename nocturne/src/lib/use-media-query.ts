'use client'

import { useCallback, useSyncExternalStore } from 'react'

// No existing breakpoint-detection convention anywhere in this codebase (the
// only prior matchMedia usages are prefers-reduced-motion and PWA display-mode
// checks) — this is the first general-purpose one. useSyncExternalStore is the
// correct primitive for subscribing to a browser API like this (vs. setState
// inside an effect, which the React Compiler flags as cascading-render risk).
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((callback: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', callback)
    return () => mql.removeEventListener('change', callback)
  }, [query])

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // server snapshot
  )
}

/** Bottom-sheet-vs-side-drawer breakpoint for the Map tab's node drawer. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 640px)')
}
