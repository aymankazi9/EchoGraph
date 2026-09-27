// UI preference types shared by the server (layout fetch) and client (context).

export type Theme = 'dusk' | 'midnight' | 'eclipse'

export type AccentColor = 'indigo' | 'violet' | 'sky' | 'teal' | 'amber' | 'rose'

export interface UiPreferences {
  theme: Theme
  accent: AccentColor
  focus_mode: boolean
}

export const DEFAULT_PREFS: UiPreferences = {
  theme: 'midnight',
  accent: 'indigo',
  focus_mode: false,
}

/** Merge a raw DB value (partial / empty object) with the safe defaults. */
export function parseUiPrefs(raw: Record<string, unknown> | null | undefined): UiPreferences {
  const THEMES:   Theme[]       = ['dusk', 'midnight', 'eclipse']
  const ACCENTS:  AccentColor[] = ['indigo', 'violet', 'sky', 'teal', 'amber', 'rose']
  return {
    theme:      THEMES.includes(raw?.theme as Theme)       ? (raw!.theme as Theme)            : DEFAULT_PREFS.theme,
    accent:     ACCENTS.includes(raw?.accent as AccentColor) ? (raw!.accent as AccentColor)  : DEFAULT_PREFS.accent,
    focus_mode: typeof raw?.focus_mode === 'boolean'        ? raw!.focus_mode as boolean      : DEFAULT_PREFS.focus_mode,
  }
}

// Accent display names + preview swatches for the settings UI.
export const ACCENT_OPTIONS: { value: AccentColor; label: string; swatch: string }[] = [
  { value: 'indigo', label: 'Indigo',  swatch: '#6366F1' },
  { value: 'violet', label: 'Violet',  swatch: '#8B5CF6' },
  { value: 'sky',    label: 'Sky',     swatch: '#0EA5E9' },
  { value: 'teal',   label: 'Teal',    swatch: '#14B8A6' },
  { value: 'amber',  label: 'Amber',   swatch: '#F59E0B' },
  { value: 'rose',   label: 'Rose',    swatch: '#F43F5E' },
]
