'use client'

// THEME_SURGICAL.md §9/05 — top hairline per row, mono +/− toggle, no chevrons, no rounded panels.
export type HelpAccordionItem = {
  id: string
  before: string
  match: string
  after: string
  hasMatch: boolean
  a: string
  isOpen: boolean
}

export function HelpAccordion({ items, onToggle }: { items: HelpAccordionItem[]; onToggle: (id: string) => void }) {
  return (
    <div>
      {items.map((it) => (
        <div key={it.id} style={{ borderTop: '1px solid var(--color-border-default)' }}>
          <button
            type="button"
            onClick={() => onToggle(it.id)}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%', textAlign: 'left', padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ flexShrink: 0, width: 14, fontFamily: 'var(--font-mono)', fontSize: 15, lineHeight: '22px', color: it.isOpen ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
              {it.isOpen ? '−' : '+'}
            </span>
            <span style={{ flex: 1, fontSize: 15.5, fontWeight: 500, lineHeight: 1.5, color: it.isOpen ? 'var(--color-text-primary)' : 'var(--color-text-primary-soft)' }}>
              {it.before}
              {it.hasMatch && (
                <mark style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-text-primary)', padding: '0 2px' }}>
                  {it.match}
                </mark>
              )}
              {it.after}
            </span>
          </button>
          {it.isOpen && (
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--color-text-secondary)', margin: '-2px 0 18px', paddingLeft: 28 }}>{it.a}</p>
          )}
        </div>
      ))}
    </div>
  )
}
