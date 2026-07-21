'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { getMasterKey } from '@/lib/crypto/vault'
import { encryptText } from '@/lib/crypto/encrypt'
import { decryptText } from '@/lib/crypto/decrypt'
import { createClient } from '@/lib/supabase'
import { useSessionStore } from '@/store/session-store'

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

  const [content, setContent]       = useState('')
  const [loading, setLoading]       = useState(true)
  const [status, setStatus]         = useState<SaveStatus>('idle')
  const [generating, setGenerating] = useState(false)

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

  // ── Generate notes from lecture content ──────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const mk = getMasterKey()
    if (!mk) return

    setGenerating(true)
    try {
      // Fetch and decrypt slide texts
      const { data: slideRows } = await supabase
        .from('slides')
        .select('page_number, text_encrypted')
        .eq('session_id', sessionId)
        .order('page_number')

      const slides = await Promise.all(
        (slideRows ?? []).map(async (s) => ({
          pageNumber: s.page_number as number,
          text: s.text_encrypted
            ? await decryptText(mk, s.text_encrypted as string).catch(() => '')
            : '',
        })),
      )

      const { transcriptWords, keywords } = useSessionStore.getState()
      const transcriptText = transcriptWords.map((w) => w.word).join(' ')

      const resp = await fetch('/api/generate/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          slides,
          transcriptText,
          keywords: keywords.map((k) => ({ term: k.term, zone: k.zone })),
        }),
      })

      if (!resp.ok) throw new Error('Generation failed')

      const { notes } = await resp.json() as { notes: string }
      if (notes) {
        setContent(notes)
        await save(notes)
      }
    } catch {
      // silently ignore — user can retry
    } finally {
      setGenerating(false)
    }
  }, [sessionId, supabase, save])

  // ── Cleanup timers on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────
  const showGenerateButton = !loading && content === '' && !generating

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, maxWidth: 720, width: '100%', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', margin: 0, letterSpacing: '-0.01em' }}>Notes</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {content !== '' && !generating && (
            <button
              onClick={handleGenerate}
              style={{
                fontSize: 12,
                color: '#6366F1',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                opacity: 0.8,
              }}
            >
              Regenerate
            </button>
          )}
          <span style={{ fontSize: 12, color: STATUS_COLOR[status], transition: 'color 0.2s' }}>
            {generating ? 'Generating…' : STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3F485C', fontSize: 13 }}>
          Loading…
        </div>
      ) : generating ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#5B6478' }}>
          <div style={{ width: 24, height: 24, border: '2px solid #6366F1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13 }}>Generating notes from your lecture…</span>
        </div>
      ) : showGenerateButton ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <button
            onClick={handleGenerate}
            style={{
              height: 40,
              padding: '0 20px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              background: '#6366F1',
              color: '#09090F',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            ✦ Generate notes from lecture
          </button>
          <p style={{ fontSize: 12, color: '#3F485C', margin: 0 }}>
            Or start writing below — notes are encrypted and auto-saved.
          </p>
          <textarea
            value={content}
            onChange={handleChange}
            placeholder="Start writing…"
            spellCheck
            style={{
              width: '100%',
              minHeight: 160,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: '#CBD5E1',
              caretColor: '#818CF8',
              fontSize: 14.5,
              lineHeight: 1.8,
              fontFamily: 'inherit',
              padding: 0,
            }}
          />
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
