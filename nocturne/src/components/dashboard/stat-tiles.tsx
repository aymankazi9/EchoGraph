// Pure presentational — all values pre-computed server-side and passed as props.
// No fetch, no client state, no hardcoded numbers.

export interface VaultStats {
  redZoneTotal: number       // all red-zone keywords across sessions
  sessionCount: number       // total sessions owned by user
  sessionsThisWeek: number   // sessions created in the last 7 calendar days
  studyStreak: number        // current consecutive-day streak (from user_activity)
  cardsExported: number      // lifetime sum of export_events.card_count
}

interface TileProps {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}

function Tile({ icon, label, value, sub }: TileProps) {
  return (
    <div
      style={{
        flex: 1, minWidth: 0,
        padding: '14px 16px',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border-default)',
        background: 'var(--color-bg-elevated)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {/* Icon + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon}
        <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          {label}
        </span>
      </div>

      {/* Value */}
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-text-primary)', lineHeight: 1 }}>
        {value}
      </p>

      {/* Sub-label */}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
        {sub}
      </p>
    </div>
  )
}

function Icon({ bg, border, color, children }: { bg: string; border: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{
      width: 30, height: 30, flexShrink: 0, borderRadius: 8,
      background: bg, border: `1px solid ${border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color,
    }}>
      {children}
    </span>
  )
}

export function StatTiles({ redZoneTotal, sessionCount, sessionsThisWeek, studyStreak, cardsExported }: VaultStats) {
  const streakLabel = studyStreak > 0 ? `${studyStreak} day${studyStreak !== 1 ? 's' : ''}` : '0 days'
  const streakSub = studyStreak > 0 ? 'keep it going' : 'start one today'

  const weekSub = sessionsThisWeek > 0
    ? `+${sessionsThisWeek} this week`
    : 'none this week'

  const redSub = sessionCount > 0
    ? `across ${sessionCount} lecture${sessionCount !== 1 ? 's' : ''}`
    : 'no sessions yet'

  const exportSub = cardsExported > 0 ? 'to Anki' : 'export a deck to start'

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
      {/* Red Zone keywords */}
      <Tile
        icon={
          <Icon bg="rgba(239,68,68,0.12)" border="rgba(239,68,68,0.25)" color="#F87171">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 2 L2 16 h14 Z" />
              <line x1="9" y1="8" x2="9" y2="11" />
              <circle cx="9" cy="13.5" r="0.5" fill="currentColor" />
            </svg>
          </Icon>
        }
        label="Red Zone keywords"
        value={String(redZoneTotal)}
        sub={redSub}
      />

      {/* Lectures captured */}
      <Tile
        icon={
          <Icon bg="rgba(99,102,241,0.12)" border="rgba(99,102,241,0.25)" color="#818CF8">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="14" height="10" rx="1.5" />
              <path d="M5 5V4a2 2 0 0 1 4 0v1" />
              <path d="M9 5V4a2 2 0 0 1 4 0v1" />
            </svg>
          </Icon>
        }
        label="Lectures captured"
        value={String(sessionCount)}
        sub={weekSub}
      />

      {/* Study streak */}
      <Tile
        icon={
          <Icon bg="rgba(251,191,36,0.12)" border="rgba(251,191,36,0.3)" color="#FBBF24">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 1.5 c2 3 4 4.2 4 7.5 a4 4 0 0 1 -8 0 c0 -1.6 0.8 -2.8 1.6 -3.6 C7 6.5 7.3 7.6 8 8 c0.3 -2 0 -4.5 1 -6.5 Z" />
            </svg>
          </Icon>
        }
        label="Study streak"
        value={streakLabel}
        sub={streakSub}
      />

      {/* Cards exported */}
      <Tile
        icon={
          <Icon bg="rgba(16,185,129,0.12)" border="rgba(16,185,129,0.25)" color="#34D399">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="14" height="10" rx="2" />
              <line x1="2" y1="8" x2="16" y2="8" />
            </svg>
          </Icon>
        }
        label="Cards exported"
        value={String(cardsExported)}
        sub={exportSub}
      />
    </div>
  )
}
