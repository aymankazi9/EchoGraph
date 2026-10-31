// UI preference types shared by the server (layout fetch) and client (context).

export type Theme = 'surgical' | 'eclipse' | 'aurora' | 'legacy' | 'parchment' | 'light'

export interface UiPreferences {
  theme: Theme
  focus_mode: boolean
}

export const DEFAULT_PREFS: UiPreferences = {
  theme: 'surgical',
  focus_mode: false,
}

/** Merge a raw DB value (partial / empty object, or an old pre-Surgical preset) with the safe defaults. */
export function parseUiPrefs(raw: Record<string, unknown> | null | undefined): UiPreferences {
  const THEMES: Theme[] = ['surgical', 'eclipse', 'aurora', 'legacy', 'parchment', 'light']
  return {
    theme:      THEMES.includes(raw?.theme as Theme) ? (raw!.theme as Theme)       : DEFAULT_PREFS.theme,
    focus_mode: typeof raw?.focus_mode === 'boolean' ? raw!.focus_mode as boolean  : DEFAULT_PREFS.focus_mode,
  }
}
