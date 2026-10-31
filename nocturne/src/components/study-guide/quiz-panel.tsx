'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSessionStore } from '@/store/session-store'
import { getMasterKey } from '@/lib/crypto/vault'
import { decryptText } from '@/lib/crypto/decrypt'
import { createClient } from '@/lib/supabase'
import type { Flashcard } from '@/store/session-store'

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'generating' | 'active' | 'complete'
type ZoneFilter = 'all' | 'red' | 'likely'
type QuizMode = 'session' | 'course'

interface QuizQuestion {
  flashcardId: string
  questionText: string
  options: string[]      // shuffled [correct + 3 distractors], length 4
  correctIndex: number
}

interface QuizAttempt {
  questionIdx: number
  selectedIdx: number
  correct: boolean
}

interface Props {
  sessionId: string
  userId: string
  courseId?: string | null
  courseName?: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const QUESTION_COUNTS = [5, 10, 15, 20] as const
const DEFAULT_COUNT   = 10

// Option labels A B C D
const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const

// ── Helpers ────────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

// ── Score donut ring ───────────────────────────────────────────────────────────

function ScoreRing({ correct, total }: { correct: number; total: number }) {
  const R   = 40
  const C   = 2 * Math.PI * R
  const arc = total > 0 ? (correct / total) * C : 0
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: 100, height: 100 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          {arc > 0.5 && (
            <circle
              cx="50" cy="50" r={R} fill="none"
              stroke="#EDEDED" strokeWidth="10"
              strokeDasharray={`${arc} ${C - arc}`}
              strokeDashoffset={0}
              transform="rotate(-90 50 50)"
            />
          )}
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1,
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#EDEDED', lineHeight: 1 }}>{pct}%</span>
          <span style={{ fontSize: 10, color: '#76767B' }}>{correct}/{total}</span>
        </div>
      </div>
      <span style={{ fontSize: 12, color: '#76767B', textAlign: 'center' }}>correct</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function QuizPanel({ sessionId, userId, courseId, courseName }: Props) {
  const sessionFlashcards = useSessionStore((s) => s.flashcards)
  const supabase = useMemo(() => createClient(), [])

  // ── Mode ─────────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<QuizMode>('session')

  // ── All flashcards for the active mode ──────────────────────────────────────
  // For course mode, other sessions' cards are fetched lazily on "Generate Quiz".
  // otherCardsCache stores per-session decrypted cards (never the current session).
  const otherCardsCache = useRef<Map<string, Flashcard[]>>(new Map())
  const [allCards, setAllCards] = useState<Flashcard[]>(sessionFlashcards)

  // Keep session mode in sync with store changes
  useEffect(() => {
    if (mode === 'session') setAllCards(sessionFlashcards)
  }, [mode, sessionFlashcards])

  // ── Quiz generation setup ────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState<Phase>('idle')
  const [zoneFilter,   setZoneFilter]   = useState<ZoneFilter>('all')
  const [questionCount, setQuestionCount] = useState<number>(DEFAULT_COUNT)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // ── Active quiz state ─────────────────────────────────────────────────────────
  const [questions,    setQuestions]    = useState<QuizQuestion[]>([])
  const [currentIdx,   setCurrentIdx]   = useState(0)
  const [attempts,     setAttempts]     = useState<Map<number, QuizAttempt>>(new Map())
  // selectedIdx for the currently displayed question (before auto-advance)
  const [pendingIdx,   setPendingIdx]   = useState<number | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Derived ───────────────────────────────────────────────────────────────────

  const filteredCards = useMemo(() => {
    switch (zoneFilter) {
      case 'red':    return allCards.filter((c) => c.zone === 'red')
      case 'likely': return allCards.filter((c) => c.zone === 'likely')
      default:       return allCards
    }
  }, [allCards, zoneFilter])

  const filterCounts = useMemo(() => ({
    all:    allCards.length,
    red:    allCards.filter((c) => c.zone === 'red').length,
    likely: allCards.filter((c) => c.zone === 'likely').length,
  }), [allCards])

  const answeredCount = attempts.size
  const correctCount  = [...attempts.values()].filter((a) => a.correct).length
  const currentQuestion = questions[currentIdx] ?? null
  const currentAttempt  = attempts.get(currentIdx) ?? null

  // ── Clear advance timer on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => { if (advanceTimer.current) clearTimeout(advanceTimer.current) }
  }, [])

  // Reset quiz state when mode changes
  useEffect(() => {
    setPhase('idle')
    setQuestions([])
    setAttempts(new Map())
    setPendingIdx(null)
    setGenerateError(null)
    setCurrentIdx(0)
    if (mode === 'session') setAllCards(sessionFlashcards)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch course flashcards ───────────────────────────────────────────────────
  const fetchCourseCards = useCallback(async (): Promise<Flashcard[]> => {
    const mk = getMasterKey()
    if (!mk || !courseId) return []

    const { data: sessions } = await supabase
      .from('sessions').select('id').eq('course_id', courseId).order('created_at')
    if (!sessions?.length) return []

    const allDecrypted: Flashcard[] = [...sessionFlashcards] // current session already decrypted

    await Promise.all(
      sessions
        .map((s) => s.id as string)
        .filter((sid) => sid !== sessionId) // skip current — already in store
        .map(async (sid) => {
          // Check cache first
          if (otherCardsCache.current.has(sid)) {
            allDecrypted.push(...otherCardsCache.current.get(sid)!)
            return
          }

          const { data: rows } = await supabase
            .from('flashcards')
            .select('id, front_encrypted, back_encrypted, zone, slide_index, keyword_id, keywords(term_encrypted)')
            .eq('session_id', sid)
            .order('created_at')

          if (!rows?.length) return

          const cards = await Promise.all(
            rows.map(async (r): Promise<Flashcard> => {
              // Decrypt keyword term for keywordTerm field (use front if unavailable)
              let keywordTerm = ''
              const kwTermEnc = (r.keywords as unknown as { term_encrypted: string } | null)?.term_encrypted
              if (kwTermEnc) {
                keywordTerm = await decryptText(mk, kwTermEnc).catch(() => '')
              }
              const front = await decryptText(mk, r.front_encrypted as string).catch(() => '')
              const back  = await decryptText(mk, r.back_encrypted as string).catch(() => '')
              return {
                id: r.id as string,
                keywordTerm: keywordTerm || front,
                front,
                back,
                slideIndex: r.slide_index as number | null,
                zone: r.zone as 'red' | 'likely',
              }
            }),
          )

          otherCardsCache.current.set(sid, cards)
          allDecrypted.push(...cards)
        }),
    )

    return allDecrypted
  }, [courseId, sessionId, sessionFlashcards, supabase])

  // ── Generate quiz ─────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (phase === 'generating') return

    setGenerateError(null)
    setPhase('generating')
    setQuestions([])
    setAttempts(new Map())
    setPendingIdx(null)
    setCurrentIdx(0)

    try {
      // 1. Get cards for the active mode
      let sourceCards: Flashcard[]
      if (mode === 'course') {
        sourceCards = await fetchCourseCards()
        setAllCards(sourceCards)
      } else {
        sourceCards = sessionFlashcards
      }

      // 2. Apply zone filter and pick up to questionCount cards
      const filtered = (() => {
        switch (zoneFilter) {
          case 'red':    return sourceCards.filter((c) => c.zone === 'red')
          case 'likely': return sourceCards.filter((c) => c.zone === 'likely')
          default:       return sourceCards
        }
      })()

      if (filtered.length < 4) {
        setGenerateError('Need at least 4 flashcards in this filter to generate a quiz.')
        setPhase('idle')
        return
      }

      // Shuffle before capping so we get variety across quizzes
      const shuffled = shuffleArray(filtered)
      const selected = shuffled.slice(0, questionCount)

      // 3. Call the API with pre-decrypted cards
      const requestBody = {
        sessionId: mode === 'session' ? sessionId : undefined,
        courseId:  mode === 'course'  ? courseId  : undefined,
        cards: selected.map((c) => ({ id: c.id, front: c.front, back: c.back, zone: c.zone })),
      }

      const res = await fetch('/api/generate/quiz', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        const { error: errMsg } = await res.json() as { error: string }
        throw new Error(errMsg ?? `HTTP ${res.status}`)
      }

      const { results } = await res.json() as {
        results: { id: string; question: string; distractors: string[] }[]
      }

      // 4. Build QuizQuestion array: shuffle options, record correctIndex
      const cardMap = new Map(selected.map((c) => [c.id, c]))
      const generatedQuestions: QuizQuestion[] = []

      for (const r of results) {
        const card = cardMap.get(r.id)
        if (!card || !r.question || r.distractors?.length < 3) continue

        const unshuffled = [card.back, r.distractors[0]!, r.distractors[1]!, r.distractors[2]!]
        const shuffledOptions = shuffleArray(unshuffled)
        const correctIndex = shuffledOptions.indexOf(card.back)

        generatedQuestions.push({
          flashcardId:  card.id,
          questionText: r.question,
          options:       shuffledOptions,
          correctIndex,
        })
      }

      if (generatedQuestions.length === 0) {
        setGenerateError('Quiz generation failed — no valid questions returned.')
        setPhase('idle')
        return
      }

      setQuestions(generatedQuestions)
      setPhase('active')
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Generation failed')
      setPhase('idle')
    }
  }, [phase, mode, sessionFlashcards, fetchCourseCards, zoneFilter, questionCount, sessionId, courseId])

  // ── Answer selection ──────────────────────────────────────────────────────────
  const handleAnswer = useCallback((selectedIdx: number) => {
    if (!currentQuestion || currentAttempt !== null || pendingIdx !== null) return

    const correct = selectedIdx === currentQuestion.correctIndex
    const attempt: QuizAttempt = { questionIdx: currentIdx, selectedIdx, correct }

    setPendingIdx(selectedIdx)
    setAttempts((prev) => new Map(prev).set(currentIdx, attempt))

    // Fire-and-forget: record in DB
    supabase.from('quiz_attempts').insert({
      user_id:         userId,
      flashcard_id:    currentQuestion.flashcardId,
      session_id:      mode === 'session' ? sessionId : null,
      course_id:       mode === 'course'  ? courseId  : null,
      selected_option: currentQuestion.options[selectedIdx],
      correct,
    }).then(() => {})

    // Auto-advance after 900ms — gives time to see the result before moving on
    advanceTimer.current = setTimeout(() => {
      setPendingIdx(null)
      if (currentIdx + 1 >= questions.length) {
        setPhase('complete')
      } else {
        setCurrentIdx((i) => i + 1)
      }
    }, 900)
  }, [currentQuestion, currentAttempt, pendingIdx, currentIdx, questions.length, userId, sessionId, courseId, mode, supabase])

  // ── Restart helpers ──────────────────────────────────────────────────────────
  const handleRetryWrong = useCallback(() => {
    const wrongIdxs = [...attempts.entries()]
      .filter(([, a]) => !a.correct)
      .map(([i]) => i)
    if (wrongIdxs.length === 0) return
    const wrongQuestions = wrongIdxs.map((i) => questions[i]!).filter(Boolean)
    setQuestions(wrongQuestions)
    setAttempts(new Map())
    setPendingIdx(null)
    setCurrentIdx(0)
    setPhase('active')
  }, [attempts, questions])

  const handleNewQuiz = useCallback(() => {
    setPhase('idle')
    setQuestions([])
    setAttempts(new Map())
    setPendingIdx(null)
    setCurrentIdx(0)
  }, [])

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (sessionFlashcards.length === 0 && mode === 'session') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontSize: 13, color: '#76767B' }}>No flashcards yet — add a study guide or score slides first.</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', gap: 0, width: '100%', minHeight: 560, height: '100%' }}>

      {/* ── LEFT PANE: config + question list ─────────────────────────────── */}
      <div style={{
        width: 264, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', gap: 0, paddingRight: 20,
      }}>

        {/* Mode toggle — only when courseId is available */}
        {courseId && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'inline-flex', background: '#0C0C0D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, padding: 3, gap: 2 }}>
              {(['session', 'course'] as const).map((m) => {
                const active = mode === m
                const label  = m === 'session' ? 'Session' : courseName ?? 'Course'
                return (
                  <button key={m} type="button"
                    onClick={() => setMode(m)}
                    style={{
                      padding: '4px 10px', borderRadius: 2, border: 'none',
                      fontSize: 11.5, fontWeight: active ? 600 : 400,
                      color: active ? '#EDEDED' : '#76767B',
                      background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                      cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >{label}</button>
                )
              })}
            </div>
          </div>
        )}

        {/* Section header */}
        <div style={{ padding: '0 0 12px 0' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#76767B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {phase === 'idle' || phase === 'generating' ? 'Configure quiz' : 'Questions'}
          </span>
        </div>

        {/* Idle: filter + count picker */}
        {(phase === 'idle' || phase === 'generating') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Zone filter pills */}
            <div>
              <span style={{ fontSize: 11, color: '#76767B', display: 'block', marginBottom: 8 }}>Zone filter</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(['all', 'red', 'likely'] as ZoneFilter[]).map((f) => {
                  const labels: Record<ZoneFilter, string> = { all: 'All', red: 'Red Zone', likely: 'Likely' }
                  const active = zoneFilter === f
                  return (
                    <button key={f} type="button"
                      onClick={() => setZoneFilter(f)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        height: 26, padding: '0 10px', borderRadius: 9999,
                        border: active ? '1px solid rgba(255,59,48,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        background: active ? 'rgba(255,59,48,0.12)' : '#0C0C0D',
                        color: active ? '#FF3B30' : '#76767B',
                        fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {labels[f]}
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: active ? '#FF3B30' : '#76767B',
                        background: active ? 'rgba(255,59,48,0.2)' : 'rgba(255,255,255,0.06)',
                        borderRadius: 9999, padding: '1px 5px',
                      }}>
                        {filterCounts[f]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Question count */}
            <div>
              <span style={{ fontSize: 11, color: '#76767B', display: 'block', marginBottom: 8 }}>Questions</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {QUESTION_COUNTS.map((n) => {
                  const active  = questionCount === n
                  const avail   = filterCounts[zoneFilter]
                  const enabled = avail >= 4 && n <= avail
                  return (
                    <button key={n} type="button"
                      onClick={() => { if (enabled) setQuestionCount(n) }}
                      style={{
                        width: 42, height: 30, borderRadius: 2,
                        border: active ? '1px solid rgba(255,59,48,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        background: active ? 'rgba(255,59,48,0.12)' : '#0C0C0D',
                        color: active ? '#FF3B30' : enabled ? '#76767B' : '#4A4A4E',
                        fontSize: 12, fontWeight: active ? 600 : 400,
                        cursor: enabled ? 'pointer' : 'not-allowed',
                        opacity: enabled ? 1 : 0.4,
                        transition: 'all 0.15s',
                      }}
                    >{n}</button>
                  )
                })}
              </div>
            </div>

            {/* Generate button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={phase === 'generating' || filterCounts[zoneFilter] < 4}
              style={{
                height: 40, padding: '0 16px', borderRadius: 2,
                border: (phase === 'generating' || filterCounts[zoneFilter] < 4) ? '1px solid rgba(255,255,255,0.08)' : 'none',
                background: phase === 'generating' || filterCounts[zoneFilter] < 4
                  ? '#0C0C0D' : '#FF3B30',
                color: phase === 'generating' || filterCounts[zoneFilter] < 4
                  ? '#4A4A4E' : '#0A0A0A',
                fontSize: 13, fontWeight: 600,
                cursor: phase === 'generating' || filterCounts[zoneFilter] < 4
                  ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {phase === 'generating'
                ? 'Generating…'
                : filterCounts[zoneFilter] < 4
                  ? 'Not enough cards'
                  : 'Generate Quiz'}
            </button>

            {generateError && (
              <p style={{ fontSize: 12, color: '#FF3B30', lineHeight: 1.5, margin: 0 }}>{generateError}</p>
            )}
          </div>
        )}

        {/* Active / complete: question navigation list */}
        {(phase === 'active' || phase === 'complete') && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 8 }}>
            {questions.map((q, idx) => {
              const attempt = attempts.get(idx)
              const isActive = idx === currentIdx && phase === 'active'
              const statusColor = !attempt ? 'rgba(255,255,255,0.14)' : attempt.correct ? '#EDEDED' : '#FF3B30'

              return (
                <button
                  key={q.flashcardId + idx}
                  type="button"
                  onClick={() => { if (phase === 'active') { setCurrentIdx(idx); setPendingIdx(null) } }}
                  style={{
                    display: 'block', textAlign: 'left', padding: '9px 10px 9px 12px',
                    borderRadius: 2, cursor: phase === 'active' ? 'pointer' : 'default',
                    border: isActive ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                    background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                    borderLeft: `3px solid ${isActive ? statusColor : 'transparent'}`,
                    transition: 'all 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Status icon */}
                    <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                      border: `1.5px solid ${statusColor}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {attempt ? (
                        attempt.correct
                          ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#EDEDED" strokeWidth="2" strokeLinecap="round"><path d="M2 6 L5 9 L10 3" /></svg>
                          : <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"><path d="M3 3 L9 9 M9 3 L3 9" /></svg>
                      ) : (
                        <span style={{ fontSize: 9, color: '#76767B', fontWeight: 600 }}>{idx + 1}</span>
                      )}
                    </span>
                    <span style={{ fontSize: 12, color: isActive ? '#EDEDED' : '#76767B', lineHeight: 1.35,
                      overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {q.questionText}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MIDDLE PANE: question player ──────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '0 32px' }}>
        {phase === 'idle' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 2, background: '#0C0C0D',
              border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#76767B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#EDEDED', margin: '0 0 6px' }}>Generate a quiz</p>
              <p style={{ fontSize: 13, color: '#76767B', lineHeight: 1.65, margin: 0, maxWidth: 320 }}>
                Choose a filter and question count, then click Generate Quiz.
                Questions are created from your flashcard deck using AI.
              </p>
            </div>
          </div>
        )}

        {phase === 'generating' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <style>{`
              @keyframes quizSpin { to { transform: rotate(360deg); } }
            `}</style>
            <div style={{ width: 36, height: 36, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.14)', borderTopColor: '#FF3B30',
              animation: 'quizSpin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 13, color: '#76767B', margin: 0 }}>Generating questions…</p>
          </div>
        )}

        {phase === 'active' && currentQuestion && (
          <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: '#76767B', fontFamily: 'var(--font-mono)' }}>
                Question {currentIdx + 1} / {questions.length}
              </span>
              <span style={{ fontSize: 12, color: '#76767B' }}>
                {answeredCount === 0 ? 'Select an answer' : `${correctCount} correct so far`}
              </span>
            </div>

            {/* Question text */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIdx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] as [number, number, number, number] } }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
              >
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 17, fontWeight: 600, color: '#EDEDED', margin: '0 0 4px', lineHeight: 1.45 }}>
                    {currentQuestion.questionText}
                  </p>
                </div>

                {/* Answer options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {currentQuestion.options.map((opt, optIdx) => {
                    const isSelected = pendingIdx === optIdx || currentAttempt?.selectedIdx === optIdx
                    const isCorrect  = optIdx === currentQuestion.correctIndex
                    const isAnswered = pendingIdx !== null || currentAttempt !== null

                    let borderColor = 'rgba(255,255,255,0.08)'
                    let bgColor     = '#0C0C0D'
                    let textColor   = '#9A9A9F'
                    let labelColor  = '#76767B'

                    if (isAnswered && isCorrect) {
                      borderColor = 'rgba(255,255,255,0.3)'; bgColor = 'rgba(255,255,255,0.06)'; textColor = '#EDEDED'; labelColor = '#EDEDED'
                    } else if (isAnswered && isSelected && !isCorrect) {
                      borderColor = 'rgba(255,59,48,0.45)'; bgColor = 'rgba(255,59,48,0.08)'; textColor = '#FF3B30'; labelColor = '#FF3B30'
                    }

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleAnswer(optIdx)}
                        disabled={isAnswered}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          padding: '13px 16px', borderRadius: 2, textAlign: 'left',
                          border: `1px solid ${borderColor}`, background: bgColor,
                          cursor: isAnswered ? 'default' : 'pointer',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isAnswered) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.14)'
                        }}
                        onMouseLeave={(e) => {
                          if (!isAnswered) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'
                        }}
                      >
                        <span style={{
                          flexShrink: 0, width: 24, height: 24, borderRadius: 2,
                          border: `1.5px solid ${labelColor}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: labelColor,
                          lineHeight: 1,
                        }}>
                          {OPTION_LABELS[optIdx]}
                        </span>
                        <span style={{ fontSize: 13.5, color: textColor, lineHeight: 1.6, paddingTop: 2 }}>
                          {opt}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Skip link — navigates without recording attempt */}
                {pendingIdx === null && currentAttempt === null && (
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentIdx + 1 >= questions.length) setPhase('complete')
                        else setCurrentIdx((i) => i + 1)
                      }}
                      style={{ fontSize: 12, color: '#76767B', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Skip →
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Complete */}
        {phase === 'complete' && (
          <QuizComplete
            questions={questions}
            attempts={attempts}
            onRetryWrong={handleRetryWrong}
            onNewQuiz={handleNewQuiz}
          />
        )}
      </div>

      {/* ── RIGHT PANE: score ring + zone breakdown ───────────────────────── */}
      <div style={{
        width: 200, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.08)',
        paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {(phase === 'active' || phase === 'complete') ? (
          <>
            <ScoreRing correct={correctCount} total={answeredCount} />

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />

              {/* Per-stat breakdown */}
              {[
                { label: 'Correct',     value: correctCount,              color: '#EDEDED' },
                { label: 'Wrong',       value: answeredCount - correctCount, color: '#FF3B30' },
                { label: 'Unanswered',  value: questions.length - answeredCount, color: '#76767B' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#76767B' }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#9A9A9F' }}>{value}</span>
                </div>
              ))}

              {phase === 'complete' && (
                <>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginTop: 6 }} />
                  <p style={{ fontSize: 11, color: '#76767B', lineHeight: 1.55, margin: 0 }}>
                    Quiz results are tracked separately from flashcard reviews.
                  </p>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#76767B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>About Quiz</span>
            <p style={{ fontSize: 12, color: '#76767B', lineHeight: 1.65, margin: 0 }}>
              Multiple-choice questions generated from your flashcard deck.
              Wrong answers are grounded in your lecture content — not random.
            </p>
            <p style={{ fontSize: 12, color: '#76767B', lineHeight: 1.65, margin: 0 }}>
              Quiz performance is tracked independently from spaced-repetition reviews.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Completion Screen ──────────────────────────────────────────────────────────

function QuizComplete({
  questions,
  attempts,
  onRetryWrong,
  onNewQuiz,
}: {
  questions: QuizQuestion[]
  attempts: Map<number, QuizAttempt>
  onRetryWrong: () => void
  onNewQuiz: () => void
}) {
  const correctCount = [...attempts.values()].filter((a) => a.correct).length
  const wrongCount   = [...attempts.values()].filter((a) => !a.correct).length
  const skipped      = questions.length - attempts.size
  const pct          = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0

  const verdict = pct >= 80 ? 'Great work!' : pct >= 60 ? 'Keep studying!' : 'More review needed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.25 } }}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', gap: 24, padding: '0 24px', maxWidth: 440, margin: '0 auto',
      }}
    >
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: '#EDEDED', margin: '0 0 6px' }}>Quiz complete</p>
        <p style={{ fontSize: 15, color: '#9A9A9F', margin: '0 0 12px', fontWeight: 600 }}>{verdict}</p>
        <p style={{ fontSize: 14, color: '#76767B', margin: 0, lineHeight: 1.6 }}>
          <span style={{ color: '#EDEDED' }}>{correctCount} correct</span>
          {wrongCount > 0 && <> · <span style={{ color: '#FF3B30' }}>{wrongCount} wrong</span></>}
          {skipped > 0 && <> · {skipped} skipped</>}
          {' '}out of {questions.length} questions
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        {wrongCount > 0 && (
          <button type="button" onClick={onRetryWrong} style={{
            height: 42, borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.08)', background: '#0C0C0D',
            color: '#9A9A9F', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Retry wrong ({wrongCount})
          </button>
        )}
        <button type="button" onClick={onNewQuiz} style={{
          height: 42, borderRadius: 2,
          border: 'none', background: '#FF3B30',
          color: '#0A0A0A', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          New quiz
        </button>
      </div>
    </motion.div>
  )
}
