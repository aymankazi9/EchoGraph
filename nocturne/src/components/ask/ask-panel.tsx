'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Send, BookOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

// ── Markdown renderer for assistant messages ──────────────────────────────────
//
// react-markdown + remark-gfm gives us bold, italic, headers, bullet/ordered
// lists, tables, and strikethrough out of the box.  Custom component overrides
// apply inline styles so the rendered output matches the chat bubble's existing
// typography instead of the browser's unstyled defaults.
//
// [Slide N] citation tokens are left in the markdown text — the model emits
// them as literal text so they render as plain inline text, which is correct.
// The coloured badge row below each bubble is driven by citedSlideIndices (a
// separate array extracted by the server), not by parsing the rendered HTML.

function MarkdownMessage({ content }: { content: string }) {
  return (
    <>
      <style>{`
        .ask-md p          { margin: 0 0 0.55em; line-height: 1.65; }
        .ask-md p:last-child { margin-bottom: 0; }
        .ask-md h1,
        .ask-md h2,
        .ask-md h3         { color: #E2E8F0; font-weight: 600; margin: 0.8em 0 0.3em; line-height: 1.35; }
        .ask-md h1         { font-size: 15px; }
        .ask-md h2         { font-size: 14px; }
        .ask-md h3         { font-size: 13.5px; }
        .ask-md ul,
        .ask-md ol         { margin: 0.35em 0 0.55em 1.25em; padding: 0; display: flex; flex-direction: column; gap: 0.2em; }
        .ask-md li         { line-height: 1.65; }
        .ask-md li > ul,
        .ask-md li > ol    { margin-top: 0.2em; margin-bottom: 0; }
        .ask-md strong     { color: #E2E8F0; font-weight: 600; }
        .ask-md em         { font-style: italic; }
        .ask-md del        { opacity: 0.55; }
        .ask-md code       { font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                             background: rgba(255,255,255,0.06); border-radius: 3px; padding: 1px 5px; }
        .ask-md pre        { background: #0A0A12; border: 1px solid #1E1E2E; border-radius: 6px;
                             padding: 10px 12px; overflow-x: auto; margin: 0.5em 0; }
        .ask-md pre code   { background: none; padding: 0; font-size: 12px; }
        .ask-md blockquote { border-left: 2px solid #2D2B45; margin: 0.4em 0; padding-left: 10px;
                             color: #5B6478; }
        .ask-md table      { border-collapse: collapse; width: 100%; font-size: 12.5px; margin: 0.5em 0; }
        .ask-md th         { background: #12121A; color: #A5B4FC; font-weight: 600;
                             border: 1px solid #1E1E2E; padding: 5px 10px; text-align: left; }
        .ask-md td         { border: 1px solid #1E1E2E; padding: 5px 10px; color: #CBD5E1; }
        .ask-md tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
        .ask-md a          { color: #818CF8; text-decoration: underline; }
        .ask-md hr         { border: none; border-top: 1px solid #1E1E2E; margin: 0.6em 0; }
      `}</style>
      <div className="ask-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </>
  )
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

  const [showModal,      setShowModal]      = useState(false)
  const [messages,       setMessages]       = useState<AskMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input,          setInput]          = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error,          setError]          = useState<string | null>(null)

  // Slide texts fetched once after consent — pageNumber carries global_slide_index
  const slideCacheRef = useRef<{ pageNumber: number; text: string }[] | null>(null)
  const bottomRef     = useRef<HTMLDivElement | null>(null)

  // ── Single mount effect: check for an existing conversation, then load ───
  //
  // A row in ask_conversations can only exist if the user previously completed
  // the full consent → send flow, so its presence is a reliable proxy for
  // "consent was already granted".  We handle both outcomes in one async pass:
  //
  //   row found  → grant consent in store + load history (no modal shown)
  //   no row     → grant nothing; consent gate renders and waits for the user
  //
  // This replaces the previous two-effect waterfall (one gated on askConsentGranted
  // firing the other) so there is exactly one code path that queries the DB and
  // resolves all state.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const { data: convo } = await supabase
        .from('ask_conversations')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle()

      if (cancelled) return

      if (!convo) {
        // No prior conversation — show the consent gate, nothing else to load.
        setLoadingHistory(false)
        return
      }

      // Conversation exists → user already consented.  Grant consent in the
      // store so the chat UI renders, then immediately load the message history
      // — both resolved in this same async function, not via a second effect.
      grantAskConsent()
      setConversationId(convo.id as string)

      const mk = getMasterKey()
      if (!mk) { setLoadingHistory(false); return }

      const { data: rows } = await supabase
        .from('ask_messages')
        .select('id, role, content_encrypted, cited_slide_indices, created_at')
        .eq('conversation_id', convo.id)
        .order('created_at')

      if (cancelled) return

      if (rows && rows.length > 0) {
        const decrypted: AskMessage[] = await Promise.all(
          rows.map(async (r) => ({
            id:                r.id as string,
            role:              r.role as 'user' | 'assistant',
            content:           await decryptText(mk, r.content_encrypted as string).catch(() => '[decryption failed]'),
            citedSlideIndices: (r.cited_slide_indices as number[]) ?? [],
            createdAt:         r.created_at as string,
          })),
        )
        if (!cancelled) setMessages(decrypted)
      }

      setLoadingHistory(false)
    })()

    return () => { cancelled = true }
  // sessionId is stable for the lifetime of this panel; supabase client is
  // memo-stable.  grantAskConsent is a store action reference that never changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Auto-scroll to bottom on new messages and when the typing indicator appears.
  // submitting is included so the indicator scrolls into view even if React
  // doesn't batch the setMessages + setSubmitting renders (React 18 normally does).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, submitting])

  // ── Fetch + decrypt slide texts (lazy, cached) ───────────────────────────
  const getSlideTexts = useCallback(async (): Promise<{ pageNumber: number; text: string }[]> => {
    if (slideCacheRef.current !== null) return slideCacheRef.current

    const mk = getMasterKey()
    if (!mk) { slideCacheRef.current = []; return [] }

    const { data: rows } = await supabase
      .from('slides')
      .select('global_slide_index, text_encrypted')
      .eq('session_id', sessionId)
      .order('global_slide_index')

    const slides = rows
      ? await Promise.all(
          rows.map(async (r) => ({
            pageNumber: r.global_slide_index as number,
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

    // Capture history BEFORE the optimistic add so the current question is not
    // included.  Budget: last 10 messages (≈5 user/assistant pairs), oldest first.
    // Decrypted content is already in memory — no extra DB round-trip needed.
    const historyTurns = messages
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

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
        body: JSON.stringify({ question, transcriptText, slides, sessionId, history: historyTurns }),
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
  }, [input, submitting, messages, transcriptWords, getSlideTexts, sessionId, conversationId, userId, supabase])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  // ── Still resolving — don't flash the consent gate for returning users ──
  // loadingHistory starts true and is cleared by the mount effect once it knows
  // whether a prior conversation exists.  Show nothing meaningful until then.
  if (loadingHistory) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontSize: 13, color: '#3F485C' }}>Loading…</p>
      </div>
    )
  }

  // ── No prior conversation confirmed — show consent gate ──────────────────
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

      {/* Typing-indicator animation — scoped to this panel */}
      <style>{`
        @keyframes askDot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.35; }
          30%            { transform: translateY(-4px); opacity: 1;    }
        }
      `}</style>

      {/* Message list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        {messages.length === 0 && (
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
                // user messages keep pre-wrap for literal newlines; assistant
                // messages are rendered via react-markdown so no pre-wrap needed
                whiteSpace: msg.role === 'user' ? 'pre-wrap' : undefined,
                wordBreak: 'break-word',
              }}
            >
              {msg.role === 'user' ? msg.content : <MarkdownMessage content={msg.content} />}
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

        {/* Typing indicator — shown immediately on send, removed on response */}
        {submitting && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div
              style={{
                padding: '11px 14px',
                borderRadius: '14px 14px 14px 4px',
                background: '#0F0F19',
                border: '1px solid #1E1E2E',
                display: 'flex',
                gap: 5,
                alignItems: 'center',
              }}
            >
              {([0, 1, 2] as const).map((i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#5B6478',
                    animation: 'askDot 1.2s ease infinite',
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

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
