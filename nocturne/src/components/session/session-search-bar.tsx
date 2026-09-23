'use client'

// Unified search over transcript words, study keywords, and decrypted note text.
// All three data sources are in-memory; no network calls are made.
// Results are grouped by source with a highlighted match snippet. Clicking any
// result jumps to the relevant tab and position.

import { useState, useRef, useCallback, useMemo } from 'react'
import type { TranscriptWordEntry, StoredKeyword } from '@/store/session-store'

// ─── Result types ─────────────────────────────────────────────────────────────

type TranscriptHit = {
  kind: 'transcript'
  before: string
  match: string
  after: string
  wordId: string
  startMs: number
}

type KeywordHit = {
  kind: 'keyword'
  term: string
  zone: 'red' | 'likely'
  id: string
}

type NotesHit = {
  kind: 'notes'
  before: string
  match: string
  after: string
  charOffset: number
}

type Hit = TranscriptHit | KeywordHit | NotesHit

// ─── Per-source search functions ──────────────────────────────────────────────

function searchTranscript(words: TranscriptWordEntry[], query: string): TranscriptHit[] {
  if (!query || words.length === 0) return []
  const q = query.toLowerCase()

  // Build character boundary map: boundaries[i] = char index of first char of word i
  const boundaries: number[] = []
  let pos = 0
  for (const w of words) {
    boundaries.push(pos)
    pos += w.word.length + 1 // +1 for the space separator
  }

  const fullText = words.map((w) => w.word).join(' ')
  const lower = fullText.toLowerCase()

  // Binary-search boundaries[] to find which word contains charPos
  const charToWordIdx = (charPos: number): number => {
    let lo = 0
    let hi = boundaries.length - 1
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (boundaries[mid] <= charPos) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  const hits: TranscriptHit[] = []
  let searchFrom = 0

  while (hits.length < 3) {
    const idx = lower.indexOf(q, searchFrom)
    if (idx === -1) break

    const matchEnd = idx + q.length
    const wStart = charToWordIdx(idx)
    const wEnd = charToWordIdx(Math.max(idx, matchEnd - 1))

    // 4 words of context before and 5 after the match
    const ctxWStart = Math.max(0, wStart - 4)
    const ctxWEnd = Math.min(words.length - 1, wEnd + 5)

    const ctxCharStart = boundaries[ctxWStart]
    const ctxCharEnd = boundaries[ctxWEnd] + words[ctxWEnd].word.length

    hits.push({
      kind: 'transcript',
      before: (ctxWStart > 0 ? '…' : '') + fullText.slice(ctxCharStart, idx),
      match: fullText.slice(idx, matchEnd),
      after: fullText.slice(matchEnd, ctxCharEnd) + (ctxWEnd < words.length - 1 ? '…' : ''),
      wordId: words[wStart].id,
      startMs: words[wStart].startMs,
    })

    // Advance past the context window so results don't overlap
    searchFrom = boundaries[ctxWEnd] + words[ctxWEnd].word.length + 1
  }

  return hits
}

function searchKeywords(keywords: StoredKeyword[], query: string): KeywordHit[] {
  if (!query || keywords.length === 0) return []
  const q = query.toLowerCase()
  const hits: KeywordHit[] = []
  for (const kw of keywords) {
    if (hits.length >= 4) break
    if (kw.term.toLowerCase().includes(q)) {
      hits.push({ kind: 'keyword', term: kw.term, zone: kw.zone, id: kw.id })
    }
  }
  return hits
}

function searchNotes(text: string, query: string): NotesHit[] {
  if (!text || !query) return []
  const q = query.toLowerCase()
  const lower = text.toLowerCase()
  const BEFORE = 35
  const AFTER = 65
  const hits: NotesHit[] = []
  let searchFrom = 0

  while (hits.length < 3) {
    const idx = lower.indexOf(q, searchFrom)
    if (idx === -1) break

    const ctxStart = Math.max(0, idx - BEFORE)
    const ctxEnd = Math.min(text.length, idx + q.length + AFTER)

    hits.push({
      kind: 'notes',
      before: (ctxStart > 0 ? '…' : '') + text.slice(ctxStart, idx),
      match: text.slice(idx, idx + q.length),
      after: text.slice(idx + q.length, ctxEnd) + (ctxEnd < text.length ? '…' : ''),
      charOffset: idx,
    })

    searchFrom = ctxEnd
  }

  return hits
}

// ─── Small presentational pieces ─────────────────────────────────────────────

function Snippet({ before, match, after }: { before: string; match: string; after: string }) {
  return (
    <span style={{ fontSize: 12, color: '#7C8398', lineHeight: 1.5 }}>
      {before}
      <mark style={{ background: 'rgba(99,102,241,0.25)', color: '#C7D2FE', borderRadius: 2, padding: '0 1px' }}>
        {match}
      </mark>
      {after}
    </span>
  )
}

const SOURCE_STYLES = {
  transcript: { bg: 'rgba(99,102,241,0.15)', color: '#A5B4FC', label: 'Transcript' },
  keyword: { bg: '', color: '', label: 'Keyword' }, // filled per-zone below
  notes: { bg: 'rgba(52,211,153,0.12)', color: '#6EE7B7', label: 'Notes' },
} as const

function SourceBadge({ hit }: { hit: Hit }) {
  let bg: string
  let color: string
  let label: string

  if (hit.kind === 'keyword') {
    bg = hit.zone === 'red' ? 'rgba(136,19,55,0.25)' : 'rgba(76,29,149,0.25)'
    color = hit.zone === 'red' ? '#FDA4AF' : '#C4B5FD'
    label = hit.zone === 'red' ? 'Red Zone' : 'Likely Zone'
  } else {
    const s = SOURCE_STYLES[hit.kind]
    bg = s.bg
    color = s.color
    label = s.label
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: 4,
      fontSize: 10.5,
      fontWeight: 500,
      letterSpacing: '0.02em',
      background: bg,
      color,
      flexShrink: 0,
      lineHeight: 1.8,
    }}>
      {label}
    </span>
  )
}

// ─── Props / component ────────────────────────────────────────────────────────

interface Props {
  transcriptWords: TranscriptWordEntry[]
  keywords: StoredKeyword[]
  /** Ref to the decrypted plain-text of the current note. Read synchronously on search. */
  notesTextRef: React.MutableRefObject<string>
  onJumpToTranscript: (wordId: string, startMs: number) => void
  onJumpToKeyword: (id: string) => void
  onJumpToNotes: () => void
}

export function SessionSearchBar({
  transcriptWords,
  keywords,
  notesTextRef,
  onJumpToTranscript,
  onJumpToKeyword,
  onJumpToNotes,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derive all hits synchronously — everything is in memory, no debounce needed
  const hits = useMemo<Hit[]>(() => {
    const q = query.trim()
    if (q.length < 2) return []
    return [
      ...searchTranscript(transcriptWords, q),
      ...searchKeywords(keywords, q),
      ...searchNotes(notesTextRef.current, q),
    ]
  }, [query, transcriptWords, keywords, notesTextRef])

  const handleFocus = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    setOpen(true)
  }, [])

  const handleBlur = useCallback(() => {
    // Delay close so a mousedown on a result fires before we hide the dropdown
    blurTimerRef.current = setTimeout(() => setOpen(false), 150)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    }
  }, [])

  const handleHitClick = useCallback((hit: Hit) => {
    setOpen(false)
    setQuery('')
    if (hit.kind === 'transcript') onJumpToTranscript(hit.wordId, hit.startMs)
    else if (hit.kind === 'keyword') onJumpToKeyword(hit.id)
    else onJumpToNotes()
  }, [onJumpToTranscript, onJumpToKeyword, onJumpToNotes])

  const showDropdown = open && query.trim().length >= 2

  return (
    <div style={{ position: 'relative' }}>
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 32, padding: '0 10px',
        borderRadius: 8, border: `1px solid ${open ? '#3730A3' : '#1E1E2E'}`,
        background: '#0D0D14', width: 220,
        transition: 'border-color 0.15s',
      }}>
        <span style={{ color: open ? '#818CF8' : '#3F485C', display: 'flex', flexShrink: 0, transition: 'color 0.15s' }}>
          <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="8" cy="8" r="5.5" /><path d="M12.5 12.5 L16 16" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Search transcript, keywords, notes"
          style={{
            flex: 1, minWidth: 0,
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: 12, color: '#CBD5E1',
            fontFamily: 'inherit',
          }}
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setQuery(''); setOpen(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3F485C', display: 'flex', padding: 0, flexShrink: 0 }}
            aria-label="Clear search"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3 L13 13 M13 3 L3 13" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 6,
          width: 360,
          maxHeight: 340,
          overflowY: 'auto',
          background: '#0D0D14',
          border: '1px solid #1E1E2E',
          borderRadius: 10,
          boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          zIndex: 50,
        }}>
          {hits.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 12, color: '#3F485C', textAlign: 'center' }}>
              No results for "{query.trim()}"
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: '6px 0' }}>
              {hits.map((hit, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                    onClick={() => handleHitClick(hit)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      width: '100%',
                      padding: '8px 14px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <div style={{ paddingTop: 2 }}>
                      <SourceBadge hit={hit} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {hit.kind === 'keyword' ? (
                        <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>{hit.term}</span>
                      ) : (
                        <Snippet before={hit.before} match={hit.match} after={hit.after} />
                      )}
                    </div>
                  </button>
                  {/* Separator between different source types */}
                  {i < hits.length - 1 && hits[i + 1].kind !== hit.kind && (
                    <div style={{ height: 1, background: '#12121A', margin: '2px 0' }} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
