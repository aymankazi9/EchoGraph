'use client'

import { useTheme } from '@/lib/theme/provider'
import type { Theme } from '@/lib/theme/types'
import { hasAccess, type Tier } from '@/lib/tiers/features'

const IS_BETA = process.env.NEXT_PUBLIC_BETA_MODE === 'true'

const THEMES: { value: Theme; label: string; description: string; requiredTier: Tier; accent: string; bg: string; dot: string }[] = [
  {
    value: 'surgical',
    label: 'Nocturne Classic',
    description: 'Matte near-black, one crimson accent. The default.',
    requiredTier: 'dusk',
    accent: '#FF3B30',
    bg: '#0A0A0A',
    dot: 'rgba(255,255,255,0.14)',
  },
  {
    value: 'eclipse',
    label: 'Eclipse',
    description: 'Same system, warm gold accent.',
    requiredTier: 'midnight',
    accent: '#F59E0B',
    bg: '#0A0A0A',
    dot: 'rgba(255,255,255,0.14)',
  },
  {
    value: 'aurora',
    label: 'Aurora',
    description: 'Same system, cool teal accent.',
    requiredTier: 'eclipse',
    accent: '#14B8A6',
    bg: '#0A0A0A',
    dot: 'rgba(255,255,255,0.14)',
  },
  {
    value: 'legacy',
    label: 'Nocturne Legacy',
    description: 'Same system, the old indigo accent.',
    requiredTier: 'dusk',
    accent: '#6366F1',
    bg: '#0A0A0A',
    dot: 'rgba(255,255,255,0.14)',
  },
  {
    value: 'parchment',
    label: 'Nocturne Parchment',
    description: 'Warm coffee-brown surface, cream text.',
    requiredTier: 'dusk',
    accent: '#FF3B30',
    bg: '#1C1512',
    dot: 'rgba(255,245,230,0.18)',
  },
  {
    value: 'light',
    label: 'Nocturne Light',
    description: 'Warm white surface, crimson accent.',
    requiredTier: 'dusk',
    accent: '#FF3B30',
    bg: '#F7F3EE',
    dot: 'rgba(26,22,20,0.18)',
  },
]

const TIER_LABEL: Record<Tier, string> = { dusk: 'Dusk', midnight: 'Midnight', eclipse: 'Eclipse' }

interface Props {
  tier: Tier
}

function LockBadge({ requiredTier }: { requiredTier: Tier }) {
  return (
    <span className="ml-auto flex items-center gap-1 text-caption text-text-tertiary">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="0"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      {TIER_LABEL[requiredTier]}+
    </span>
  )
}

export function AppearanceSection({ tier }: Props) {
  const { prefs, setPrefs } = useTheme()
  const canMidnight = hasAccess(tier, 'midnight')

  return (
    <div>
      <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
        Appearance
      </p>

      {/* ── Theme picker — one preset per card, accent baked in ── */}
      <div className="flex flex-col gap-2 py-3 border-b border-border-subtle">
        <p className="text-body-sm text-text-secondary">Theme</p>
        <p className="text-caption text-text-tertiary mt-0.5">
          Each preset is a complete look — surface, border, and accent together.
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
                  'relative flex flex-col gap-1 border p-3 text-left transition-colors',
                  locked ? 'bg-bg-subtle opacity-50 cursor-not-allowed' : 'bg-bg-card hover:border-border-strong',
                ].join(' ')}
                style={{ borderColor: active ? t.accent : undefined }}
              >
                {/* Swatch */}
                <div
                  className="w-full h-7 flex items-center justify-center gap-1.5 mb-1"
                  style={{ background: t.bg, border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span className="w-2 h-2" style={{ background: t.dot }} />
                  <span className="w-2 h-2" style={{ background: t.accent }} />
                  <span className="w-2 h-2" style={{ background: t.dot }} />
                </div>
                <span className="text-body-sm font-medium" style={{ color: active ? t.accent : 'var(--color-text-primary)' }}>
                  {t.label}
                </span>
                <span className="text-caption text-text-tertiary leading-snug">{t.description}</span>
                {locked && (
                  <div className="mt-1 flex items-center gap-1">
                    <LockBadge requiredTier={t.requiredTier} />
                    {!IS_BETA && (
                      <a href="/billing" className="text-caption underline underline-offset-2 text-text-tertiary hover:text-text-secondary transition-colors" onClick={e => e.stopPropagation()}>
                        Upgrade
                      </a>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Focus mode ── */}
      <div className={['flex items-start justify-between py-3', !canMidnight ? 'opacity-60' : ''].join(' ')}>
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <p className="text-body-sm text-text-secondary">Focus mode</p>
            {!canMidnight && <LockBadge requiredTier="midnight" />}
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
          className="relative inline-flex h-5 w-9 flex-shrink-0 border border-transparent transition-colors duration-200"
          style={{
            background: prefs.focus_mode ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
            cursor: canMidnight ? 'pointer' : 'not-allowed',
          }}
        >
          <span
            className="pointer-events-none inline-block h-4 w-4 transform bg-white ring-0 transition duration-200"
            style={{ transform: prefs.focus_mode ? 'translateX(16px)' : 'translateX(0)' }}
          />
        </button>
      </div>
    </div>
  )
}
