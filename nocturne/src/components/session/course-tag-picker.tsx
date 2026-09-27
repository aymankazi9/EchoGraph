'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'

interface CourseRow {
  id: string
  name: string
  exam_date: string | null  // ISO date string e.g. "2026-12-15"
}

interface Props {
  sessionId: string
  userId: string
  initialCourseId: string | null
  initialCourseName: string | null
}

export function CourseTagPicker({ sessionId, userId, initialCourseId, initialCourseName }: Props) {
  const [courseId,   setCourseId]   = useState(initialCourseId)
  const [courseName, setCourseName] = useState(initialCourseName)
  const [open,       setOpen]       = useState(false)
  const [courses,    setCourses]    = useState<CourseRow[]>([])
  const [newName,    setNewName]    = useState('')
  const [saving,     setSaving]     = useState(false)

  // Inline edit state — only one course editable at a time
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editName,  setEditName]    = useState('')
  const [editDate,  setEditDate]    = useState('')  // 'YYYY-MM-DD' or ''

  const containerRef = useRef<HTMLDivElement>(null)
  const newNameRef   = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Load user's courses when the dropdown opens
  useEffect(() => {
    if (!open) return
    supabase
      .from('courses')
      .select('id, name, exam_date')
      .order('name')
      .then(({ data }) => {
        setCourses((data ?? []) as CourseRow[])
        setTimeout(() => newNameRef.current?.focus(), 60)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close on outside click; cancel any in-progress edit
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setEditingId(null)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // ── Assign an existing course to this session ─────────────────────────────

  async function assignCourse(id: string | null, name: string | null) {
    if (saving) return
    setSaving(true)
    await supabase.from('sessions').update({ course_id: id }).eq('id', sessionId)
    setCourseId(id)
    setCourseName(name)
    setOpen(false)
    setNewName('')
    setSaving(false)
  }

  // ── Create a new course and immediately assign it ─────────────────────────

  async function createAndAssign(name: string) {
    const trimmed = name.trim()
    if (saving || !trimmed) return
    setSaving(true)

    // upsert so typing an existing name re-uses it rather than erroring
    const { data: rows } = await supabase
      .from('courses')
      .upsert({ user_id: userId, name: trimmed }, { onConflict: 'user_id,name' })
      .select('id, name, exam_date')

    const created = rows?.[0] as CourseRow | undefined
    if (created) {
      await supabase.from('sessions').update({ course_id: created.id }).eq('id', sessionId)
      setCourseId(created.id)
      setCourseName(created.name)
      setCourses((prev) => {
        const exists = prev.find((c) => c.id === created.id)
        if (exists) return prev
        return [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      })
    }

    setOpen(false)
    setNewName('')
    setSaving(false)
  }

  // ── Save an inline course edit (name + exam_date) ─────────────────────────

  async function saveCourseEdit(id: string) {
    const trimmed = editName.trim()
    if (saving || !trimmed) return
    setSaving(true)

    await supabase
      .from('courses')
      .update({ name: trimmed, exam_date: editDate || null })
      .eq('id', id)

    // Patch local list and the chip label if this course is currently assigned
    setCourses((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, name: trimmed, exam_date: editDate || null } : c,
      ),
    )
    if (courseId === id) setCourseName(trimmed)
    setEditingId(null)
    setSaving(false)
  }

  function startEdit(course: CourseRow, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(course.id)
    setEditName(course.name)
    setEditDate(course.exam_date ?? '')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Trigger chip */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          height: 28, padding: '0 10px', borderRadius: 8,
          border: '1px solid #1E1E2E', background: '#0D0D14',
          fontSize: 12, color: courseName ? '#CBD5E1' : '#3F485C',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        {/* tag icon */}
        <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5 h10 a2 2 0 0 1 1.7 3 L12 11 H3 V5 Z" />
          <circle cx="5.5" cy="8" r="1" fill="currentColor" stroke="none" />
        </svg>
        {courseName ?? 'Subject'}
        {saving && <span style={{ color: '#5B6478' }}>…</span>}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 34, right: 0, zIndex: 100,
          width: 230, borderRadius: 10, border: '1px solid #1E1E2E',
          background: '#0D0D14', padding: 7,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>

          {/* Existing courses */}
          {courses.map((c) =>
            editingId === c.id ? (
              // ── Inline edit form ────────────────────────────────────────
              <div key={c.id} style={{ padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCourseEdit(c.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  placeholder="Course name"
                  style={{
                    background: '#16151E', border: '1px solid #2D2B45',
                    borderRadius: 7, padding: '5px 9px',
                    fontSize: 12, color: '#CBD5E1', outline: 'none',
                    fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
                  }}
                />
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  title="Exam date (optional)"
                  style={{
                    background: '#16151E', border: '1px solid #2D2B45',
                    borderRadius: 7, padding: '5px 9px',
                    fontSize: 12, color: editDate ? '#CBD5E1' : '#5B6478', outline: 'none',
                    fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
                    colorScheme: 'dark',
                  }}
                />
                <div style={{ display: 'flex', gap: 5 }}>
                  <button
                    type="button"
                    onClick={() => saveCourseEdit(c.id)}
                    disabled={saving || !editName.trim()}
                    style={{
                      flex: 1, padding: '5px 0', borderRadius: 7,
                      background: '#6366F1', border: 'none',
                      fontSize: 11.5, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving || !editName.trim() ? 0.5 : 1,
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    style={{
                      padding: '5px 10px', borderRadius: 7,
                      background: 'none', border: '1px solid #1E1E2E',
                      fontSize: 11.5, color: '#5B6478', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // ── Normal course row ───────────────────────────────────────
              <div
                key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  borderRadius: 7,
                  background: courseId === c.id ? 'rgba(99,102,241,0.08)' : 'none',
                }}
              >
                <button
                  type="button"
                  onClick={() => assignCourse(c.id, c.name)}
                  style={{
                    flex: 1, textAlign: 'left', padding: '6px 8px',
                    background: 'none', border: 'none',
                    fontSize: 12, color: courseId === c.id ? '#A5B4FC' : '#CBD5E1',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (courseId !== c.id) (e.currentTarget as HTMLButtonElement).style.background = '#16151E'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'none'
                  }}
                >
                  <span style={{ display: 'block' }}>{c.name}</span>
                  {c.exam_date && (
                    <span style={{ display: 'block', fontSize: 10.5, color: '#5B6478', marginTop: 1 }}>
                      Exam {new Date(c.exam_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </button>
                {/* Pencil — opens inline edit */}
                <button
                  type="button"
                  onClick={(e) => startEdit(c, e)}
                  title="Edit course"
                  style={{
                    flexShrink: 0, padding: '4px 6px', marginRight: 2,
                    background: 'none', border: 'none',
                    color: '#3F485C', cursor: 'pointer', borderRadius: 5,
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#818CF8' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#3F485C' }}
                >
                  <svg width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2 L16 5 L7 14 L3 15 L4 11 Z" /><path d="M11 4 L14 7" />
                  </svg>
                </button>
              </div>
            ),
          )}

          {/* Remove option */}
          {courseId && !editingId && (
            <>
              {courses.length > 0 && (
                <div style={{ height: 1, background: '#16151E', margin: '5px 0' }} />
              )}
              <button
                type="button"
                onClick={() => assignCourse(null, null)}
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

          {!editingId && (
            <>
              <div style={{ height: 1, background: '#16151E', margin: '5px 0' }} />
              {/* New course input */}
              <div style={{ display: 'flex', gap: 5 }}>
                <input
                  ref={newNameRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newName.trim()) createAndAssign(newName)
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
                {newName.trim() && (
                  <button
                    type="button"
                    onClick={() => createAndAssign(newName)}
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
