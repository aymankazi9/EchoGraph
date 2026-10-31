'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// THEME_SURGICAL.md §8 — "3 AM Deep Focus Mode". Toggled by clicking the EclipseMark.
// Not persisted: a refresh (or navigating away) always returns to standard.
export function useFocusMode() {
  const [focus, setFocus] = useState(false)
  const [toastOn, setToastOn] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const toggleFocus = useCallback(() => {
    setFocus((prev) => {
      const next = !prev
      document.documentElement.setAttribute('data-focus', next ? 'on' : 'off')
      clearTimeout(timerRef.current)
      if (next) {
        setToastOn(true)
        timerRef.current = setTimeout(() => setToastOn(false), 4200)
      } else {
        setToastOn(false)
      }
      return next
    })
  }, [])

  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
      document.documentElement.removeAttribute('data-focus')
    },
    [],
  )

  return { focus, toastOn, toggleFocus }
}
