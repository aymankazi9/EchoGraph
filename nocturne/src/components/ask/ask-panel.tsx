'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Send, BookOpen } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'
import { getMasterKey } from '@/lib/crypto/vault'
import { encryptText } from '@/lib/crypto/encrypt'
import { decryptText } from '@/lib/crypto/decrypt'
import { createClient } from '@/lib/supabase'
import { AskConsentModal } from './ask-consent-modal'

interface AskMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citedSlideIndices: number[]
  createdAt: string
}

interface Props {
  sessionId: string
  userId: string
}

export function AskPanel({ sessionId, userId }: Props) {
  const transcriptWords   = useSessionStore((s) => s.transcriptWords)
  const askConsentGranted = useSessionStore((s) => s.askConsentGranted)
  const grantAskConsent   = useSessionStore((s) => s.grantAskConsent)

  const supabase = useMemo(() => createClient(), [])

  const [showModal,       setShowModal]       = useState(false)
  const [messages,        setMessages]        = useState<AskMessage[]>([])
  const [conversationId,  setConversationId]  = useState<string | null>(null)
  const [input,           setInput]           = useState('')
  const [submitting,      setSubmitting]      = useState(false)
  const [loadingHistory,  setLoadingHistory]  = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  // Slide texts fetched once after consent — cached here for the session
  const slideCacheRef = useRef<{ pageNumber: number; text: string }[] | null>(null)
  const bottomRef     = useRef<HTMLDivElement | null>(null)

  // ── Load conversation history when consent is granted ───────────────────
  useEffect(() => {
    if (!askConsentGranted) return
    setLoadingHistory(true)

    supabase
      .from('ask_conversations')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle()
      .then(async ({ data: convo }) => {
        if (!convo) { setLoadingHistory(false); return }

        setConversationId(convo.id as string)
        const mk = getMasterKey()
        if (!mk) { setLoadingHistory(false); return }

        const { data: rows } = await supabase
          .from('ask_messages')
          .select('id, role, content_encrypted, cited_slide_indices, created_at')
          .eq('conversation_id', convo.id)
          .order('created_at')

        if (rows && rows.length > 0) {
          const decrypted: AskMessage[] = await Promise.all(
            rows.map(async (r) => ({
              id: r.id as string,
              role: r.role as 'user' | 'assistant',
              content: await decryptText(mk, r.content_encrypted as string).catch(() => '[decryption failed]'),
              citedSlideIndices: (r.cited_slide_indices as number[]) ?? [],
              createdAt: r.created_at as string,
            })),
          )
          setMessages(decrypted)
        }
        setLoadingHistory(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askConsentGranted])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Fetch + decrypt slide texts (lazy, cached) ───────────────────────────
  const getSlideTexts = useCallback(async (): Promise<{ pageNumber: number; text: string }[]> => {
    if (slideCacheRef.current !== null) return slideCacheRef.current

    const mk = getMasterKey()
    if (!mk) { slideCacheRef.current = []; return [] }

    const { data: rows } = await supabase
      .from('slides')
      .select('page_number, text_encrypted')
      .eq('session_id', sessionId)
      .order('page_number')

    const slides = rows
      ? await Promise.all(
          rows.map(async (r) => ({
            pageNumber: r.page_number as number,
            text: r.text_encrypted
              ? await decryptText(mk, r.text_encrypted as string).catch(() => '')
              : '',
          })),
        )
      : []

    slideCacheRef.current = slides
    return slides
  }, [sessionId, supabase])

  // ── Submit a question ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const question = input.trim()
    if (!question || submitting) return

    const mk = getMasterKey()
    if (!mk) return

    setInput('')
    setSubmitting(true)
    setError(null)

    // Optimistically add the user message to the UI
    const tempId = `temp-${Date.now()}`
    const userMsg: AskMessage = {
      id: tempId,
      role: 'user',
      content: question,
      citedSlideIndices: [],
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      // Build RAG context from in-memory store + decrypted slides
      const transcriptText = transcriptWords.map((w) => w.word).join(' ')
      const slides = await getSlideTexts()

      // POST to server — plaintext content is request-scoped only
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, transcriptText, slides, sessionId }),
      })

      if (!res.ok) {
        const { error: errMsg } = await res.json() as { error: string }
        throw new Error(errMsg ?? `HTTP ${res.status}`)
      }

      const { answer, citedSlideIndices } = await res.json() as {
        answer: string
        citedSlideIndices: number[]
      }

      // Ensure conversation row exists before inserting messages
      let convoId = conversationId
      if (!convoId) {
        const { data: convo, error: convoErr } = await supabase
          .from('ask_conversations')
          .insert({ session_id: sessionId, user_id: userId })
          .select('id')
          .single()
        if (convoErr) throw convoErr
        convoId = (convo as { id: string }).id
        setConversationId(convoId)
      }

      // Encrypt both messages before storage — plaintext never touches the DB
      const [encryptedQuestion, encryptedAnswer] = await Promise.all([
        encryptText(mk, question),
        encryptText(mk, answer),
      ])

      const { data: inserted } = await supabase
        .from('ask_messages')
        .insert([
          { conversation_id: convoId, role: 'user',      content_encrypted: encryptedQuestion, cited_slide_indices: [] },
          { conversation_id: convoId, role: 'assistant', content_encrypted: encryptedAnswer,   cited_slide_indices: citedSlideIndices },
        ])
        .select('id, role, created_at')

      // Replace the temp user message + add the real assistant message
      const assistantMsg: AskMessage = {
        id: inserted?.[1]?.id as string ?? `resp-${Date.now()}`,
        role: 'assistant',
        content: answer,
        citedSlideIndices,
        createdAt: inserted?.[1]?.created_at as string ?? new Date().toISOString(),
      }

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        { ...userMsg, id: inserted?.[0]?.id as string ?? tempId },
        assistantMsg,
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSubmitting(false)
    }
  }, [input, submitting, transcriptWords, getSlideTexts, sessionId, conversationId, userId, supabase])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  // ── Consent not yet granted — show inline prompt (mirrors YouTube panel) ──
  if (!askConsentGranted) {
    return (
      <>
        <AskConsentModal
          open={showModal}
          onAllow={() => { grantAskConsent(); setShowModal(false) }}
          onDeny={() => setShowModal(false)}
        />

        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#16151F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={18} strokeWidth={1.5} style={{ color: '#5B6478' }} />
          </div>
          <div style={{ maxWidth: 340 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', margin: '0 0 6px' }}>
              Ask this lecture anything
            </p>
            <p style={{ fontSize: 13, color: '#5B6478', lineHeight: 1.65, margin: '0 0 20px' }}>
              Answers grounded in this session&apos;s transcript and slides. Requires sending
              content to a Nocturne server for this query only — not stored in plaintext.
            </p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="h-9 px-5 rounded-btn bg-indigo-500 text-text-inverse text-body font-medium hover:bg-indigo-600 transition-colors"
            >
              Enable Ask
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Chat interface ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 720, width: '100%', margin: '0 auto' }}>

      {/* Message list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        {loadingHistory && (
          <p style={{ fontSize: 13, color: '#3F485C', textAlign: 'center', paddingTop: 32 }}>Loading history…</p>
        )}

        {!loadingHistory && messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', paddingTop: 48 }}>
            <p style={{ fontSize: 14, color: '#5B6478' }}>Ask anything about this lecture.</p>
            <p style={{ fontSize: 12, color: '#3F485C' }}>Answers are grounded in transcript and slides — citations included.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 6,
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? 'rgba(99,102,241,0.18)' : '#0F0F19',
                border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.3)' : '#1E1E2E'}`,
                fontSize: 13.5,
                color: msg.role === 'user' ? '#C7D2FE' : '#CBD5E1',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.content}
            </div>

            {/* Slide citation badges */}
            {msg.citedSlideIndices.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {msg.citedSlideIndices.map((n) => (
                  <span
                    key={n}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 9999,
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      color: '#818CF8',
                    }}
                  >
                    Slide {n}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Error */}
        {error && (
          <p style={{ fontSize: 12, color: '#FDA4AF', textAlign: 'center', padding: '4px 0' }}>
            {error}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          flexShrink: 0,
          marginTop: 16,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          padding: '12px 14px',
          borderRadius: 14,
          border: '1px solid #1E1E2E',
          background: '#0C0C13',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this lecture… (Enter to send, Shift+Enter for new line)"
          rows={1}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: '#CBD5E1',
            caretColor: '#818CF8',
            fontSize: 13.5,
            lineHeight: 1.6,
            fontFamily: 'inherit',
            maxHeight: 120,
            overflowY: 'auto',
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !input.trim()}
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: 10,
            background: submitting || !input.trim() ? '#16151F' : '#6366F1',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: submitting || !input.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
          aria-label="Send"
        >
          <Send size={13} strokeWidth={2} style={{ color: submitting || !input.trim() ? '#3F485C' : '#fff' }} />
        </button>
      </div>
    </div>
  )
}
