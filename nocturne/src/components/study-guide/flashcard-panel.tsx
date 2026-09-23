'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSessionStore } from '@/store/session-store'
import { useNotificationStore } from '@/store/notification-store'
import { createClient } from '@/lib/supabase'
import { computeNextReview, computeMastery, type Rating } from '@/lib/scoring/srs'
import { getMasterKey } from '@/lib/crypto/vault'
import { encryptText } from '@/lib/crypto/encrypt'
import { normalizeTerm } from '@/lib/rescore/keyword-diff'
import type { Flashcard } from '@/store/session-store'

// ── Types ──────────────────────────────────────────────────────────────────────

type Filter = 'all' | 'red' | 'likely' | 'needs_work'

// Now includes `rating` so the Needs-work filter can check last rating from DB.
interface LatestReview {
  easeFactor: number
  intervalDays: number
  dueAt: string
  rating: Rating
}

interface Props {
  sessionTitle: string
  sessionId: string
  userId: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MASTERY_COLORS = {
  new:      { bar: '#2D2B45', label: '#3F485C', dot: '#4B5563' },
  learning: { bar: '#92400E', label: '#FDE68A', dot: '#F59E0B' },
  mastered: { bar: '#064E3B', label: '#6EE7B7', dot: '#10B981' },
}

const RATINGS: { rating: Rating; label: string; color: string; border: string; bg: string }[] = [
  { rating: 'again', label: 'Again', color: '#FDA4AF', border: 'rgba(251,113,133,0.35)', bg: 'rgba(251,113,133,0.08)' },
  { rating: 'hard',  label: 'Hard',  color: '#FDE68A', border: 'rgba(251,191,36,0.35)',  bg: 'rgba(251,191,36,0.08)'  },
  { rating: 'good',  label: 'Good',  color: '#A5B4FC', border: 'rgba(99,102,241,0.35)',  bg: 'rgba(99,102,241,0.08)'  },
  { rating: 'easy',  label: 'Easy',  color: '#6EE7B7', border: 'rgba(16,185,129,0.35)',  bg: 'rgba(16,185,129,0.08)'  },
]

const ZONE_COLORS: Record<string, { badge: string; text: string; dot: string }> = {
  red:    { badge: 'rgba(251,113,133,0.1)', text: '#FDA4AF', dot: '#EF4444' },
  likely: { badge: 'rgba(99,102,241,0.1)',  text: '#A5B4FC', dot: '#6366F1' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isNeedsWork(fc: Flashcard, reviewMap: Record<string, LatestReview>): boolean {
  const r = reviewMap[fc.id]
  // No reviews = new card = needs work. Last rating Again/Hard = needs work.
  return !r || r.rating === 'again' || r.rating === 'hard'
}

function getFiltered(
  cards: Flashcard[],
  filter: Filter,
  reviewMap: Record<string, LatestReview>,
): Flashcard[] {
  switch (filter) {
    case 'red':        return cards.filter(fc => fc.zone === 'red')
    case 'likely':     return cards.filter(fc => fc.zone === 'likely')
    case 'needs_work': return cards.filter(fc => isNeedsWork(fc, reviewMap))
    default:           return cards
  }
}

// ── Donut Ring ─────────────────────────────────────────────────────────────────
//
// SVG arc formula: dasharray = `${arc} ${C - arc}` (period = C) ensures arcs
// don't bleed. dashoffset = -startPos shifts the arc clockwise by startPos.
// rotate(-90) makes position 0 the 12 o'clock point.

function DonutRing({ mastered, learning, total }: { mastered: number; learning: number; total: number }) {
  const R = 44
  const C = 2 * Math.PI * R
  const masteredArc = total > 0 ? (mastered / total) * C : 0
  const learningArc = total > 0 ? (learning / total) * C : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: 112, height: 112 }}>
        <svg width="112" height="112" viewBox="0 0 112 112" style={{ overflow: 'visible' }}>
          {/* Track */}
          <circle cx="56" cy="56" r={R} fill="none" stroke="#16151F" strokeWidth="11" />
          {/* Learning arc — starts immediately after mastered arc */}
          {learningArc > 0.5 && (
            <circle
              cx="56" cy="56" r={R} fill="none"
              stroke="#F59E0B" strokeWidth="11"
              strokeDasharray={`${learningArc} ${C - learningArc}`}
              strokeDashoffset={-masteredArc}
              transform="rotate(-90 56 56)"
            />
          )}
          {/* Mastered arc — starts at 12 o'clock */}
          {masteredArc > 0.5 && (
            <circle
              cx="56" cy="56" r={R} fill="none"
              stroke="#10B981" strokeWidth="11"
              strokeDasharray={`${masteredArc} ${C - masteredArc}`}
              strokeDashoffset={0}
              transform="rotate(-90 56 56)"
            />
          )}
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 1,
        }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#E2E8F0', lineHeight: 1 }}>{mastered}</span>
          <span style={{ fontSize: 11, color: '#3F485C' }}>of {total}</span>
        </div>
      </div>
      <span style={{ fontSize: 12, color: '#64748B', textAlign: 'center' }}>keywords mastered</span>
    </div>
  )
}

// ── Mastery bar for sidebar cards ──────────────────────────────────────────────

function MasteryBar({ intervalDays }: { intervalDays: number | undefined }) {
  const { progress, state } = computeMastery(intervalDays)
  const stateLabel = state === 'new' ? 'New' : state === 'mastered' ? 'Mastered' : 'Learning'
  const colors = MASTERY_COLORS[state]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 10, color: colors.label }}>{stateLabel}</span>
      </div>
      <div style={{ height: 2, borderRadius: 9999, background: '#16151F', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 9999,
          background: colors.dot,
          width: `${progress * 100}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function FlashcardPanel({ sessionTitle, sessionId, userId }: Props) {
  const flashcards = useSessionStore((s) => s.flashcards)
  const loadFlashcards = useSessionStore((s) => s.loadFlashcards)
  const notify = useNotificationStore((s) => s.notify)
  const supabase = useMemo(() => createClient(), [])

  // ── Data loading ────────────────────────────────────────────────────────────

  const [reviewMap, setReviewMap] = useState<Record<string, LatestReview>>({})
  const [reviewsLoaded, setReviewsLoaded] = useState(false)

  useEffect(() => {
    if (flashcards.length === 0) { setReviewsLoaded(true); return }
    const ids = flashcards.map(f => f.id)
    supabase
      .from('flashcard_reviews')
      .select('flashcard_id, ease_factor, interval_days, due_at, rating')
      .in('flashcard_id', ids)
      .order('reviewed_at', { ascending: false })
      .then(({ data }) => {
        const map: Record<string, LatestReview> = {}
        for (const row of data ?? []) {
          const id = row.flashcard_id as string
          if (!map[id]) {
            map[id] = {
              easeFactor: row.ease_factor as number,
              intervalDays: row.interval_days as number,
              dueAt: row.due_at as string,
              rating: row.rating as Rating,
            }
          }
        }
        setReviewMap(map)
        setReviewsLoaded(true)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // stable within a session

  // ── Study queue — snapshot on filter change so queue is stable mid-session ──

  const [filter, setFilter] = useState<Filter>('all')
  const [studyQueue, setStudyQueue] = useState<Flashcard[]>([])
  const [cardIdx, setCardIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)

  // Snapshot queue when filter changes (or when reviews first load)
  const reviewMapRef = useRef(reviewMap)
  reviewMapRef.current = reviewMap

  useEffect(() => {
    if (!reviewsLoaded) return
    setStudyQueue(getFiltered(flashcards, filter, reviewMapRef.current))
    setCardIdx(0)
    setFlipped(false)
    setSessionRatings({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, reviewsLoaded]) // intentionally excludes reviewMap — queue is stable mid-session

  // ── Session tracking ────────────────────────────────────────────────────────

  // Track ratings made this session for the completion screen and missed-only restart.
  const [sessionRatings, setSessionRatings] = useState<Record<string, Rating>>({})
  // When non-null, overrides studyQueue with only the missed cards.
  const [missedOnlyQueue, setMissedOnlyQueue] = useState<Flashcard[] | null>(null)

  const activeQueue = missedOnlyQueue ?? studyQueue
  const card = activeQueue[cardIdx] ?? null
  const isComplete = reviewsLoaded && activeQueue.length > 0 && cardIdx >= activeQueue.length

  // ── Interaction state ───────────────────────────────────────────────────────

  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState<null | 'anki' | 'csv' | 'pdf'>(null)

  // ── New card form ───────────────────────────────────────────────────────────
  const [newCardForm, setNewCardForm] = useState<{
    front: string; back: string; zone: 'red' | 'likely'
  } | null>(null)
  const [savingCard, setSavingCard] = useState(false)

  // ── Keyboard: space to flip ─────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') { e.preventDefault(); setFlipped(f => !f) }
      if (e.code === 'ArrowLeft')  setCardIdx(i => Math.max(0, i - 1))
      if (e.code === 'ArrowRight') setCardIdx(i => Math.min(activeQueue.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeQueue.length])

  // ── Rate a card ─────────────────────────────────────────────────────────────

  const handleRate = useCallback(async (r: Rating) => {
    if (!card || submitting) return
    setSubmitting(true)

    const existing = reviewMap[card.id]
    const result = computeNextReview(r, existing?.easeFactor ?? 2.5, existing?.intervalDays ?? 0)

    // Optimistic update — mastery bars and ring update instantly
    const updatedReview: LatestReview = {
      easeFactor: result.easeFactor,
      intervalDays: result.intervalDays,
      dueAt: result.dueAt.toISOString(),
      rating: r,
    }
    setReviewMap(prev => ({ ...prev, [card.id]: updatedReview }))
    setSessionRatings(prev => ({ ...prev, [card.id]: r }))

    // Auto-advance after rating
    setFlipped(false)
    setCardIdx(i => i + 1)
    setSubmitting(false)

    // Fire-and-forget DB write
    supabase.from('flashcard_reviews').insert({
      flashcard_id: card.id,
      user_id: userId,
      rating: r,
      ease_factor: result.easeFactor,
      interval_days: result.intervalDays,
      due_at: result.dueAt.toISOString(),
    })
  }, [card, submitting, reviewMap, userId, supabase])

  // ── Completion screen actions ───────────────────────────────────────────────

  const handleStudyAgain = useCallback(() => {
    setMissedOnlyQueue(null)
    setCardIdx(0)
    setFlipped(false)
    setSessionRatings({})
  }, [])

  const handleReviewMissed = useCallback(() => {
    // Cards from the current queue that were rated Again or Hard this session
    const missed = activeQueue.filter(fc =>
      sessionRatings[fc.id] === 'again' || sessionRatings[fc.id] === 'hard'
    )
    if (missed.length === 0) { handleStudyAgain(); return }
    setMissedOnlyQueue(missed)
    setCardIdx(0)
    setFlipped(false)
    setSessionRatings({})
  }, [activeQueue, sessionRatings, handleStudyAgain])

  const handleBackToAll = useCallback(() => {
    setFilter('all')
    setMissedOnlyQueue(null)
    setCardIdx(0)
    setFlipped(false)
    setSessionRatings({})
  }, [])

  // ── Exports ─────────────────────────────────────────────────────────────────

  const handleExportAnki = useCallback(async () => {
    if (flashcards.length === 0 || exporting) return
    setExporting('anki')
    try {
      const { generateApkg } = await import('@/lib/study-guide/anki-export')
      const data = await generateApkg(flashcards, sessionTitle)
      const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sessionTitle.replace(/[^a-z0-9]/gi, '_')}.apkg`
      a.click()
      URL.revokeObjectURL(url)
      notify({ type: 'success', message: 'Anki deck exported', duration: 2000 })
      supabase.from('users').update({ checklist_exported: true }).eq('id', userId)
      fetch('/api/export/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, card_count: flashcards.length }),
      }).catch(() => {})
    } finally {
      setExporting(null)
    }
  }, [flashcards, sessionTitle, userId, sessionId, exporting, notify, supabase])

  const handleExportCsv = useCallback(() => {
    if (flashcards.length === 0 || exporting) return
    setExporting('csv')
    try {
      const rows = [
        '"Term","Question","Answer","Zone"',
        ...flashcards.map(fc => {
          const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
          return [esc(fc.keywordTerm), esc(fc.front), esc(fc.back), esc(fc.zone === 'red' ? 'Red Zone' : 'Likely')].join(',')
        }),
      ].join('\n')
      const blob = new Blob([rows], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sessionTitle.replace(/[^a-z0-9]/gi, '_')}_flashcards.csv`
      a.click()
      URL.revokeObjectURL(url)
      notify({ type: 'success', message: 'CSV exported', duration: 2000 })
    } finally {
      setExporting(null)
    }
  }, [flashcards, sessionTitle, exporting, notify])

  const handleExportPdf = useCallback(() => {
    if (flashcards.length === 0 || exporting) return
    setExporting('pdf')
    try {
      const redCards = flashcards.filter(fc => fc.zone === 'red')
      const rows = redCards.map(fc => `
        <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #ddd;">
          <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#111;">${fc.front}</p>
          <p style="margin:0;font-size:13px;color:#444;line-height:1.5;">${fc.back}</p>
        </div>`).join('')
      const win = window.open('', '_blank')
      if (!win) { notify({ type: 'error', message: 'Pop-up blocked — allow pop-ups to export PDF', duration: 4000 }); return }
      win.document.write(`
        <html><head><title>${sessionTitle} — Red Zone Summary</title>
        <style>
          body{font-family:system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 24px;color:#222;}
          h1{font-size:20px;font-weight:700;margin:0 0 4px;}
          p.sub{font-size:13px;color:#666;margin:0 0 28px;}
          @media print{body{margin:20px;}}
        </style></head><body>
        <h1>${sessionTitle}</h1>
        <p class="sub">Red Zone Keywords · ${redCards.length} cards · Nocturne</p>
        ${rows}
        <script>window.onload=()=>window.print()</script>
        </body></html>
      `)
      win.document.close()
    } finally {
      setExporting(null)
    }
  }, [flashcards, sessionTitle, exporting, notify])

  // ── New card submit ─────────────────────────────────────────────────────────

  const handleNewCardSubmit = useCallback(async () => {
    if (!newCardForm || savingCard) return
    const { front, back, zone } = newCardForm
    if (!front.trim() || !back.trim()) return

    setSavingCard(true)
    try {
      const mk = getMasterKey()
      if (!mk) {
        notify({ type: 'error', message: 'Vault locked — unlock to add cards', duration: 4000 })
        return
      }

      const frontTrimmed = front.trim()
      const backTrimmed = back.trim()

      const [termEnc, frontEnc, backEnc] = await Promise.all([
        encryptText(mk, frontTrimmed),
        encryptText(mk, frontTrimmed),
        encryptText(mk, backTrimmed),
      ])

      // Insert keyword row (source: 'manual' — rescore will never touch this row)
      const { data: kwRow, error: kwErr } = await supabase
        .from('keywords')
        .insert({
          session_id: sessionId,
          user_id: userId,
          term_encrypted: termEnc,
          normalized_term: normalizeTerm(frontTrimmed),
          source: 'manual',
          zone,
          confidence_score: 1.0,
          mention_count: 0,
          dwell_time_ms: 0,
          emphasis_score: 0,
          lecture_confidence: 0,
          slide_indices: [],
        })
        .select('id')
        .single()

      if (kwErr) {
        const isDuplicate = kwErr.code === '23505'
        notify({
          type: 'error',
          message: isDuplicate ? 'A card with that term already exists' : 'Failed to save card',
          duration: 4000,
        })
        return
      }

      // Insert flashcard row linked to the new keyword
      const { data: fcRow, error: fcErr } = await supabase
        .from('flashcards')
        .insert({
          session_id: sessionId,
          user_id: userId,
          keyword_id: kwRow!.id,
          front_encrypted: frontEnc,
          back_encrypted: backEnc,
          slide_index: null,
          zone,
        })
        .select('id')
        .single()

      if (fcErr || !fcRow) {
        notify({ type: 'error', message: 'Failed to save card', duration: 4000 })
        return
      }

      // Add to Zustand store so the card is visible immediately without reload
      const newCard: Flashcard = {
        id: fcRow.id,
        keywordTerm: frontTrimmed,
        front: frontTrimmed,
        back: backTrimmed,
        slideIndex: null,
        zone,
      }
      loadFlashcards([...flashcards, newCard])

      // Append to study queue if the current filter includes the new card's zone
      const included =
        filter === 'all' ||
        (filter === 'red' && zone === 'red') ||
        (filter === 'likely' && zone === 'likely') ||
        filter === 'needs_work'  // new card has no reviews → qualifies
      if (included) {
        setStudyQueue(prev => [...prev, newCard])
      }

      setNewCardForm(null)
      notify({ type: 'success', message: 'Card added', duration: 2000 })
    } finally {
      setSavingCard(false)
    }
  }, [newCardForm, savingCard, sessionId, userId, supabase, flashcards, loadFlashcards, filter, notify])

  // ── Derived stats ───────────────────────────────────────────────────────────

  const masteryStats = useMemo(() => {
    if (!reviewsLoaded) return null
    const counts = { new: 0, learning: 0, mastered: 0 }
    for (const fc of flashcards) {
      counts[computeMastery(reviewMap[fc.id]?.intervalDays).state]++
    }
    return counts
  }, [reviewsLoaded, flashcards, reviewMap])

  const filterCounts = useMemo(() => ({
    all:        flashcards.length,
    red:        flashcards.filter(fc => fc.zone === 'red').length,
    likely:     flashcards.filter(fc => fc.zone === 'likely').length,
    needs_work: flashcards.filter(fc => isNeedsWork(fc, reviewMap)).length,
  }), [flashcards, reviewMap])

  if (flashcards.length === 0) return null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex',
      gap: 0,
      width: '100%',
      minHeight: 560,
      height: '100%',
    }}>
      {/* ── LEFT PANE: filter + card list ─────────────────────────────────── */}
      <div style={{
        width: 264,
        flexShrink: 0,
        borderRight: '1px solid #1A1A28',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        paddingRight: 0,
      }}>
        {/* Section header */}
        <div style={{ padding: '0 0 12px 0' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#3F485C', letterSpacing: '0.06em', textTransform: 'uppercase' }}>What to study</span>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {(['all', 'red', 'likely', 'needs_work'] as Filter[]).map(f => {
            const labels: Record<Filter, string> = { all: 'All', red: 'Red Zone', likely: 'Likely', needs_work: 'Needs work' }
            const active = filter === f && !missedOnlyQueue
            return (
              <button
                key={f}
                type="button"
                onClick={() => { setMissedOnlyQueue(null); setFilter(f) }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  height: 26, padding: '0 10px', borderRadius: 9999,
                  border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid #1E1D2A',
                  background: active ? 'rgba(99,102,241,0.12)' : '#0C0C13',
                  color: active ? '#A5B4FC' : '#4B5563',
                  fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {labels[f]}
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: active ? '#818CF8' : '#2D3748',
                  background: active ? 'rgba(99,102,241,0.2)' : '#111',
                  borderRadius: 9999, padding: '1px 5px',
                }}>
                  {filterCounts[f]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Scrollable card list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 8 }}>
          {!reviewsLoaded ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#3F485C', fontSize: 13 }}>Loading…</div>
          ) : activeQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#3F485C', fontSize: 13 }}>No cards in this filter.</div>
          ) : activeQueue.map((fc, idx) => {
            const isActive = idx === cardIdx && !isComplete
            const mastery = computeMastery(reviewMap[fc.id]?.intervalDays)
            const zoneColor = fc.zone === 'red' ? '#EF4444' : '#6366F1'
            return (
              <button
                key={fc.id}
                type="button"
                onClick={() => { setCardIdx(idx); setFlipped(false) }}
                style={{
                  display: 'block',
                  textAlign: 'left',
                  padding: '10px 10px 10px 12px',
                  borderRadius: 10,
                  border: isActive ? '1px solid #23222F' : '1px solid transparent',
                  background: isActive ? '#111020' : 'transparent',
                  cursor: 'pointer',
                  borderLeft: `3px solid ${isActive ? zoneColor : 'transparent'}`,
                  transition: 'all 0.12s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: isActive ? '#E2E8F0' : '#94A3B8', lineHeight: 1.3, wordBreak: 'break-word' }}>
                    {fc.keywordTerm}
                  </span>
                </div>
                <MasteryBar intervalDays={reviewMap[fc.id]?.intervalDays} />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── MIDDLE PANE: card player ──────────────────────────────────────── */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '0 32px',
      }}>
        {/* New card button — always visible at top of middle pane */}
        {reviewsLoaded && !newCardForm && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setNewCardForm({ front: '', back: '', zone: 'red' })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 28, padding: '0 12px', borderRadius: 8,
                border: '1px solid #23222F', background: '#0C0C13',
                fontSize: 12, color: '#4B5563', cursor: 'pointer',
              }}
            >
              <Plus size={12} strokeWidth={1.5} />
              New card
            </button>
          </div>
        )}

        {/* New card form — replaces card player when open */}
        {newCardForm ? (
          <NewCardForm
            form={newCardForm}
            saving={savingCard}
            onChange={setNewCardForm}
            onSubmit={handleNewCardSubmit}
            onCancel={() => setNewCardForm(null)}
          />
        ) : !reviewsLoaded ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3F485C', fontSize: 13 }}>Loading…</div>
        ) : activeQueue.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#E2E8F0', margin: 0 }}>No cards here</p>
            <p style={{ fontSize: 13, color: '#3F485C', margin: 0 }}>Change the filter to see cards.</p>
          </div>
        ) : isComplete ? (
          /* ── Completion screen ──────────────────────────────────────────── */
          <CompletionScreen
            queue={activeQueue}
            sessionRatings={sessionRatings}
            reviewMap={reviewMap}
            onStudyAgain={handleStudyAgain}
            onReviewMissed={handleReviewMissed}
            onBackToAll={handleBackToAll}
          />
        ) : card ? (
          /* ── Card player ────────────────────────────────────────────────── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%', maxWidth: 560, margin: '0 auto' }}>
            {/* Header: counter + zone badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: '#3F485C', fontFamily: 'monospace' }}>
                Flashcard {cardIdx + 1} / {activeQueue.length}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 9999,
                background: ZONE_COLORS[card.zone].badge,
                fontSize: 11, fontWeight: 600, color: ZONE_COLORS[card.zone].text,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ZONE_COLORS[card.zone].dot, flexShrink: 0 }} />
                {card.zone === 'red' ? 'Red Zone' : 'Likely'}
              </span>
            </div>

            {/* Flip card */}
            <button
              type="button"
              onClick={() => setFlipped(f => !f)}
              style={{
                width: '100%',
                minHeight: 200,
                padding: '28px 24px',
                borderRadius: 14,
                cursor: 'pointer',
                textAlign: 'left',
                border: `1px solid ${card.zone === 'red' ? 'rgba(251,113,133,0.2)' : 'rgba(99,102,241,0.2)'}`,
                background: card.zone === 'red' ? 'rgba(251,113,133,0.04)' : 'rgba(99,102,241,0.04)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 20,
                marginBottom: 0,
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${card.id}-${flipped ? 'back' : 'front'}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } }}
                  exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
                >
                  {flipped ? (
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#3F485C', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>Answer</span>
                      <p style={{ fontSize: 14, color: '#94A3B8', margin: 0, lineHeight: 1.65 }}>{card.back}</p>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#3F485C', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>Question</span>
                      <p style={{ fontSize: 17, fontWeight: 600, color: '#E2E8F0', margin: 0, lineHeight: 1.4 }}>{card.front}</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              <span style={{ fontSize: 11, color: '#2D3748' }}>
                {flipped ? 'Answer · click to see question' : 'tap to flip · space'}
              </span>
            </button>

            {/* Navigation row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 12, marginBottom: 14,
            }}>
              <button
                type="button"
                onClick={() => { setCardIdx(i => Math.max(0, i - 1)); setFlipped(false) }}
                disabled={cardIdx === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, color: cardIdx === 0 ? '#1E2030' : '#4B5563',
                  background: 'none', border: 'none', cursor: cardIdx === 0 ? 'default' : 'pointer',
                  padding: '4px 0',
                }}
              >
                <ChevronLeft size={14} strokeWidth={1.5} />
                Prev
              </button>
              <span style={{ fontSize: 12, color: '#2D3748' }}>How well did you know it?</span>
              <button
                type="button"
                onClick={() => { setCardIdx(i => Math.min(activeQueue.length, i + 1)); setFlipped(false) }}
                disabled={cardIdx >= activeQueue.length - 1}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, color: cardIdx >= activeQueue.length - 1 ? '#1E2030' : '#4B5563',
                  background: 'none', border: 'none', cursor: cardIdx >= activeQueue.length - 1 ? 'default' : 'pointer',
                  padding: '4px 0',
                }}
              >
                Next
                <ChevronRight size={14} strokeWidth={1.5} />
              </button>
            </div>

            {/* Rating buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {RATINGS.map(({ rating, label, color, border, bg }) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => handleRate(rating)}
                  disabled={submitting}
                  style={{
                    height: 42, borderRadius: 10,
                    border: `1px solid ${border}`,
                    background: bg, color,
                    fontSize: 13, fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.5 : 1,
                    transition: 'opacity 0.1s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── RIGHT PANE: mastery ring + export ────────────────────────────── */}
      <div style={{
        width: 220,
        flexShrink: 0,
        borderLeft: '1px solid #1A1A28',
        paddingLeft: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}>
        {/* Mastery ring */}
        {masteryStats ? (
          <>
            <DonutRing
              mastered={masteryStats.mastered}
              learning={masteryStats.learning}
              total={flashcards.length}
            />

            {/* Legend */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([ ['mastered', 'Mastered'], ['learning', 'Learning'], ['new', 'Not started'] ] as const).map(([state, label]) => (
                <div key={state} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: MASTERY_COLORS[state].dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#64748B' }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>{masteryStats[state]}</span>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: '#1A1A28', margin: '20px 0' }} />
          </>
        ) : (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: '#3F485C' }}>Loading…</span>
          </div>
        )}

        {/* Export section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#3F485C', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Export</span>
          {[
            { key: 'anki' as const, label: 'Anki deck',      ext: '.apkg', handler: handleExportAnki },
            { key: 'csv'  as const, label: 'CSV',             ext: '.csv',  handler: handleExportCsv  },
            { key: 'pdf'  as const, label: 'PDF summary',     ext: '.pdf',  handler: handleExportPdf  },
          ].map(({ key, label, ext, handler }) => (
            <button
              key={key}
              type="button"
              onClick={handler}
              disabled={exporting !== null}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', borderRadius: 9,
                border: '1px solid #1E1D2A', background: '#0A0A10',
                cursor: exporting !== null ? 'not-allowed' : 'pointer',
                opacity: exporting !== null ? 0.5 : 1,
                transition: 'border-color 0.12s, background 0.12s',
              }}
              onMouseEnter={e => { if (!exporting) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2D2B45'; (e.currentTarget as HTMLButtonElement).style.background = '#0F0E1A' } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1E1D2A'; (e.currentTarget as HTMLButtonElement).style.background = '#0A0A10' }}
            >
              <span style={{ fontSize: 12, color: '#94A3B8' }}>
                {exporting === key ? 'Exporting…' : label}
              </span>
              <span style={{ fontSize: 10, color: '#3F485C', fontFamily: 'monospace' }}>{ext}</span>
            </button>
          ))}
          <p style={{ fontSize: 11, color: '#2D3748', lineHeight: 1.5, margin: '4px 0 0' }}>
            Exports your Red Zone keywords and the flashcards above.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── New Card Form ──────────────────────────────────────────────────────────────

function NewCardForm({
  form,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: { front: string; back: string; zone: 'red' | 'likely' }
  saving: boolean
  onChange: (f: { front: string; back: string; zone: 'red' | 'likely' }) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const canSubmit = form.front.trim().length > 0 && form.back.trim().length > 0 && !saving

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 9,
    border: '1px solid #23222F',
    background: '#0A0A10',
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 1.5,
    outline: 'none',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: '#3F485C',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  }

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0' }}>New card</span>
        <button
          type="button"
          onClick={onCancel}
          style={{ fontSize: 12, color: '#3F485C', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Front */}
        <div>
          <label style={labelStyle}>Front (term / question)</label>
          <textarea
            rows={2}
            value={form.front}
            onChange={e => onChange({ ...form, front: e.target.value })}
            placeholder="e.g. Fick's Law"
            style={inputStyle}
          />
        </div>

        {/* Back */}
        <div>
          <label style={labelStyle}>Back (definition / answer)</label>
          <textarea
            rows={4}
            value={form.back}
            onChange={e => onChange({ ...form, back: e.target.value })}
            placeholder="e.g. The rate of diffusion is proportional to the concentration gradient and surface area, and inversely proportional to membrane thickness."
            style={inputStyle}
          />
        </div>

        {/* Zone */}
        <div>
          <label style={labelStyle}>Zone</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['red', 'likely'] as const).map(z => {
              const active = form.zone === z
              const zColor = z === 'red' ? { border: 'rgba(251,113,133,0.4)', bg: 'rgba(251,113,133,0.08)', text: '#FDA4AF' }
                : { border: 'rgba(99,102,241,0.4)', bg: 'rgba(99,102,241,0.08)', text: '#A5B4FC' }
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => onChange({ ...form, zone: z })}
                  style={{
                    flex: 1, height: 36, borderRadius: 9,
                    border: active ? `1px solid ${zColor.border}` : '1px solid #1E1D2A',
                    background: active ? zColor.bg : 'transparent',
                    color: active ? zColor.text : '#3F485C',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  {z === 'red' ? 'Red Zone' : 'Likely'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            style={{
              flex: 1, height: 40, borderRadius: 9,
              border: '1px solid rgba(99,102,241,0.4)',
              background: canSubmit ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: canSubmit ? '#A5B4FC' : '#2D3748',
              fontSize: 13, fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'all 0.12s',
            }}
          >
            {saving ? 'Saving…' : 'Add card'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: 40, padding: '0 16px', borderRadius: 9,
              border: '1px solid #1E1D2A', background: 'transparent',
              color: '#3F485C', fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Completion Screen ──────────────────────────────────────────────────────────

function CompletionScreen({
  queue,
  sessionRatings,
  reviewMap,
  onStudyAgain,
  onReviewMissed,
  onBackToAll,
}: {
  queue: Flashcard[]
  sessionRatings: Record<string, Rating>
  reviewMap: Record<string, LatestReview>
  onStudyAgain: () => void
  onReviewMissed: () => void
  onBackToAll: () => void
}) {
  const masteredThisRound = queue.filter(fc =>
    sessionRatings[fc.id] && computeMastery(reviewMap[fc.id]?.intervalDays).state === 'mastered'
  ).length

  const missedCount = queue.filter(fc =>
    sessionRatings[fc.id] === 'again' || sessionRatings[fc.id] === 'hard'
  ).length

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
        <p style={{ fontSize: 22, fontWeight: 700, color: '#E2E8F0', margin: '0 0 8px' }}>Session complete</p>
        <p style={{ fontSize: 14, color: '#64748B', margin: 0, lineHeight: 1.6 }}>
          You reviewed {queue.length} card{queue.length !== 1 ? 's' : ''}.{' '}
          {masteredThisRound > 0 && <span style={{ color: '#10B981' }}>{masteredThisRound} mastered this round.</span>}
          {missedCount > 0 && <span style={{ color: '#F59E0B' }}> {missedCount} still need{missedCount === 1 ? 's' : ''} work.</span>}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <button
          type="button"
          onClick={onStudyAgain}
          style={{
            height: 42, borderRadius: 10,
            border: '1px solid rgba(99,102,241,0.35)',
            background: 'rgba(99,102,241,0.08)',
            color: '#A5B4FC', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Study again
        </button>

        {missedCount > 0 && (
          <button
            type="button"
            onClick={onReviewMissed}
            style={{
              height: 42, borderRadius: 10,
              border: '1px solid rgba(251,191,36,0.3)',
              background: 'rgba(251,191,36,0.06)',
              color: '#FDE68A', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Review missed only ({missedCount})
          </button>
        )}

        <button
          type="button"
          onClick={onBackToAll}
          style={{
            height: 42, borderRadius: 10,
            border: '1px solid #1E1D2A',
            background: 'transparent',
            color: '#4B5563', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Back to all cards
        </button>
      </div>
    </motion.div>
  )
}
