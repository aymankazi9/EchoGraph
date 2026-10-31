'use client'

// Small overlay explaining the current color encoding — swatches read straight
// from the same CSS variables cytoscape-graph.tsx uses, so this stays in sync
// with the canvas without any shared state.

import type { Lens } from './cytoscape-graph'

interface Props {
  lens: Lens
  /** Distinct palette slots (clusterIndex % 6) actually present in the current graph. */
  clusterSlots: number[]
}

const CLUSTER_VARS = [
  '--color-graph-cluster-1',
  '--color-graph-cluster-2',
  '--color-graph-cluster-3',
  '--color-graph-cluster-4',
  '--color-graph-cluster-5',
  '--color-graph-cluster-6',
]

function Swatch({ color }: { color: string }) {
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
}

function Row({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <Swatch color={color} />
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-secondary)' }}>{label}</span>
    </div>
  )
}

export function MapLegend({ lens, clusterSlots }: Props) {
  return (
    <div
      style={{
        position: 'absolute', left: 16, bottom: 16, zIndex: 4,
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: '10px 12px', background: 'var(--color-bg-overlay)', border: '1px solid var(--color-border-default)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 2 }}>
        {lens === 'importance' ? 'Clusters' : 'Mastery'}
      </span>
      <Row color="var(--color-severity)" label="Red Zone" />
      {lens === 'importance'
        ? clusterSlots.map((slot) => (
            <Row key={slot} color={`var(${CLUSTER_VARS[slot]})`} label={`Cluster ${slot + 1}`} />
          ))
        : (
          <>
            <Row color="var(--color-text-disabled)" label="New" />
            <Row color="var(--color-text-secondary)" label="Learning" />
            <Row color="var(--color-text-primary)" label="Mastered" />
          </>
        )}
    </div>
  )
}
