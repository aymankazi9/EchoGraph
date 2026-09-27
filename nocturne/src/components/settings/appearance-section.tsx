'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from '@/lib/theme/provider'
import { ACCENT_OPTIONS, type Theme, type AccentColor } from '@/lib/theme/types'
import { hasAccess, type Tier } from '@/lib/tiers/features'

const IS_BETA = process.env.NEXT_PUBLIC_BETA_MODE === 'true'

const THEMES: { value: Theme; label: string; description: string; requiredTier: Tier }[] = [
  {
    value: 'dusk',
    label: 'Dusk',
    description: 'Deep navy with a dusky-blue tone.',
    requiredTier: 'dusk',
  },
  {
    value: 'midnight',
    label: 'Midnight',
    description: 'Classic near-black. The default.',
    requiredTier: 'dusk',
  },
  {
    value: 'eclipse',
    label: 'Eclipse',
    description: 'High-contrast with warm gold accents.',
    requiredTier: 'midnight',
  },
]

interface Props {
  tier: Tier
}

function LockBadge() {
  return (
    <span className="ml-auto flex items-center gap-1 text-caption text-text-tertiary">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      Midnight+
    </span>
  )
}

export function AppearanceSection({ tier }: Props) {
  const { prefs, setPrefs } = useTheme()
  const canMidnight = hasAccess(tier, 'midnight')

  return (
    <div>
      <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-4">
        Appearance
      </p>

      {/* ── Theme picker ── */}
      <div className="flex flex-col gap-2 py-3 border-b border-border-subtle">
        <p className="text-body-sm text-text-secondary">Theme</p>
        <p className="text-caption text-text-tertiary mt-0.5">
          Controls the overall surface and text palette.
        </p>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {THEMES.map((t) => {
            const locked = !hasAccess(tier, t.requiredTier)
            const active = prefs.theme === t.value

            return (
              <button
                key={t.value}
                type="button"
                disabled={locked}
                onClick={() => !locked && setPrefs({ theme: t.value })}
                className={[
                  'relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
                  active
                    ? 'border-indigo-500/60 bg-indigo-500/10'
                    : locked
                    ? 'border-border-subtle bg-bg-subtle opacity-50 cursor-not-allowed'
                    : 'border-border-default bg-bg-card hover:border-border-strong',
                ].join(' ')}
              >
                {/* Swatch row */}
                <div className="flex gap-1 mb-1">
                  <ThemeSwatch theme={t.value} />
                </div>
                <span className={['text-body-sm font-medium', active ? 'text-indigo-300' : 'text-text-primary'].join(' ')}>
                  {t.label}
                </span>
                <span className="text-caption text-text-tertiary leading-snug">{t.description}</span>
                {locked && (
                  <span className="mt-1 flex items-center gap-1 text-caption text-text-tertiary">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Midnight+
                    {!IS_BETA && (
                      <a href="/billing" className="underline underline-offset-2 hover:text-text-secondary transition-colors" onClick={e => e.stopPropagation()}>
                        Upgrade
                      </a>
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Accent colour picker ── */}
      <div className={['flex flex-col gap-2 py-3 border-b border-border-subtle', !canMidnight ? 'opacity-60' : ''].join(' ')}>
        <div className="flex items-center">
          <div>
            <p className="text-body-sm text-text-secondary">Accent colour</p>
            <p className="text-caption text-text-tertiary mt-0.5">
              Changes interactive elements, highlights, and active indicators.
            </p>
          </div>
          {!canMidnight && <LockBadge />}
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {ACCENT_OPTIONS.map((a) => {
            const active = prefs.accent === a.value
            return (
              <button
                key={a.value}
                type="button"
                disabled={!canMidnight}
                onClick={() => canMidnight && setPrefs({ accent: a.value as AccentColor })}
                title={a.label}
                className={[
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-body-sm border transition-colors',
                  active
                    ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
                    : canMidnight
                    ? 'border-border-default bg-bg-subtle text-text-secondary hover:border-border-strong'
                    : 'border-border-subtle bg-bg-subtle text-text-tertiary cursor-not-allowed',
                ].join(' ')}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: a.swatch }}
                />
                {a.label}
              </button>
            )
          })}
        </div>
        {!canMidnight && (
          <p className="text-caption text-text-tertiary">
            Available on Midnight{!IS_BETA && (
              <>{' · '}<a href="/billing" className="text-text-secondary hover:text-text-primary transition-colors">Upgrade</a></>
            )}
          </p>
        )}
      </div>

      {/* ── Focus mode ── */}
      <div className={['flex items-start justify-between py-3', !canMidnight ? 'opacity-60' : ''].join(' ')}>
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <p className="text-body-sm text-text-secondary">Focus mode</p>
            {!canMidnight && <LockBadge />}
          </div>
          <p className="text-caption text-text-tertiary mt-0.5">
            Hides the sidebar nav in Lecture and Study tabs, giving your content more room.
          </p>
          {!canMidnight && (
            <p className="text-caption text-text-tertiary mt-1">
              Available on Midnight{!IS_BETA && (
                <>{' · '}<a href="/billing" className="text-text-secondary hover:text-text-primary transition-colors">Upgrade</a></>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={prefs.focus_mode}
          disabled={!canMidnight}
          onClick={() => canMidnight && setPrefs({ focus_mode: !prefs.focus_mode })}
          className={[
            'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
            prefs.focus_mode ? 'bg-indigo-500' : 'bg-bg-subtle',
            !canMidnight ? 'cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          <span
            className={[
              'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200',
              prefs.focus_mode ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>
    </div>
  )
}

// ── Theme swatch preview ──────────────────────────────────────────────────────
// Three small colour dots representing surface / border / accent for each theme.

const THEME_SWATCHES: Record<Theme, [string, string, string]> = {
  dusk:     ['#0F1422', '#1E2D42', '#6366F1'],
  midnight: ['#09090F', '#1A1A2E', '#6366F1'],
  eclipse:  ['#0A0A0F', '#1C1C28', '#F59E0B'],
}

function ThemeSwatch({ theme }: { theme: Theme }) {
  const [bg, border, accent] = THEME_SWATCHES[theme]
  return (
    <div
      className="w-full h-7 rounded flex items-center justify-center gap-1"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: border }} />
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: border }} />
    </div>
  )
}
