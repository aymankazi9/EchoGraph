'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Pause, Mic, Square } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { isVaultUnlocked, getMasterKey } from '@/lib/crypto/vault'
import { decryptText } from '@/lib/crypto/decrypt'
import { encryptText } from '@/lib/crypto/encrypt'
import { createClient } from '@/lib/supabase'
import { scoreKeywords, computeSlideDensity } from '@/lib/scoring/keyword-scorer'
import { generateFlashcards } from '@/lib/scoring/flashcard-generator'
import { enhanceFlashcards } from '@/lib/scoring/flashcard-enhancer'
import { GuideUpload, type GuidePayload } from '@/components/study-guide/guide-upload'
import { startLiveTranscription, type LiveStatus } from '@/lib/live-transcription'
import { addFilesToExistingSession } from '@/lib/upload'
import { useSessionStore, getAudioEl } from '@/store/session-store'
import { useNotificationStore } from '@/store/notification-store'
import { SessionTitle } from '@/components/session/session-title'
import { CourseTagPicker } from '@/components/session/course-tag-picker'
import { KeyboardShortcutOverlay } from '@/components/session/keyboard-shortcut-overlay'
import { GuidedEmptyState } from '@/components/session/guided-empty-state'
import { AudioPlayer } from '@/components/audio/audio-player'
import { PdfViewer, type PdfViewerHandle } from '@/components/pdf/pdf-viewer'
import { SlideNavStrip } from '@/components/pdf/slide-nav-strip'
import { FlashcardPanel } from '@/components/study-guide/flashcard-panel'
import { NotesEditor } from '@/components/notes/notes-editor'
import { AskPanel } from '@/components/ask/ask-panel'
import type { TranscriptWordEntry, StoredKeyword, Flashcard } from '@/store/session-store'
import type { InputKeyword } from '@/lib/scoring/keyword-scorer'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session {
  id: string
  title_encrypted: string
  has_slides: boolean
  has_audio: boolean
  has_study_guide: boolean
  guide_type: string | null
  status: string
  course_tag: string | null
}

interface Props {
  userId: string
  session: Session
  pdfFile: { id: string; storage_path: string; iv: string } | null
  audioFile: { id: string; storage_path: string } | null
  initialUserField: string | null
  domainPromptDismissed: boolean
}

type Tab = 'lecture' | 'study' | 'notes' | 'ask'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionClient({ userId, session, pdfFile, audioFile, initialUserField, domainPromptDismissed }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('lecture')
  const [isScoring, setIsScoring] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [liveStatus, setLiveStatus] = useState<LiveStatus>({ phase: 'idle' })
  const stopLiveRef = useRef<(() => Promise<Blob | null>) | null>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [ribbon, setRibbon] = useState<'transcript' | 'density'>('transcript')
  const pdfViewerRef = useRef<PdfViewerHandle | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const playTrackedRef = useRef(false)
  const supabase = createClient()

  const addTranscriptWords = useSessionStore((s) => s.addTranscriptWords)
  const loadTranscriptWords = useSessionStore((s) => s.loadTranscriptWords)
  const loadSyncMap = useSessionStore((s) => s.loadSyncMap)
  const seekTo = useSessionStore((s) => s.seekTo)
  const jumpToSlide = useSessionStore((s) => s.jumpToSlide)
  const syncMap = useSessionStore((s) => s.syncMap)
  const transcriptWords = useSessionStore((s) => s.transcriptWords)
  const keywords = useSessionStore((s) => s.keywords)
  const flashcards = useSessionStore((s) => s.flashcards)
  const loadKeywords = useSessionStore((s) => s.loadKeywords)
  const loadFlashcards = useSessionStore((s) => s.loadFlashcards)
  const loadSlideDensity = useSessionStore((s) => s.loadSlideDensity)
  const loadSlideZones = useSessionStore((s) => s.loadSlideZones)
  const reset = useSessionStore((s) => s.reset)
  const setSessionTitle = useSessionStore((s) => s.setSessionTitle)
  const sessionTitle = useSessionStore((s) => s.sessionTitle)
  const initSessionMeta = useSessionStore((s) => s.initSessionMeta)
  const hasSlides = useSessionStore((s) => s.hasSlides)
  const hasAudio = useSessionStore((s) => s.hasAudio)
  const currentTimeMs = useSessionStore((s) => s.currentTimeMs)
  const durationMs = useSessionStore((s) => s.durationMs)
  const isPlaying = useSessionStore((s) => s.isPlaying)
  const slideDensityMap = useSessionStore((s) => s.slideDensityMap)
  const slideZoneMap = useSessionStore((s) => s.slideZoneMap)

  // ── Vault guard + seed session metadata ─────────────────────────────────
  useEffect(() => {
    if (!isVaultUnlocked()) { router.replace('/unlock'); return }

    initSessionMeta({
      hasSlides: session.has_slides,
      hasAudio: session.has_audio,
      hasStudyGuide: session.has_study_guide,
      status: session.status,
    })

    const mk = getMasterKey()
    if (!mk) return

    decryptText(mk, session.title_encrypted)
      .then(setSessionTitle)
      .catch(() => setSessionTitle('Session'))
  }, [router, session.title_encrypted]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load transcript + sync map + keywords from DB on mount ──────────────
  useEffect(() => {
    const canLoad = ['ready', 'transcribed', 'synced', 'syncing'].includes(session.status)
    if (!canLoad) return

    const mk = getMasterKey()
    if (!mk) return

    async function loadData() {
      const { data: wordRows } = await supabase
        .from('transcript_words')
        .select('id, word_encrypted, start_time_ms, end_time_ms, slide_index')
        .eq('session_id', session.id)
        .order('start_time_ms')

      if (wordRows && wordRows.length > 0) {
        const words: TranscriptWordEntry[] = await Promise.all(
          wordRows.map(async (w) => ({
            id: w.id as string,
            word: await decryptText(mk!, w.word_encrypted as string),
            startMs: w.start_time_ms as number,
            endMs: w.end_time_ms as number,
            slideIndex: w.slide_index as number | null,
          })),
        )
        loadTranscriptWords(words)
      }

      if (session.status === 'synced' || session.status === 'syncing') {
        const { data: syncRow } = await supabase
          .from('sync_map')
          .select('map_encrypted')
          .eq('session_id', session.id)
          .maybeSingle()

        if (syncRow?.map_encrypted) {
          try {
            const mapJson = await decryptText(mk!, syncRow.map_encrypted as string)
            const { segments } = JSON.parse(mapJson) as { segments: import('@/lib/sync/playhead-tracker').SyncSegment[] }
            loadSyncMap(segments)
          } catch {
            // Corrupt sync map — non-fatal
          }
        }
      }

      const { data: kwRows } = await supabase
        .from('keywords')
        .select('id, term_encrypted, source, zone, confidence_score, mention_count, dwell_time_ms, emphasis_score, lecture_confidence, slide_indices')
        .eq('session_id', session.id)
        .order('confidence_score', { ascending: false })

      if (kwRows && kwRows.length > 0) {
        const loaded: StoredKeyword[] = await Promise.all(
          kwRows.map(async (k) => ({
            id: k.id as string,
            term: await decryptText(mk!, k.term_encrypted as string),
            source: k.source as StoredKeyword['source'],
            zone: k.zone as StoredKeyword['zone'],
            confidenceScore: k.confidence_score as number,
            mentionCount: k.mention_count as number,
            dwellTimeMs: k.dwell_time_ms as number,
            emphasisScore: k.emphasis_score as number,
            lectureConfidence: k.lecture_confidence as number,
            slideIndices: (k.slide_indices as number[]) ?? [],
          })),
        )
        loadKeywords(loaded)
      }

      const { data: densityRows } = await supabase
        .from('slides')
        .select('page_number, density_score, is_likely_zone, is_red_zone')
        .eq('session_id', session.id)
      if (densityRows) {
        const rec: Record<number, number> = {}
        const zones: Record<number, 'likely' | 'red' | null> = {}
        densityRows.forEach((r) => {
          const pn = r.page_number as number
          if (r.density_score != null) rec[pn] = r.density_score as number
          zones[pn] = (r.is_likely_zone as boolean | null)
            ? 'likely'
            : (r.is_red_zone as boolean | null)
              ? 'red'
              : null
        })
        if (Object.keys(rec).length > 0) loadSlideDensity(rec)
        if (Object.keys(zones).length > 0) loadSlideZones(zones)
      }

      const { data: fcRows } = await supabase
        .from('flashcards')
        .select('id, front_encrypted, back_encrypted, slide_index, zone')
        .eq('session_id', session.id)
        .order('created_at')

      if (fcRows && fcRows.length > 0) {
        const cards: Flashcard[] = await Promise.all(
          fcRows.map(async (fc) => {
            const front = await decryptText(mk!, fc.front_encrypted as string)
            return {
              id: fc.id as string,
              keywordTerm: front,
              front,
              back: await decryptText(mk!, fc.back_encrypted as string),
              slideIndex: fc.slide_index as number | null,
              zone: fc.zone as 'red' | 'likely',
            }
          }),
        )
        loadFlashcards(cards)
      }
    }

    loadData().catch((e) => console.error('[SessionClient] data load error:', e))
  }, [session.id, session.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset store on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => { reset() }
  }, [reset])

  // ── Track first audio play per session per day (for user_activity) ───────
  useEffect(() => {
    if (!isPlaying || tab !== 'lecture' || playTrackedRef.current) return
    playTrackedRef.current = true

    const today = new Date().toISOString().slice(0, 10)
    const dedupKey = `play:${session.id}:${today}`
    if (typeof sessionStorage !== 'undefined') {
      if (sessionStorage.getItem(dedupKey)) return
      sessionStorage.setItem(dedupKey, '1')
    }

    void supabase.rpc('upsert_user_activity', {
      p_date: today,
      p_sessions_delta: 1,
      p_cards_delta: 0,
    })
  }, [isPlaying, tab, session.id, supabase])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const SEEK_STEP = 5000
    const SEEK_LONG = 30

    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (
        tag === 'INPUT' || tag === 'TEXTAREA' ||
        (e.target as HTMLElement).isContentEditable
      ) return

      const store = useSessionStore.getState()

      switch (e.key) {
        case ' ':
        case 'Spacebar': {
          e.preventDefault()
          const el = getAudioEl()
          if (!el) return
          if (store.isPlaying) el.pause()
          else el.play().catch(() => {})
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          seekTo(Math.max(0, store.currentTimeMs - SEEK_STEP))
          break
        }
        case 'ArrowRight': {
          e.preventDefault()
          seekTo(Math.min(store.durationMs, store.currentTimeMs + SEEK_STEP))
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          store.seekRelative(SEEK_LONG)
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          store.seekRelative(-SEEK_LONG)
          break
        }
        case '[': {
          e.preventDefault()
          const prev = [...store.syncMap].reverse().find((s) => s.startMs < store.currentTimeMs - 1000)
          if (prev) {
            pdfViewerRef.current?.goToPage(prev.slideIndex)
            jumpToSlide(prev.slideIndex)
          }
          break
        }
        case ']': {
          e.preventDefault()
          const next = store.syncMap.find((s) => s.startMs > store.currentTimeMs + 500)
          if (next) {
            pdfViewerRef.current?.goToPage(next.slideIndex)
            jumpToSlide(next.slideIndex)
          }
          break
        }
        case '?': {
          store.toggleShortcutOverlay()
          break
        }
        case 'e':
        case 'E': {
          store.triggerTitleEdit()
          break
        }
        case 'p':
        case 'P': {
          store.focusPDF()
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [seekTo, jumpToSlide])

  // ── Scoring handler ──────────────────────────────────────────────────────
  // payload.type === 'extract': call LLM to extract terms (guide text or null for auto)
  // payload.type === 'anki':    use pre-extracted card fronts directly
  const handleScore = useCallback(
    async (payload: GuidePayload | { type: 'extract'; guideText: string | null }) => {
      const mk = getMasterKey()
      if (!mk || isScoring) return

      setIsScoring(true)
      try {
        const { data: slideRows } = await supabase
          .from('slides')
          .select('page_number, text_encrypted')
          .eq('session_id', session.id)
          .order('page_number')

        const slides = slideRows
          ? await Promise.all(
              slideRows.map(async (s) => ({
                pageNumber: s.page_number as number,
                text: s.text_encrypted
                  ? await decryptText(mk, s.text_encrypted as string).catch(() => '')
                  : '',
              })),
            )
          : []

        const currentWords = useSessionStore.getState().transcriptWords
        const transcriptText = currentWords.map((w) => w.word).join(' ')

        // ── Build InputKeyword list ────────────────────────────────────────────
        let inputKws: InputKeyword[]
        let guideType: string

        if (payload.type === 'anki') {
          inputKws = payload.terms.map((t) => ({ term: t, source: 'anki' as const }))
          guideType = 'anki'
        } else {
          // LLM extraction path (guide text provided, or null = infer from lecture only)
          const guideText = payload.type === 'extract' ? payload.guideText : payload.rawText
          const hasGuide = !!guideText?.trim()
          guideType = hasGuide ? 'real_guide' : 'synthetic'

          const resp = await fetch('/api/extract/keywords', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId: session.id, guideText: guideText ?? null, transcriptText, slides }),
          })

          if (!resp.ok) {
            console.error('[SessionClient] extraction failed:', resp.status)
            return
          }

          const { keywords: extracted } = await resp.json() as {
            keywords: { term: string; source: 'guide' | 'inferred' | 'both' }[]
          }

          if (!extracted?.length) return

          // Map LLM source tags to InputKeyword source values
          inputKws = extracted.map((kw) => ({
            term: kw.term,
            source: (kw.source === 'guide' ? 'real_guide'
              : kw.source === 'both' ? 'both'
              : 'synthetic') as InputKeyword['source'],
          }))
        }

        const currentSyncMap = useSessionStore.getState().syncMap
        const scored = scoreKeywords(inputKws, transcriptText, slides, currentSyncMap)
        const density = computeSlideDensity(inputKws, slides)

        const densityRecord: Record<number, number> = {}
        density.forEach((v, k) => { densityRecord[k] = v })
        loadSlideDensity(densityRecord)

        if (density.size > 0) {
          const redZoneMap: Record<number, 'likely' | 'red' | null> = {}
          await Promise.all(
            Array.from(density.entries()).map(([pageNumber, score]) => {
              const isRed = score >= 30
              redZoneMap[pageNumber] = isRed ? 'red' : null
              return supabase.from('slides')
                .update({ density_score: score, is_red_zone: isRed })
                .eq('session_id', session.id)
                .eq('page_number', pageNumber)
            }),
          )
          loadSlideZones(redZoneMap)
        }

        const cards = generateFlashcards(scored, currentWords)
        loadFlashcards(cards)

        await supabase.from('keywords').delete().eq('session_id', session.id)
        await supabase.from('flashcards').delete().eq('session_id', session.id)

        if (scored.length > 0) {
          const uid = (await supabase.auth.getUser()).data.user?.id
          if (uid) {
            const rows = await Promise.all(
              scored.map(async (kw) => ({
                session_id: session.id,
                user_id: uid,
                term_encrypted: await encryptText(mk, kw.term),
                source: kw.source,
                zone: kw.zone,
                confidence_score: kw.confidenceScore,
                mention_count: kw.mentionCount,
                dwell_time_ms: kw.dwellTimeMs,
                emphasis_score: kw.emphasisScore,
                lecture_confidence: kw.lectureConfidence,
                slide_indices: kw.slideIndices,
              })),
            )

            const { data: inserted, error } = await supabase
              .from('keywords')
              .insert(rows)
              .select('id, term_encrypted, source, zone, confidence_score, mention_count, dwell_time_ms, emphasis_score, lecture_confidence, slide_indices')

            if (error) {
              console.error('[keywords] insert failed:', error.message)
            } else if (inserted) {
              const loaded: StoredKeyword[] = await Promise.all(
                inserted.map(async (k) => ({
                  id: k.id as string,
                  term: await decryptText(mk, k.term_encrypted as string),
                  source: k.source as StoredKeyword['source'],
                  zone: k.zone as StoredKeyword['zone'],
                  confidenceScore: k.confidence_score as number,
                  mentionCount: k.mention_count as number,
                  dwellTimeMs: k.dwell_time_ms as number,
                  emphasisScore: k.emphasis_score as number,
                  lectureConfidence: k.lecture_confidence as number,
                  slideIndices: (k.slide_indices as number[]) ?? [],
                })),
              )
              loadKeywords(loaded)
            }

            if (cards.length > 0) {
              const fcRows = await Promise.all(
                cards.map(async (c) => ({
                  id: c.id,
                  session_id: session.id,
                  user_id: uid,
                  front_encrypted: await encryptText(mk, c.front),
                  back_encrypted: await encryptText(mk, c.back),
                  slide_index: c.slideIndex,
                  zone: c.zone,
                })),
              )
              await supabase.from('flashcards').insert(fcRows)

              // Enhance flashcard backs with Claude (non-blocking — falls back to originals on error)
              void enhanceFlashcards({
                sessionId: session.id,
                scored,
                cards,
                slides,
                words: currentWords,
                mk,
                supabase,
                loadFlashcards,
              })
            }
          }
        }

        if (guideType !== 'synthetic') {
          if (scored.length > 0) {
            useNotificationStore.getState().notify({
              type: 'success',
              message: 'Red Zone keywords identified',
              duration: 3000,
            })
            await supabase.from('sessions').update({ has_study_guide: true, guide_type: guideType }).eq('id', session.id)
          }
        } else if (scored.length > 0) {
          await supabase.from('sessions').update({ has_study_guide: true, guide_type: 'synthetic' }).eq('id', session.id)
        }
      } catch (e) {
        console.error('[SessionClient] scoring error:', e)
      } finally {
        setIsScoring(false)
      }
    },
    [isScoring, session.id, supabase, loadKeywords, loadFlashcards, loadSlideDensity, loadSlideZones, initialUserField],
  )

  // ── Live recording ────────────────────────────────────────────────────────
  const handleStartRecording = useCallback(() => {
    const mk = getMasterKey()
    if (!mk || isRecording) return
    setIsRecording(true)
    setLiveStatus({ phase: 'requesting_mic' })
    stopLiveRef.current = startLiveTranscription(
      supabase,
      session.id,
      mk,
      (words) => {
        // Filter out the model-warmup chunk (chunkStartMs = -99999, so startMs < 0)
        const valid = words.filter((w) => w.startMs >= 0)
        if (valid.length > 0) addTranscriptWords(valid.map((w) => ({ ...w, slideIndex: null })))
      },
      setLiveStatus,
    )
  }, [isRecording, supabase, session.id, addTranscriptWords])

  const handleStopRecording = useCallback(async () => {
    if (!stopLiveRef.current) return
    const stopFn = stopLiveRef.current
    stopLiveRef.current = null
    setLiveStatus({ phase: 'saving' })

    try {
      const blob = await stopFn()
      if (blob) {
        const mk = getMasterKey()
        if (!mk) throw new Error('Vault locked')
        const buf = await blob.arrayBuffer()
        await addFilesToExistingSession(
          supabase,
          [{ data: buf, name: 'live-recording.webm', mimeType: blob.type || 'audio/webm', type: 'audio', sizeBytes: buf.byteLength }],
          userId,
          session.id,
          () => {},
        )
        // Words already in DB from live transcription — mark directly as transcribed
        await supabase.from('sessions').update({ has_audio: true, status: 'transcribed' }).eq('id', session.id)
        useSessionStore.getState().setHasAudio(true)
        useNotificationStore.getState().notify({ type: 'success', message: 'Recording saved', duration: 3000 })
      }
    } catch (e) {
      console.error('[SessionClient] live save error:', e)
      useNotificationStore.getState().notify({ type: 'error', message: 'Failed to save recording', duration: 4000 })
    } finally {
      setIsRecording(false)
      setLiveStatus({ phase: 'idle' })
    }
  }, [supabase, session.id, userId])

  // ── Callback from PdfViewer after fresh slide extraction ─────────────────
  const handleSlidesExtracted = useCallback(() => {
    if (session.has_study_guide && session.guide_type !== 'synthetic' && session.guide_type !== null) return
    const hasKws = useSessionStore.getState().keywords.length > 0
    if (!hasKws && !isScoring) {
      handleScore({ type: 'extract', guideText: null })
    }
  }, [isScoring, handleScore, session.has_study_guide, session.guide_type])

  // ── Auto-score ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session.has_slides) return
    if (session.has_study_guide && session.guide_type !== 'synthetic' && session.guide_type !== null) return
    const hasKws = useSessionStore.getState().keywords.length > 0
    if (!hasKws && ['ready', 'synced'].includes(session.status) && !isScoring) {
      handleScore({ type: 'extract', guideText: null })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, session.has_slides])

  // ── Scrubber pointer handlers ─────────────────────────────────────────────
  const seekFromPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!trackRef.current || durationMs === 0) return
      const rect = trackRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      seekTo(Math.round(ratio * durationMs))
    },
    [durationMs, seekTo],
  )

  const handleTrackDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      isDragging.current = true
      ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      seekFromPointer(e)
    },
    [seekFromPointer],
  )

  const handleTrackMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return
      seekFromPointer(e)
    },
    [seekFromPointer],
  )

  const handleTrackUp = useCallback(() => { isDragging.current = false }, [])

  const togglePlay = useCallback(() => {
    const el = getAudioEl()
    if (!el) return
    if (isPlaying) el.pause()
    else el.play().catch(() => {})
  }, [isPlaying])

  // ── Transcript ribbon tokens ─────────────────────────────────────────────
  const ribbonTokens = useMemo(() => {
    if (transcriptWords.length === 0) return []
    return transcriptWords
      .filter((w) => w.startMs >= currentTimeMs - 3000 && w.startMs <= currentTimeMs + 20000)
      .slice(0, 60)
  }, [transcriptWords, currentTimeMs])

  const keywordTerms = useMemo(
    () => new Set(keywords.flatMap((k) => k.term.toLowerCase().split(/\s+/))),
    [keywords],
  )

  const keywordZoneMap = useMemo(() => {
    const map = new Map<string, 'red' | 'likely'>()
    for (const k of keywords) {
      for (const part of k.term.toLowerCase().split(/\s+/)) {
        if (!map.has(part)) map.set(part, k.zone)
      }
    }
    return map
  }, [keywords])

  // ── Live transcript — last 80 words from store ───────────────────────────
  const recentLiveWords = useMemo(
    () => (isRecording ? transcriptWords.slice(-80) : []),
    [isRecording, transcriptWords],
  )

  // ── Derived values ───────────────────────────────────────────────────────
  const pct = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0
  const currentZone = slideZoneMap[currentPage] ?? null
  const hasAudioFile = hasAudio && !!audioFile

  // ── Layout ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div style={{ height: 54, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #16151E', background: '#0B0B11', gap: 12 }}>
        {/* Left: breadcrumb */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 11 }}>
          <button
            type="button"
            onClick={() => router.push('/vault')}
            style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, border: '1px solid #1E1E2E', background: '#0D0D14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', cursor: 'pointer' }}
          >
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4 L6 9 L11 14" /></svg>
          </button>
          <button type="button" onClick={() => router.push('/vault')} style={{ fontSize: 12.5, color: '#5B6478', background: 'none', border: 'none', padding: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>Vault</button>
          <span style={{ color: '#2D2B45' }}>/</span>
          <SessionTitle sessionId={session.id} />
          {session.status === 'synced' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 9999, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', flexShrink: 0 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#A78BFA' }} />
              <span style={{ fontSize: 10.5, color: '#C4B5FD', fontWeight: 500 }}>Synced</span>
            </span>
          )}
          {isScoring && (
            <span style={{ fontSize: 10.5, color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Scoring…</span>
          )}
        </div>

        {/* Center: mode tabs */}
        <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, border: '1px solid #1E1E2E', background: '#0D0D14', flexShrink: 0 }}>
          {(['lecture', 'study', 'notes', 'ask'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                height: 28, padding: '0 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
                background: tab === t ? '#1E1D2E' : 'transparent',
                color: tab === t ? '#E2E8F0' : '#5B6478',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Right: subject tag + search + export */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
          <CourseTagPicker sessionId={session.id} initialTag={session.course_tag} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #1E1E2E', background: '#0D0D14', width: 208 }}>
            <span style={{ color: '#3F485C', display: 'flex', flexShrink: 0 }}><svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="8" cy="8" r="5.5" /><path d="M12.5 12.5 L16 16" /></svg></span>
            <span style={{ fontSize: 12, color: '#3F485C', whiteSpace: 'nowrap' }}>Search transcript &amp; keywords</span>
          </div>
          <button
            type="button"
            style={{ height: 32, padding: '0 13px', display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 8, border: '1px solid #2D2B45', background: 'transparent', fontSize: 12.5, color: '#CBD5E1', cursor: 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2 V11 M5.5 7.5 L9 11 L12.5 7.5 M3 14 H15" /></svg>
            Export
          </button>
        </div>
      </div>

      {/* ── Body — switches per mode ──────────────────────────────────────── */}

      {/* STUDY mode */}
      {tab === 'study' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {flashcards.length > 0 ? (
            <FlashcardPanel sessionTitle={sessionTitle ?? ''} userId={userId} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <span className="text-text-tertiary text-body-sm">No flashcards yet — add a study guide or let Nocturne score your slides.</span>
            </div>
          )}
        </div>
      )}

      {/* NOTES mode */}
      {tab === 'notes' && (
        <div className="flex-1 min-h-0 flex flex-col p-6">
          <NotesEditor sessionId={session.id} userId={userId} />
        </div>
      )}

      {/* ASK mode */}
      {tab === 'ask' && (
        <div className="flex-1 min-h-0 flex flex-col p-6">
          <AskPanel sessionId={session.id} userId={userId} />
        </div>
      )}

      {/* LECTURE mode */}
      {tab === 'lecture' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

          {/* Headless audio element — decrypts + registers with store */}
          {hasAudioFile && audioFile && (
            <AudioPlayer audioStoragePath={audioFile.storage_path} headless />
          )}

          {/* Row: outline rail + slide hero */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

            {/* ── Outline rail (170px) ──────────────────────────────────── */}
            <div style={{ width: 170, flexShrink: 0, borderRight: '1px solid #16151E', background: '#0A0A0F', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '13px 14px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5B6478' }}>Outline</span>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, color: '#3F485C' }}>{totalPages > 0 ? `${totalPages} slides` : ''}</span>
              </div>

              {pdfDoc && totalPages > 0 ? (
                <SlideNavStrip
                  pdfDoc={pdfDoc}
                  totalPages={totalPages}
                  currentPage={currentPage}
                  onPageSelect={(page) => {
                    pdfViewerRef.current?.goToPage(page)
                    jumpToSlide(page)
                  }}
                />
              ) : (
                <div style={{ flex: 1 }} />
              )}

              {/* Study guide upload */}
              <div style={{ borderTop: '1px solid #16151E', flexShrink: 0 }}>
                <GuideUpload onGuide={handleScore} isScoring={isScoring} />
              </div>

              {/* Legend */}
              <div style={{ padding: '9px 14px', borderTop: '1px solid #16151E', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FB7185' }} />
                  <span style={{ fontSize: 10, color: '#7C8398' }}>Red</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FBBF24' }} />
                  <span style={{ fontSize: 10, color: '#7C8398' }}>Likely</span>
                </span>
              </div>
            </div>

            {/* ── Slide hero ────────────────────────────────────────────── */}
            <div style={{ flex: 1, minWidth: 0, background: '#070709', display: 'flex', flexDirection: 'column', padding: '22px 26px' }}>
              {/* Hero header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 11, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 12, color: '#5B6478', flexShrink: 0 }}>
                    Slide {String(currentPage).padStart(2, '0')} / {totalPages || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {/* Record live button */}
                  <button
                    type="button"
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    disabled={liveStatus.phase === 'saving'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      height: 32, padding: '0 11px', borderRadius: 8, fontSize: 11.5, cursor: 'pointer',
                      border: isRecording ? '1px solid rgba(251,113,133,0.4)' : '1px solid #23222F',
                      background: isRecording ? 'rgba(251,113,133,0.1)' : '#0D0D14',
                      color: isRecording ? '#FB7185' : '#5B6478',
                      opacity: liveStatus.phase === 'saving' ? 0.5 : 1,
                    }}
                  >
                    {isRecording
                      ? <><Square size={10} strokeWidth={0} style={{ fill: '#FB7185', flexShrink: 0 }} /> Stop</>
                      : <><Mic size={11} strokeWidth={1.5} style={{ flexShrink: 0 }} /> Record live</>
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.max(1, currentPage - 1)
                      pdfViewerRef.current?.goToPage(p)
                      jumpToSlide(p)
                    }}
                    disabled={currentPage <= 1}
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #23222F', background: '#0D0D14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: currentPage <= 1 ? '#2D2B45' : '#94A3B8', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4 L6 9 L11 14" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.min(totalPages, currentPage + 1)
                      pdfViewerRef.current?.goToPage(p)
                      jumpToSlide(p)
                    }}
                    disabled={currentPage >= totalPages}
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #23222F', background: '#0D0D14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: currentPage >= totalPages ? '#2D2B45' : '#94A3B8', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4 L12 9 L7 14" /></svg>
                  </button>
                </div>
              </div>

              {/* PDF canvas area + zone chip */}
              <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 12, border: '1px solid #1B1B27', overflow: 'hidden' }}>
                {hasSlides && pdfFile ? (
                  <PdfViewer
                    ref={pdfViewerRef}
                    storagePath={pdfFile.storage_path}
                    sessionId={session.id}
                    onSlidesExtracted={handleSlidesExtracted}
                    onPdfDocReady={(doc, pages) => { setPdfDoc(doc); setTotalPages(pages) }}
                    onPageChange={setCurrentPage}
                  />
                ) : (
                  <GuidedEmptyState variant="pdf" />
                )}

                {/* Zone chip — top-left of canvas */}
                {currentZone && (
                  <div style={{
                    position: 'absolute', top: 14, left: 14,
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '5px 10px', borderRadius: 8,
                    background: currentZone === 'red' ? 'rgba(251,113,133,0.15)' : 'rgba(251,191,36,0.13)',
                    border: `1px solid ${currentZone === 'red' ? 'rgba(251,113,133,0.35)' : 'rgba(251,191,36,0.3)'}`,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: currentZone === 'red' ? '#FB7185' : '#FBBF24', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: currentZone === 'red' ? '#FDA4AF' : '#FDE68A' }}>
                      {currentZone === 'red' ? 'Red Zone' : 'Likely Zone'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Timeline spine ────────────────────────────────────────────── */}
          {hasAudioFile && (
            <div style={{ flexShrink: 0, borderTop: '1px solid #16151E', background: '#0A0A0F', padding: '13px 26px 15px' }}>

              {/* Ribbon toggle + clock */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
                <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 9, border: '1px solid #1E1E2E', background: '#0D0D14' }}>
                  {(['transcript', 'density'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRibbon(r)}
                      style={{
                        height: 26, padding: '0 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                        background: ribbon === r ? '#1E1D2E' : 'transparent',
                        color: ribbon === r ? '#E2E8F0' : '#5B6478',
                        boxShadow: ribbon === r ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
                      }}
                    >
                      {r === 'transcript' ? 'Transcript' : 'Red Zone density'}
                    </button>
                  ))}
                </div>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, color: '#5B6478' }}>
                  Slide {String(currentPage).padStart(2, '0')} / {totalPages || '—'} · {formatTime(currentTimeMs)} / {formatTime(durationMs)}
                </span>
              </div>

              {/* Ribbon body */}
              <div style={{ height: 62, marginBottom: 11 }}>
                {ribbon === 'transcript' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: '100%' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {ribbonTokens.length > 0 ? (
                        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: '#7C8398', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {ribbonTokens.map((w) => {
                            const clean = w.word.toLowerCase().replace(/[^a-z0-9]/g, '')
                            const zone = keywordZoneMap.get(clean)
                            return (
                              <span
                                key={w.id}
                                style={zone ? {
                                  color: zone === 'red' ? '#FDA4AF' : '#FDE68A',
                                  background: zone === 'red' ? 'rgba(251,113,133,0.12)' : 'rgba(251,191,36,0.1)',
                                  borderRadius: 4,
                                  padding: '0 2px',
                                } : undefined}
                              >
                                {w.word}{' '}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: '#3F485C', fontStyle: 'italic' }}>No transcript yet</span>
                      )}
                    </div>
                    {ribbonTokens.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { if (ribbonTokens[0]) seekTo(ribbonTokens[0].startMs) }}
                        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 13px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.34)', background: 'rgba(99,102,241,0.1)', color: '#A5B4FC', fontSize: 12, cursor: 'pointer' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 18 18" fill="#A5B4FC"><path d="M5 3 L14 9 L5 15 Z" /></svg>
                        Play from here
                      </button>
                    )}
                  </div>
                ) : (
                  /* Density bars */
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 46 }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                        const score = slideDensityMap[pageNum] ?? 0
                        const zone = slideZoneMap[pageNum]
                        const barColor = zone === 'red' ? '#FB7185' : zone === 'likely' ? '#FBBF24' : '#2D2B45'
                        const height = Math.max(4, Math.round((score / 100) * 46))
                        return (
                          <div
                            key={pageNum}
                            style={{ flex: 1, height, background: barColor, borderRadius: '2px 2px 0 0', opacity: pageNum === currentPage ? 1 : 0.65 }}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Scrubber row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Play/pause */}
                <button
                  type="button"
                  onClick={togglePlay}
                  style={{ width: 38, height: 38, flexShrink: 0, borderRadius: '50%', background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#09090F', border: 'none', cursor: 'pointer' }}
                >
                  {isPlaying
                    ? <Pause size={14} strokeWidth={2} />
                    : <Play size={14} strokeWidth={2} style={{ transform: 'translateX(1px)' }} />
                  }
                </button>

                {/* Current time */}
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11.5, color: '#94A3B8', flexShrink: 0, width: 38 }}>
                  {formatTime(currentTimeMs)}
                </span>

                {/* Track */}
                <div
                  ref={trackRef}
                  onPointerDown={handleTrackDown}
                  onPointerMove={handleTrackMove}
                  onPointerUp={handleTrackUp}
                  style={{ position: 'relative', flex: 1, height: 18, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                  role="slider"
                  aria-valuenow={Math.round(currentTimeMs / 1000)}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(durationMs / 1000)}
                  aria-label="Seek"
                >
                  {/* Baseline */}
                  <div style={{ position: 'absolute', left: 0, right: 0, height: 5, borderRadius: 9999, background: '#16151F' }} />
                  {/* Fill */}
                  <div style={{ position: 'absolute', left: 0, height: 5, borderRadius: 9999, background: 'linear-gradient(90deg,#6366F1,#818CF8)', width: `${pct}%`, pointerEvents: 'none' }} />
                  {/* Slide ticks */}
                  {durationMs > 0 && syncMap.map((seg, i) => {
                    const tickPct = (seg.startMs / durationMs) * 100
                    if (tickPct <= 0.5 || tickPct >= 99.5) return null
                    return (
                      <div
                        key={i}
                        style={{ position: 'absolute', left: `${tickPct}%`, top: -1, width: 2, height: 7, background: 'rgba(255,255,255,0.18)', transform: 'translateX(-50%)', pointerEvents: 'none' }}
                      />
                    )
                  })}
                  {/* Playhead dot */}
                  <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', width: 13, height: 13, borderRadius: '50%', background: '#A5B4FC', boxShadow: '0 0 0 4px rgba(165,180,252,0.18)', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
                </div>

                {/* Total time */}
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11.5, color: '#5B6478', flexShrink: 0, width: 38, textAlign: 'right' }}>
                  {durationMs > 0 ? formatTime(durationMs) : '--:--'}
                </span>
              </div>

              {/* Caption */}
              <div style={{ marginTop: 9, fontSize: 11, color: '#3F485C', textAlign: 'center' }}>
                Scrub the timeline or pick a slide — audio, transcript and slides stay locked together.
              </div>
            </div>
          )}

          {/* ── Live recording pane ─────────────────────────────────────────── */}
          {tab === 'lecture' && isRecording && (
            <div style={{ flexShrink: 0, borderTop: '1px solid #16151E', background: '#0A0A0F', display: 'flex', flexDirection: 'column', maxHeight: 140 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 22px 6px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FB7185', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <span style={{ fontSize: 11.5, color: '#94A3B8' }}>
                    {liveStatus.phase === 'requesting_mic' && 'Requesting microphone…'}
                    {liveStatus.phase === 'model_loading' && `Loading Whisper model… ${liveStatus.progress}%`}
                    {liveStatus.phase === 'recording' && `Recording · ${formatTime(liveStatus.elapsedSec * 1000)}`}
                    {liveStatus.phase === 'saving' && 'Saving recording…'}
                    {liveStatus.phase === 'error' && `Error: ${liveStatus.message}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleStopRecording}
                  disabled={liveStatus.phase === 'saving'}
                  style={{ height: 26, padding: '0 10px', borderRadius: 7, border: '1px solid rgba(251,113,133,0.35)', background: 'rgba(251,113,133,0.08)', color: '#FB7185', fontSize: 11.5, cursor: liveStatus.phase === 'saving' ? 'not-allowed' : 'pointer', opacity: liveStatus.phase === 'saving' ? 0.5 : 1 }}
                >
                  Stop & save
                </button>
              </div>

              {/* Streaming words */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '2px 22px 10px', fontSize: 13, color: '#5B6478', lineHeight: 1.65 }}>
                {recentLiveWords.length > 0
                  ? recentLiveWords.map((w) => {
                      const clean = w.word.toLowerCase().replace(/[^a-z0-9]/g, '')
                      const zone = keywordZoneMap.get(clean)
                      return (
                        <span
                          key={w.id}
                          style={zone ? {
                            color: zone === 'red' ? '#FDA4AF' : '#FDE68A',
                            background: zone === 'red' ? 'rgba(251,113,133,0.1)' : 'rgba(251,191,36,0.08)',
                            borderRadius: 3,
                            padding: '0 2px',
                          } : undefined}
                        >
                          {w.word}{' '}
                        </span>
                      )
                    })
                  : <span style={{ color: '#3F485C', fontStyle: 'italic' }}>Words will appear here as you speak…</span>
                }
              </div>
            </div>
          )}
        </div>
      )}

      <KeyboardShortcutOverlay />
    </div>
  )
}
