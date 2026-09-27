'use client'

// ThemeProvider — pure context wrapper for the authenticated app shell.
//
// Provides prefs + setPrefs to descendant components.  The actual data-theme /
// data-accent / data-focus-mode attributes are applied by AppShell (which
// consumes this context) so the CSS custom property overrides in globals.css
// scope correctly without any extra wrapper DOM element.

import { createContext, useContext, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { UiPreferences } from './types'

interface ThemeContextValue {
  prefs: UiPreferences
  setPrefs: (patch: Partial<UiPreferences>) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

interface Props {
  userId: string
  initialPrefs: UiPreferences
  children: React.ReactNode
}

export function ThemeProvider({ userId, initialPrefs, children }: Props) {
  const [prefs, setPrefsState] = useState<UiPreferences>(initialPrefs)

  const setPrefs = useCallback(async (patch: Partial<UiPreferences>) => {
    const next = { ...prefs, ...patch }
    setPrefsState(next)
    // Persist asynchronously — UI feedback is instant.
    const supabase = createClient()
    await supabase
      .from('users')
      .update({ ui_preferences: next })
      .eq('id', userId)
  }, [prefs, userId])

  return (
    <ThemeContext.Provider value={{ prefs, setPrefs }}>
      {children}
    </ThemeContext.Provider>
  )
}
