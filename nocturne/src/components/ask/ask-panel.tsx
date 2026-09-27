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
  /** Course the current session belongs to, if any. Enables the course-mode toggle. */
  courseId?: string | null
  courseName?: string | null
}

type Mode = 'session' | 'course'

interface CourseSessionPayload {
  sessionId: string
  transcriptText: string
  slides: { pageNumber: number; text: string }[]
}

export function AskPanel({ sessionId, userId, courseId, courseName }: Props) {
  const transcriptWords   = useSessionStore((s) => s.transcriptWords)
  const askConsentGranted = useSessionStore((s) => s.askConsentGranted)
  const grantAskConsent   = useSessionStore((s) => s.grantAskConsent)

  const supabase = useMemo(() => createClient(), [])

  // ── Mode toggle (only relevant when courseId is set) ──────────────────────
  const [mode, setMode] = useState<Mode>('session')

  // ── Session-mode conversation state ──────────────────────────────────────
  const [sessionMessages,  setSessionMessages]  = useState<AskMessage[]>([])
  const [sessionConvoId,   setSessionConvoId]   = useState<string | null>(null)

  // ── Course-mode conversation state ────────────────────────────────────────
  const [courseMessages,   setCourseMessages]   = useState<AskMessage[]>([])
  const [courseConvoId,    setCourseConvoId]     = useState<string | null>(null)
  const [courseConsent,    setCourseConsent]     = useState(false)
  const [courseSessionCount, setCourseSessionCount] = useState(0)

  // ── Shared UI state ───────────────────────────────────────────────────────
  const [showModal,      setShowModal]      = useState(false)
  const [input,          setInput]          = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error,          setError]          = useState<string | null>(null)

  // ── Caches ────────────────────────────────────────────────────────────────
  // Slide texts for the current session (session mode).
  const slideCacheRef = useRef<{ pageNumber: number; text: string }[] | null>(null)
  // Transcript + slides for other sessions in the course (course mode).
  // Keyed by sessionId; current session is never stored here (always from store/slideCacheRef).
  const otherSessionsCache = useRef<Map<string, CourseSessionPayload>>(new Map())

  const bottomRef = useRef<HTMLDivElement | null>(null)

  // ── Decode a stored message row ───────────────────────────────────────────
  const decodeMessage = useCallback(async (mk: CryptoKey, row: {
    id: unknown; role: unknown; content_encrypted: unknown; cited_slide_indices: unknown; created_at: unknown
  }): Promise<AskMessage> => ({
    id:                row.id as string,
    role:              row.role as 'user' | 'assistant',
    content:           await decryptText(mk, row.content_encrypted as string).catch(() => '[decryption failed]'),
    citedSlideIndices: (row.cited_slide_indices as number[]) ?? [],
    createdAt:         row.created_at as string,
  }), [])

  // ── Mount effect: check for existing conversations + load histories ───────
  //
  // Checks session and course (if courseId set) conversation rows in parallel.
  // If a row exists, consent was already granted — skip the gate and load history.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const mk = getMasterKey()

      // Parallel: session conversation + (optional) course conversation + course count
      const [sessionConvoRes, courseConvoRes, courseCountRes] = await Promise.all([
        supabase
          .from('ask_conversations')
          .select('id')
          .eq('session_id', sessionId)
          .maybeSingle(),

        courseId
          ? supabase
              .from('ask_conversations')
              .select('id')
              .eq('course_id', courseId)
              .maybeSingle()
          : Promise.resolve({ data: null }),

        courseId
          ? supabase
              .from('sessions')
              .select('id', { count: 'exact', head: true })
              .eq('course_id', courseId)
          : Promise.resolve({ count: 0 }),
      ])

      if (cancelled) return

      // Course session count (for consent copy)
      const count = (courseCountRes as { count: number | null }).count ?? 0
      setCourseSessionCount(count)

      // ── Session conversation ─────────────────────────────────────────────
      if (sessionConvoRes.data) {
        grantAskConsent()
        setSessionConvoId(sessionConvoRes.data.id as string)

        if (mk) {
          const { data: rows } = await supabase
            .from('ask_messages')
            .select('id, role, content_encrypted, cited_slide_indices, created_at')
            .eq('conversation_id', sessionConvoRes.data.id)
            .order('created_at')

          if (!cancelled && rows?.length) {
            const decrypted = await Promise.all(rows.map((r) => decodeMessage(mk, r)))
            if (!cancelled) setSessionMessages(decrypted)
          }
        }
      }

      // ── Course conversation ──────────────────────────────────────────────
      if (courseConvoRes.data) {
        setCourseConsent(true)
        setCourseConvoId(courseConvoRes.data.id as string)

        if (mk) {
          const { data: rows } = await supabase
            .from('ask_messages')
            .select('id, role, content_encrypted, cited_slide_indices, created_at')
            .eq('conversation_id', courseConvoRes.data.id)
            .order('created_at')

          if (!cancelled && rows?.length) {
            const decrypted = await Promise.all(rows.map((r) => decodeMessage(mk, r)))
            if (!cancelled) setCourseMessages(decrypted)
          }
        }
      }

      if (!cancelled) setLoadingHistory(false)
    })()

    return () => { cancelled = true }
  // sessionId and courseId are stable; supabase + grantAskConsent + decodeMessage are memo-stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, courseId])

  // Auto-scroll to bottom on new messages and typing indicator.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessionMessages, courseMessages, submitting])

  // Clear input when switching modes so there's no stale question.
  useEffect(() => {
    setInput('')
    setError(null)
  }, [mode])

  // ── Fetch + decrypt slide texts for the current session (lazy, cached) ────
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

  // ── Fetch + decrypt all course sessions' content (lazy, per-session cache) ─
  //
  // Current session: transcript from Zustand store (freshest), slides from slideCacheRef.
  // Other sessions: fetch from DB once per session, cache in otherSessionsCache.
  const getCourseContent = useCallback(async (): Promise<CourseSessionPayload[]> => {
    const mk = getMasterKey()
    if (!mk || !courseId) return []

    const { data: courseSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('course_id', courseId)
      .order('created_at')

    if (!courseSessions?.length) return []

    return await Promise.all(
      courseSessions.map(async (s): Promise<CourseSessionPayload> => {
        const sid = s.id as string

        // ── Current session: use in-memory data ─────────────────────────────
        if (sid === sessionId) {
          const slides = await getSlideTexts()
          return {
            sessionId: sid,
            transcriptText: transcriptWords.map((w) => w.word).join(' '),
            slides,
          }
        }

        // ── Other sessions: use per-session cache, else fetch from DB ────────
        const cached = otherSessionsCache.current.get(sid)
        if (cached) return cached

        const [wordRes, slideRes] = await Promise.all([
          supabase
            .from('transcript_words')
            .select('word_encrypted, start_time_ms')
            .eq('session_id', sid)
            .order('start_time_ms'),
          supabase
            .from('slides')
            .select('global_slide_index, text_encrypted')
            .eq('session_id', sid)
            .order('global_slide_index'),
        ])

        const transcriptText = wordRes.data?.length
          ? (await Promise.all(
              wordRes.data.map((w) =>
                decryptText(mk, w.word_encrypted as string).catch(() => ''),
              ),
            )).join(' ')
          : ''

        const slides = slideRes.data?.length
          ? await Promise.all(
              slideRes.data.map(async (r) => ({
                pageNumber: r.global_slide_index as number,
                text: r.text_encrypted
                  ? await decryptText(mk, r.text_encrypted as string).catch(() => '')
                  : '',
              })),
            )
          : []

        const payload: CourseSessionPayload = { sessionId: sid, transcriptText, slides }
        otherSessionsCache.current.set(sid, payload)
        return payload
      }),
    )
  }, [courseId, sessionId, transcriptWords, getSlideTexts, supabase])

  // ── Submit a question ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const question = input.trim()
    if (!question || submitting) return

    const mk = getMasterKey()
    if (!mk) return

    // Active-mode state accessors
    const activeMessages    = mode === 'session' ? sessionMessages : courseMessages
    const setActiveMessages = mode === 'session' ? setSessionMessages : setCourseMessages
    const activeConvoId     = mode === 'session' ? sessionConvoId : courseConvoId
    const setActiveConvoId  = mode === 'session' ? setSessionConvoId : setCourseConvoId

    setInput('')
    setSubmitting(true)
    setError(null)

    // History budget: last 10 messages (≈5 turns), decrypted content already in memory.
    const historyTurns = activeMessages
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    // Optimistic user message
    const tempId  = `temp-${Date.now()}`
    const userMsg: AskMessage = {
      id: tempId, role: 'user', content: question,
      citedSlideIndices: [], createdAt: new Date().toISOString(),
    }
    setActiveMessages((prev) => [...prev, userMsg])

    try {
      let requestBody: Record<string, unknown>

      if (mode === 'course') {
        // Course mode: gather + decrypt all course sessions client-side, then POST.
        const sessions = await getCourseContent()
        requestBody = { question, courseId, sessions, history: historyTurns }
      } else {
        // Session mode: existing single-session behavior.
        const transcriptText = transcriptWords.map((w) => w.word).join(' ')
        const slides = await getSlideTexts()
        requestBody = { question, transcriptText, slides, sessionId, history: historyTurns }
      }

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        const { error: errMsg } = await res.json() as { error: string }
        throw new Error(errMsg ?? `HTTP ${res.status}`)
      }

      const { answer, citedSlideIndices } = await res.json() as {
        answer: string
        citedSlideIndices: number[]
      }

      // Ensure conversation row exists
      let convoId = activeConvoId
      if (!convoId) {
        const insertPayload = mode === 'session'
          ? { session_id: sessionId, user_id: userId }
          : { course_id: courseId, user_id: userId }

        const { data: convo, error: convoErr } = await supabase
          .from('ask_conversations')
          .insert(insertPayload)
          .select('id')
          .single()
        if (convoErr) throw convoErr
        convoId = (convo as { id: string }).id
        setActiveConvoId(convoId)
      }

      // Encrypt before storage — plaintext never touches the DB
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

      const assistantMsg: AskMessage = {
        id:                inserted?.[1]?.id as string ?? `resp-${Date.now()}`,
        role:              'assistant',
        content:           answer,
        citedSlideIndices,
        createdAt:         inserted?.[1]?.created_at as string ?? new Date().toISOString(),
      }

      setActiveMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        { ...userMsg, id: inserted?.[0]?.id as string ?? tempId },
        assistantMsg,
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setActiveMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSubmitting(false)
    }
  }, [
    input, submitting, mode,
    sessionMessages, courseMessages, sessionConvoId, courseConvoId,
    transcriptWords, getSlideTexts, getCourseContent,
    sessionId, courseId, userId, supabase,
  ])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  // ── Consent-allow handler (varies by active mode) ─────────────────────────
  const handleConsentAllow = useCallback(() => {
    if (mode === 'session') {
      grantAskConsent()
    } else {
      setCourseConsent(true)
    }
    setShowModal(false)
  }, [mode, grantAskConsent])

  // ── Resolve display state for the active mode ─────────────────────────────
  const activeMessages    = mode === 'session' ? sessionMessages : courseMessages
  const activeConsent     = mode === 'session' ? askConsentGranted : courseConsent
  const activePlaceholder = mode === 'session'
    ? 'Ask about this lecture… (Enter to send, Shift+Enter for new line)'
    : `Ask across ${courseSessionCount} lecture${courseSessionCount !== 1 ? 's' : ''}… (Enter to send, Shift+Enter for new line)`
  const activeEmptyHint = mode === 'session'
    ? 'Ask anything about this lecture.'
    : courseName
      ? `Ask anything about ${courseName}.`
      : 'Ask anything across this course.'
  const activeEmptySubhint = mode === 'session'
    ? 'Answers are grounded in transcript and slides — citations included.'
    : 'Answers draw from transcripts and slides across all lectures in this course.'

  // ── Resolving initial state — don't flash consent gate for returning users ─
  if (loadingHistory) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontSize: 13, color: '#3F485C' }}>Loading…</p>
      </div>
    )
  }

  // ── Consent gate ──────────────────────────────────────────────────────────
  if (!activeConsent) {
    const buttonLabel = mode === 'session' ? 'Enable Ask' : `Enable Ask for ${courseName ?? 'this course'}`
    const descLabel = mode === 'session'
      ? "Answers grounded in this session's transcript and slides. Requires sending content to a Nocturne server for this query only — not stored in plaintext."
      : `Answers draw from transcripts and slides across ${courseSessionCount} lecture${courseSessionCount !== 1 ? 's' : ''}${courseName ? ` in ${courseName}` : ''}. Requires sending content from multiple sessions to a Nocturne server — request-scoped, not stored in plaintext.`

    return (
      <>
        <AskConsentModal
          open={showModal}
          onAllow={handleConsentAllow}
          onDeny={() => setShowModal(false)}
          mode={mode}
          sessionCount={courseSessionCount}
          courseName={courseName}
        />

        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
          {/* Mode toggle even on consent gate, if course is available */}
          {courseId && (
            <ModeToggle mode={mode} onModeChange={setMode} courseName={courseName} />
          )}
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#16151F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={18} strokeWidth={1.5} style={{ color: '#5B6478' }} />
          </div>
          <div style={{ maxWidth: 340 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', margin: '0 0 6px' }}>
              {mode === 'session' ? 'Ask this lecture anything' : `Ask across ${courseName ?? 'this course'}`}
            </p>
            <p style={{ fontSize: 13, color: '#5B6478', lineHeight: 1.65, margin: '0 0 20px' }}>
              {descLabel}
            </p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="h-9 px-5 rounded-btn bg-indigo-500 text-text-inverse text-body font-medium hover:bg-indigo-600 transition-colors"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Chat interface ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 720, width: '100%', margin: '0 auto' }}>

      <style>{`
        @keyframes askDot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.35; }
          30%            { transform: translateY(-4px); opacity: 1;    }
        }
      `}</style>

      {/* Mode toggle — shown at top only when session belongs to a course */}
      {courseId && (
        <div style={{ flexShrink: 0, marginBottom: 12 }}>
          <ModeToggle mode={mode} onModeChange={setMode} courseName={courseName} />
        </div>
      )}

      {/* Consent modal (shared between modes; content varies by active mode) */}
      <AskConsentModal
        open={showModal}
        onAllow={handleConsentAllow}
        onDeny={() => setShowModal(false)}
        mode={mode}
        sessionCount={courseSessionCount}
        courseName={courseName}
      />

      {/* Message list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        {activeMessages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', paddingTop: 48 }}>
            <p style={{ fontSize: 14, color: '#5B6478' }}>{activeEmptyHint}</p>
            <p style={{ fontSize: 12, color: '#3F485C' }}>{activeEmptySubhint}</p>
          </div>
        )}

        {activeMessages.map((msg) => (
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
                whiteSpace: msg.role === 'user' ? 'pre-wrap' : undefined,
                wordBreak: 'break-word',
              }}
            >
              {msg.role === 'user' ? msg.content : <MarkdownMessage content={msg.content} />}
            </div>

            {/* Slide citation badges — session mode only; course citations are inline text */}
            {mode === 'session' && msg.citedSlideIndices.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {msg.citedSlideIndices.map((n) => (
                  <span
                    key={n}
                    style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 9999,
                      background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
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

        {/* Typing indicator */}
        {submitting && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{
              padding: '11px 14px', borderRadius: '14px 14px 14px 4px',
              background: '#0F0F19', border: '1px solid #1E1E2E',
              display: 'flex', gap: 5, alignItems: 'center',
            }}>
              {([0, 1, 2] as const).map((i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
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
          flexShrink: 0, marginTop: 16,
          display: 'flex', gap: 10, alignItems: 'flex-end',
          padding: '12px 14px', borderRadius: 14,
          border: '1px solid #1E1E2E', background: '#0C0C13',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={activePlaceholder}
          rows={1}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            resize: 'none', color: '#CBD5E1', caretColor: '#818CF8',
            fontSize: 13.5, lineHeight: 1.6, fontFamily: 'inherit',
            maxHeight: 120, overflowY: 'auto',
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !input.trim()}
          style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: 10,
            background: submitting || !input.trim() ? '#16151F' : '#6366F1',
            border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
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

// ── Mode toggle pill ──────────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onModeChange,
  courseName,
}: {
  mode: Mode
  onModeChange: (m: Mode) => void
  courseName?: string | null
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: '#0C0C13',
        border: '1px solid #1E1E2E',
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {(['session', 'course'] as const).map((m) => {
        const active = mode === m
        const label  = m === 'session' ? 'This session' : courseName ?? 'This course'
        return (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            style={{
              padding: '5px 12px',
              borderRadius: 7,
              border: 'none',
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              color: active ? '#E2E8F0' : '#5B6478',
              background: active ? '#16151F' : 'transparent',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
