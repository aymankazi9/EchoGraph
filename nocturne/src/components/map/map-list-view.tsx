'use client'

// Keyboard-navigable, no-canvas alternative to the Cytoscape graph — same data,
// same click(Enter)-opens-drawer behavior, same "dim rather than remove" filter
// semantics as the graph itself.

import type { GraphNode } from '@/lib/graph/buildGraph'
import type { MasteryState } from '@/lib/scoring/srs'
import type { Lens } from './cytoscape-graph'

const MASTERY_LABEL: Record<MasteryState, string> = { new: 'New', learning: 'Learning', mastered: 'Mastered' }

interface Props {
  nodes: GraphNode[]
  lens: Lens
  masteryByTerm: Record<string, MasteryState>
  redZoneOnly: boolean
  onSelect: (id: string) => void
}

export function MapListView({ nodes, lens, masteryByTerm, redZoneOnly, onSelect }: Props) {
  const sorted = [...nodes].sort((a, b) => b.score - a.score)

  return (
    <div role="table" aria-label="Keyword list" style={{ border: '1px solid var(--color-border-default)' }}>
      <div role="row" style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 110px', borderBottom: '1px solid var(--color-border-default)', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>
        <span role="columnheader" style={{ padding: '10px 14px' }}>Term</span>
        <span role="columnheader" style={{ padding: '10px 14px' }}>Zone</span>
        <span role="columnheader" style={{ padding: '10px 14px' }}>Score</span>
        {lens === 'mastery' && <span role="columnheader" style={{ padding: '10px 14px' }}>Mastery</span>}
      </div>
      {sorted.map((n, i) => {
        const dimmed = redZoneOnly && n.zone !== 'red'
        const mastery = masteryByTerm[n.id] ?? 'new'
        return (
          <button
            key={n.id}
            type="button"
            role="row"
            onClick={() => onSelect(n.id)}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 110px 90px 110px', width: '100%', textAlign: 'left',
              borderBottom: i === sorted.length - 1 ? 'none' : '1px solid var(--color-border-subtle)',
              background: 'none', border: 'none', cursor: 'pointer',
              opacity: dimmed ? 0.35 : 1, transition: 'opacity 0.15s',
            }}
          >
            <span role="cell" style={{ padding: '10px 14px', fontSize: 13, color: 'var(--color-text-primary)' }}>{n.label}</span>
            <span role="cell" style={{ padding: '10px 14px', fontSize: 12, color: n.zone === 'red' ? 'var(--color-severity)' : 'var(--color-graph-likely-zone)' }}>
              {n.zone === 'red' ? 'Red' : 'Likely'}
            </span>
            <span role="cell" style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {Math.round(n.score * 100)}%
            </span>
            {lens === 'mastery' && (
              <span role="cell" style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {MASTERY_LABEL[mastery]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
