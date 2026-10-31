export interface ConceptGraphNode {
  x: number
  y: number
  label: string
  confidence?: string
  focus?: boolean
  red?: boolean
}

// The mini concept-graph used by both the hero's Path B inspector and the demo carousel's
// "Map" step — positioned node chips + SVG connector lines, red edges touch the focus node.
export function ConceptGraph({
  nodes,
  edges,
  focusIndex = 0,
}: {
  nodes: ConceptGraphNode[]
  edges: readonly (readonly [number, number])[]
  focusIndex?: number
}) {
  return (
    <>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke={a === focusIndex ? 'rgba(255,59,48,0.45)' : 'rgba(255,255,255,0.14)'}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {nodes.map((n, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${n.x}%`,
            top: `${n.y}%`,
            transform: 'translate(-50%,-50%)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '5px 9px',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            background: '#0C0C0D',
            color: n.focus ? '#EDEDED' : '#9A9A9F',
            border: '1px solid ' + (n.focus ? '#FF3B30' : n.red ? 'rgba(255,59,48,0.45)' : 'rgba(255,255,255,0.14)'),
          }}
        >
          <span>{n.label}</span>
          {n.confidence && <span style={{ color: '#FF3B30' }}>{n.confidence}</span>}
        </div>
      ))}
    </>
  )
}
