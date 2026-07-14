'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'

interface Props {
  sessionId: string
  initialTag: string | null
}

export function CourseTagPicker({ sessionId, initialTag }: Props) {
  const [tag, setTag]               = useState(initialTag)
  const [open, setOpen]             = useState(false)
  const [existingTags, setExisting] = useState<string[]>([])
  const [newTag, setNewTag]         = useState('')
  const [saving, setSaving]         = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Fetch all course_tags in the user's sessions when the picker opens
  useEffect(() => {
    if (!open) return
    supabase
      .from('sessions')
      .select('course_tag')
      .not('course_tag', 'is', null)
      .then(({ data }) => {
        const tags = [...new Set((data ?? []).map((r) => r.course_tag as string))].sort()
        setExisting(tags)
        setTimeout(() => inputRef.current?.focus(), 60)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close when clicking outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  async function applyTag(t: string | null) {
    if (saving) return
    setSaving(true)
    await supabase.from('sessions').update({ course_tag: t }).eq('id', sessionId)
    setTag(t)
    setOpen(false)
    setNewTag('')
    setSaving(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Trigger chip */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          height: 28, padding: '0 10px', borderRadius: 8,
          border: '1px solid #1E1E2E', background: '#0D0D14',
          fontSize: 12, color: tag ? '#CBD5E1' : '#3F485C',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5 h10 a2 2 0 0 1 1.7 3 L12 11 H3 V5 Z" />
          <circle cx="5.5" cy="8" r="1" fill="currentColor" stroke="none" />
        </svg>
        {tag ?? 'Subject'}
        {saving && <span style={{ color: '#5B6478' }}>…</span>}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 34, right: 0, zIndex: 100,
          width: 210, borderRadius: 10, border: '1px solid #1E1E2E',
          background: '#0D0D14', padding: 7,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {/* Existing tags */}
          {existingTags.filter((t) => t !== tag).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => applyTag(t)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 10px', borderRadius: 7,
                background: 'none', border: 'none',
                fontSize: 12, color: '#CBD5E1', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#16151E' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              {t}
            </button>
          ))}

          {/* Remove option (only if a tag is set) */}
          {tag && (
            <>
              {existingTags.filter((t) => t !== tag).length > 0 && (
                <div style={{ height: 1, background: '#16151E', margin: '5px 0' }} />
              )}
              <button
                type="button"
                onClick={() => applyTag(null)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 10px', borderRadius: 7,
                  background: 'none', border: 'none',
                  fontSize: 12, color: '#FB7185', cursor: 'pointer',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(251,113,133,0.08)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
              >
                Remove subject
              </button>
            </>
          )}

          <div style={{ height: 1, background: '#16151E', margin: '5px 0' }} />

          {/* New tag input */}
          <div style={{ display: 'flex', gap: 5 }}>
            <input
              ref={inputRef}
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTag.trim()) applyTag(newTag.trim())
                if (e.key === 'Escape') setOpen(false)
              }}
              placeholder="New subject…"
              style={{
                flex: 1, background: '#16151E', border: '1px solid #1E1E2E',
                borderRadius: 7, padding: '5px 9px',
                fontSize: 12, color: '#CBD5E1', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            {newTag.trim() && (
              <button
                type="button"
                onClick={() => applyTag(newTag.trim())}
                style={{
                  flexShrink: 0, padding: '5px 10px', borderRadius: 7,
                  background: '#6366F1', border: 'none',
                  fontSize: 12, color: '#fff', cursor: 'pointer',
                }}
              >
                Add
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
