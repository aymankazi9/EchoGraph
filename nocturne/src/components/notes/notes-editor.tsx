'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { getMasterKey } from '@/lib/crypto/vault'
import { encryptText } from '@/lib/crypto/encrypt'
import { decryptText } from '@/lib/crypto/decrypt'
import { createClient } from '@/lib/supabase'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  sessionId: string
  userId: string
}

const STATUS_COLOR: Record<SaveStatus, string> = {
  idle:   '#3F485C',
  saving: '#5B6478',
  saved:  '#6EE7B7',
  error:  '#FDA4AF',
}

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle:   '',
  saving: 'Saving…',
  saved:  'Saved',
  error:  'Save failed — will retry',
}

export function NotesEditor({ sessionId, userId }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [content, setContent]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [status, setStatus]     = useState<SaveStatus>('idle')

  const noteIdRef     = useRef<string | null>(null)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load existing note on mount ──────────────────────────────────────────
  useEffect(() => {
    const mk = getMasterKey()
    if (!mk) { setLoading(false); return }

    supabase
      .from('session_notes')
      .select('id, content_encrypted')
      .eq('session_id', sessionId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data) {
          noteIdRef.current = data.id as string
          try {
            const plain = await decryptText(mk, data.content_encrypted as string)
            setContent(plain)
          } catch {
            // Corrupt or empty note — start fresh
          }
        }
        setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // session notes don't reload within a session

  // ── Persist ──────────────────────────────────────────────────────────────
  const save = useCallback(async (text: string) => {
    // No point inserting an empty row when nothing has been written yet
    if (text === '' && !noteIdRef.current) return

    const mk = getMasterKey()
    if (!mk) return

    setStatus('saving')
    try {
      const encrypted = await encryptText(mk, text)
      const now = new Date().toISOString()

      if (noteIdRef.current) {
        const { error } = await supabase
          .from('session_notes')
          .update({ content_encrypted: encrypted, updated_at: now })
          .eq('id', noteIdRef.current)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('session_notes')
          .insert({ session_id: sessionId, user_id: userId, content_encrypted: encrypted, updated_at: now })
          .select('id')
          .single()
        if (error) throw error
        noteIdRef.current = (data as { id: string }).id
      }

      setStatus('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
    }
  }, [sessionId, userId, supabase])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setContent(text)
    setStatus('idle')

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(text), 1500)
  }, [save])

  // ── Cleanup timers on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, maxWidth: 720, width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', margin: 0, letterSpacing: '-0.01em' }}>Notes</h2>
        <span style={{ fontSize: 12, color: STATUS_COLOR[status], transition: 'color 0.2s' }}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3F485C', fontSize: 13 }}>
          Loading…
        </div>
      ) : (
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Start writing. Notes are encrypted and auto-saved."
          spellCheck
          style={{
            flex: 1,
            minHeight: 320,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: '#CBD5E1',
            caretColor: '#818CF8',
            fontSize: 14.5,
            lineHeight: 1.8,
            fontFamily: 'inherit',
            width: '100%',
            padding: 0,
          }}
        />
      )}
    </div>
  )
}
