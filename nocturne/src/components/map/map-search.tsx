'use client'

// Autocomplete over the graph's own node labels. Mirrors session-search-bar.tsx's
// dropdown/highlight/blur-delay pattern for visual consistency, but jumps via
// CytoscapeGraphHandle.panToNode (pan+zoom) rather than the session store's seekTo.

import { useState } from 'react'

interface Props {
  nodes: { id: string; label: string }[]
  onSelect: (id: string) => void
}

function splitHL(text: string, q: string): { before: string; match: string; after: string } {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return { before: text, match: '', after: '' }
  return { before: text.slice(0, i), match: text.slice(i, i + q.length), after: text.slice(i + q.length) }
}

export function MapSearch({ nodes, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const q = query.trim()
  const hits = q ? nodes.filter((n) => n.label.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []

  function handlePick(id: string) {
    onSelect(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        type="text"
        placeholder="Search terms…"
        style={{
          height: 32, width: 180, padding: '0 10px', boxSizing: 'border-box',
          background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)',
          color: 'var(--color-text-primary)', fontSize: 12.5, outline: 'none',
        }}
      />
      {open && q && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 260, maxHeight: 280, overflowY: 'auto',
          background: 'var(--color-bg-overlay)', border: '1px solid var(--color-border-default)', zIndex: 20,
        }}>
          {hits.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
              No terms match &ldquo;{q}&rdquo;
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: '6px 0' }}>
              {hits.map((hit) => {
                const hl = splitHL(hit.label, q)
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePick(hit.id)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-secondary)' }}
                    >
                      {hl.before}
                      {hl.match && <mark style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-text-primary)', padding: '0 1px' }}>{hl.match}</mark>}
                      {hl.after}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
