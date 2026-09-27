'use client'

// Vault-level Ask — cross-session RAG chat.
// PRIVACY CONTRACT: decrypted content is request-scoped only; the server
// discards it after each response.  Nothing is stored in plaintext.
//
// Two-stage retrieval:
//   Stage 1 (client): score sessions by title + course name + keyword terms,
//                     select the top-5 most relevant.
//   Stage 2 (server): full TF-IDF retrieval across those sessions' content,
//                     merged globally before sending to the LLM.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Send, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getMasterKey } from '@/lib/crypto/vault'
import { decryptText } from '@/lib/crypto/decrypt'
import { encryptText } from '@/lib/crypto/encrypt'
import { createClient } from '@/lib/supabase'
import { AskConsentModal } from '@/components/ask/ask-consent-modal'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum sessions sent to the server after Stage 1 scoring. */
const STAGE1_TOP_K = 5

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RawSession {
  id: string
  title_encrypted: string | null
  course_id: string | null
  courses: { name: string } | null
  status: string
  created_at: string
}

interface VaultMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface SessionContent {
  transcriptText: string
  slides: { pageNumber: number; text: string }[]
}

// ── Markdown renderer (matches ask-panel style) ───────────────────────────────

function MarkdownMessage({ content }: { content: string }) {
  return (
    <>
      <style>{`
        .vask-md p           { margin: 0 0 0.55em; line-height: 1.65; }
        .vask-md p:last-child { margin-bottom: 0; }
        .vask-md h1,.vask-md h2,.vask-md h3
                             { color: #E2E8F0; font-weight: 600; margin: 0.8em 0 0.3em; line-height: 1.35; }
        .vask-md h1          { font-size: 15px; }
        .vask-md h2          { font-size: 14px; }
        .vask-md h3          { font-size: 13.5px; }
        .vask-md ul,.vask-md ol
                             { margin: 0.35em 0 0.55em 1.25em; padding: 0;
                               display: flex; flex-direction: column; gap: 0.2em; }
        .vask-md li          { line-height: 1.65; }
        .vask-md li>ul,.vask-md li>ol { margin-top: 0.2em; margin-bottom: 0; }
        .vask-md strong      { color: #E2E8F0; font-weight: 600; }
        .vask-md em          { font-style: italic; }
        .vask-md code        { font-size: 12px; font-family: ui-monospace,SFMono-Regular,Menlo,monospace;
                               background: rgba(255,255,255,0.06); border-radius: 3px; padding: 1px 5px; }
        .vask-md pre         { background: #0A0A12; border: 1px solid #1E1E2E; border-radius: 6px;
                               padding: 10px 12px; overflow-x: auto; margin: 0.5em 0; }
        .vask-md pre code    { background: none; padding: 0; font-size: 12px; }
        .vask-md blockquote  { border-left: 2px solid #2D2B45; margin: 0.4em 0; padding-left: 10px;
                               color: #5B6478; }
        .vask-md table       { border-collapse: collapse; width: 100%; font-size: 12.5px; margin: 0.5em 0; }
        .vask-md th          { background: #12121A; color: #A5B4FC; font-weight: 600;
                               border: 1px solid #1E1E2E; padding: 5px 10px; text-align: left; }
        .vask-md td          { border: 1px solid #1E1E2E; padding: 5px 10px; color: #CBD5E1; }
        .vask-md tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
        .vask-md a           { color: #818CF8; text-decoration: underline; }
        .vask-md hr          { border: none; border-top: 1px solid #1E1E2E; margin: 0.6em 0; }
      `}</style>
      <div className="vask-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </>
  )
}

// ── Stage 1 scoring helpers ───────────────────────────────────────────────────

/** Same tokenizer as the server-side retrieval code. */
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter((w) => w.length > 2 || /^\d+$/.test(w))
}

/**
 * Lightweight relevance score for a session against a question.
 * Uses decrypted title (2× weight), course name (1×), and keyword terms (1×).
 * Returns a raw intersection count — no IDF needed at this stage.
 */
function scoreSessionStage1(
  title:         string,
  courseName:    string | null,
  keywordTerms:  string[],
  questionTokens: Set<string>,
): number {
  let score = 0
  for (const t of tokenize(title)) {
    if (questionTokens.has(t)) score += 2
  }
  if (courseName) {
    for (const t of tokenize(courseName)) {
      if (questionTokens.has(t)) score += 1
    }
  }
  // normalized_term values are already lowercased stripped strings —
  // they'll match question tokens for single-word keywords.
  for (const term of keywordTerms) {
    if (questionTokens.has(term)) score += 1
  }
  return score
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userId:   string
  sessions: RawSession[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VaultAskClient({ userId, sessions }: Props) {
  const supabase = useMemo(() => createClient(), [])

  // ── Conversation state ───────────────────────────────────────────────────
  const [messages,       setMessages]       = useState<VaultMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [vaultConsent,   setVaultConsent]   = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // ── UI state ─────────────────────────────────────────────────────────────
  const [input,      setInput]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [showModal,  setShowModal]  = useState(false)

  // ── Caches ───────────────────────────────────────────────────────────────
  /** Decrypted titles keyed by session ID — populated on mount. */
  const titleMap = useRef<Map<string, string>>(new Map())
  /** normalized_term arrays keyed by session ID — populated lazily on first query. */
  const keywordMap = useRef<Map<string, string[]> | null>(null)
  /** Decrypted transcript + slides keyed by session ID — populated per-query, cached. */
  const contentCache = useRef<Map<string, SessionContent>>(new Map())

  const bottomRef = useRef<HTMLDivElement | null>(null)

  // ── Decode a stored message row ──────────────────────────────────────────
  const decodeMessage = useCallback(async (
    mk: CryptoKey,
    row: { id: unknown; role: unknown; content_encrypted: unknown; created_at: unknown },
  ): Promise<VaultMessage> => ({
    id:        row.id as string,
    role:      row.role as 'user' | 'assistant',
    content:   await decryptText(mk, row.content_encrypted as string).catch(() => '[decryption failed]'),
    createdAt: row.created_at as string,
  }), [])

  // ── Mount: decrypt titles + check for existing conversation ─────────────
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const mk = getMasterKey()

      // Decrypt all session titles in parallel (lightweight).
      const titleEntries = await Promise.all(
        sessions.map(async (s): Promise<[string, string]> => {
          if (!s.title_encrypted || !mk) return [s.id, '']
          try {
            const t = await decryptText(mk, s.title_encrypted)
            return [s.id, t]
          } catch {
            return [s.id, '']
          }
        }),
      )
      if (!cancelled) {
        titleMap.current = new Map(titleEntries)
      }

      // Check for an existing vault-level conversation (proves prior consent).
      const { data: convoRow } = await supabase
        .from('vault_ask_conversations')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (cancelled) return

      if (convoRow) {
        setVaultConsent(true)
        setConversationId(convoRow.id as string)

        if (mk) {
          const { data: rows } = await supabase
            .from('vault_ask_messages')
            .select('id, role, content_encrypted, created_at')
            .eq('conversation_id', convoRow.id)
            .order('created_at')

          if (!cancelled && rows?.length) {
            const decrypted = await Promise.all(rows.map((r) => decodeMessage(mk, r)))
            if (!cancelled) setMessages(decrypted)
          }
        }
      }

      if (!cancelled) setLoadingHistory(false)
    })()

    return () => { cancelled = true }
    // sessions and userId are stable across renders; supabase + decodeMessage are memo-stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Auto-scroll on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, submitting])

  // ── Lazy-load keyword terms (once, on first question) ────────────────────
  const ensureKeywords = useCallback(async (): Promise<Map<string, string[]>> => {
    if (keywordMap.current !== null) return keywordMap.current

    const { data: rows } = await supabase
      .from('keywords')
      .select('session_id, normalized_term')
      .eq('user_id', userId)

    const map = new Map<string, string[]>()
    for (const r of rows ?? []) {
      const sid  = r.session_id as string
      const term = r.normalized_term as string | null
      if (term) {
        const existing = map.get(sid) ?? []
        existing.push(term)
        map.set(sid, existing)
      }
    }

    keywordMap.current = map
    return map
  }, [userId, supabase])

  // ── Fetch + decrypt a single session's content (cached) ─────────────────
  const getSessionContent = useCallback(async (
    sessionId: string,
  ): Promise<SessionContent> => {
    const cached = contentCache.current.get(sessionId)
    if (cached) return cached

    const mk = getMasterKey()
    if (!mk) return { transcriptText: '', slides: [] }

    const [wordRes, slideRes] = await Promise.all([
      supabase
        .from('transcript_words')
        .select('word_encrypted, start_time_ms')
        .eq('session_id', sessionId)
        .order('start_time_ms'),
      supabase
        .from('slides')
        .select('global_slide_index, text_encrypted')
        .eq('session_id', sessionId)
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

    const content: SessionContent = { transcriptText, slides }
    contentCache.current.set(sessionId, content)
    return content
  }, [supabase])

  // ── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const question = input.trim()
    if (!question || submitting) return

    const mk = getMasterKey()
    if (!mk) return

    setInput('')
    setSubmitting(true)
    setError(null)

    // Optimistic user message
    const tempId  = `temp-${Date.now()}`
    const userMsg: VaultMessage = {
      id: tempId, role: 'user', content: question,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      // ── Stage 1: score sessions, select top-K ─────────────────────────────
      const kwMap          = await ensureKeywords()
      const questionTokens = new Set(tokenize(question))

      const scored = sessions.map((s) => ({
        session: s,
        score: scoreSessionStage1(
          titleMap.current.get(s.id) ?? '',
          s.courses?.name ?? null,
          kwMap.get(s.id) ?? [],
          questionTokens,
        ),
      }))
      scored.sort((a, b) => b.score - a.score)

      // If all scores are 0, fall back to the most recent sessions so the LLM
      // can at least tell the user it didn't find relevant content.
      const hasAnyScore = scored.some((x) => x.score > 0)
      const candidates = hasAnyScore
        ? scored.filter((x) => x.score > 0).slice(0, STAGE1_TOP_K)
        : [...sessions]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, STAGE1_TOP_K)
            .map((s) => ({ session: s, score: 0 }))

      // ── Stage 1.5: decrypt content for selected sessions ──────────────────
      const selectedSessions = await Promise.all(
        candidates.map(async ({ session }) => {
          const content = await getSessionContent(session.id)
          return {
            sessionId:    session.id,
            sessionTitle: titleMap.current.get(session.id) ?? '',
            transcriptText: content.transcriptText,
            slides:       content.slides,
          }
        }),
      )

      // History budget: last 10 messages, decrypted content already in memory.
      const historyTurns = messages
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }))

      // ── POST to /api/vault-ask ────────────────────────────────────────────
      const res = await fetch('/api/vault-ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question,
          sessions: selectedSessions,
          history: historyTurns,
        }),
      })

      if (!res.ok) {
        const { error: errMsg } = await res.json() as { error: string }
        throw new Error(errMsg ?? `HTTP ${res.status}`)
      }

      const { answer } = await res.json() as { answer: string }

      // ── Ensure conversation row exists ────────────────────────────────────
      let convoId = conversationId
      if (!convoId) {
        const { data: convo, error: convoErr } = await supabase
          .from('vault_ask_conversations')
          .insert({ user_id: userId })
          .select('id')
          .single()
        if (convoErr) throw convoErr
        convoId = (convo as { id: string }).id
        setConversationId(convoId)
      }

      // ── Persist encrypted messages ─────────────────────────────────────────
      const [encQ, encA] = await Promise.all([
        encryptText(mk, question),
        encryptText(mk, answer),
      ])

      const { data: inserted } = await supabase
        .from('vault_ask_messages')
        .insert([
          { conversation_id: convoId, role: 'user',      content_encrypted: encQ },
          { conversation_id: convoId, role: 'assistant', content_encrypted: encA },
        ])
        .select('id, role, created_at')

      const assistantMsg: VaultMessage = {
        id:        inserted?.[1]?.id as string ?? `resp-${Date.now()}`,
        role:      'assistant',
        content:   answer,
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
  }, [
    input, submitting, messages, conversationId,
    sessions, userId, supabase,
    ensureKeywords, getSessionContent,
  ])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }, [handleSubmit])

  // ── Loading state ────────────────────────────────────────────────────────
  if (loadingHistory) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontSize: 13, color: '#3F485C' }}>Loading…</p>
      </div>
    )
  }

  // ── Consent gate ─────────────────────────────────────────────────────────
  // Shown once per vault-level conversation (until a conversation row exists in DB).
  if (!vaultConsent) {
    return (
      <>
        <AskConsentModal
          open={showModal}
          onAllow={() => { setVaultConsent(true); setShowModal(false) }}
          onDeny={() => setShowModal(false)}
          mode="vault"
        />

        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#16151F',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={18} strokeWidth={1.5} style={{ color: '#5B6478' }} />
          </div>
          <div style={{ maxWidth: 360 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', margin: '0 0 6px' }}>
              Ask across your entire vault
            </p>
            <p style={{ fontSize: 13, color: '#5B6478', lineHeight: 1.65, margin: '0 0 20px' }}>
              Answers draw from transcripts and slides across all your lectures.
              Relevant sessions are selected automatically — no need to choose.
            </p>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="h-9 px-5 rounded-btn bg-indigo-500 text-text-inverse text-body font-medium hover:bg-indigo-600 transition-colors"
            >
              Enable Vault Ask
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Chat interface ────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      maxWidth: 720, width: '100%', margin: '0 auto',
    }}>
      <style>{`
        @keyframes vaskDot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.35; }
          30%            { transform: translateY(-4px); opacity: 1;    }
        }
      `}</style>

      {/* Session count context line */}
      <div style={{ flexShrink: 0, marginBottom: 12 }}>
        <p style={{ fontSize: 11.5, color: '#3F485C', textAlign: 'center' }}>
          Searching across {sessions.length} session{sessions.length !== 1 ? 's' : ''} in your vault
        </p>
      </div>

      {/* Message list */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8,
      }}>
        {messages.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 6, textAlign: 'center', paddingTop: 48,
          }}>
            <p style={{ fontSize: 14, color: '#5B6478' }}>
              Ask anything across your lectures.
            </p>
            <p style={{ fontSize: 12, color: '#3F485C' }}>
              Answers cite the session and slide — e.g. [Glycolysis Lecture, Slide 12].
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 6,
            }}
          >
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? 'rgba(99,102,241,0.18)' : '#0F0F19',
              border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.3)' : '#1E1E2E'}`,
              fontSize: 13.5, color: msg.role === 'user' ? '#C7D2FE' : '#CBD5E1',
              lineHeight: 1.65,
              whiteSpace: msg.role === 'user' ? 'pre-wrap' : undefined,
              wordBreak: 'break-word',
            }}>
              {msg.role === 'user'
                ? msg.content
                : <MarkdownMessage content={msg.content} />}
            </div>
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
                <span key={i} style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  background: '#5B6478',
                  animation: 'vaskDot 1.2s ease infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
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
      <div style={{
        flexShrink: 0, marginTop: 16,
        display: 'flex', gap: 10, alignItems: 'flex-end',
        padding: '12px 14px', borderRadius: 14,
        border: '1px solid #1E1E2E', background: '#0C0C13',
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything across your vault… (Enter to send)"
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
          <Send size={13} strokeWidth={2}
            style={{ color: submitting || !input.trim() ? '#3F485C' : '#fff' }} />
        </button>
      </div>
    </div>
  )
}
