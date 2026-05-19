'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { isVaultUnlocked, getMasterKey } from '@/lib/crypto/vault'
import { decryptText } from '@/lib/crypto/decrypt'
import { encryptText } from '@/lib/crypto/encrypt'
import { createClient } from '@/lib/supabase'
import { startTranscription, type TranscriptionProgress } from '@/lib/transcription'
import { startSync, type SyncProgress } from '@/lib/sync/sync-engine'
import { scoreKeywords, computeSlideDensity } from '@/lib/scoring/keyword-scorer'
import { generateFlashcards } from '@/lib/scoring/flashcard-generator'
import { generateSyntheticGuide } from '@/lib/study-guide/synthetic'
import { useSessionStore } from '@/store/session-store'
import { useNotificationStore } from '@/store/notification-store'
import { SessionTitle } from '@/components/session/session-title'
import { KeyboardShortcutOverlay } from '@/components/session/keyboard-shortcut-overlay'
import { GuidedEmptyState } from '@/components/session/guided-empty-state'
import { UploadPanel } from '@/components/ingestion/upload-panel'
import { AudioPlayer } from '@/components/audio/audio-player'
import { PdfViewer } from '@/components/pdf/pdf-viewer'
import { TranscriptionControls } from '@/components/transcript/transcription-controls'
import { TranscriptPane } from '@/components/transcript/transcript-pane'
import { GuideUpload, type GuideSource } from '@/components/study-guide/guide-upload'
import { KeywordChipRow } from '@/components/study-guide/keyword-chip-row'
import { KeywordSidePanel } from '@/components/study-guide/keyword-side-panel'
import { FlashcardPanel } from '@/components/study-guide/flashcard-panel'
import { YouTubePanel } from '@/components/youtube/youtube-panel'
import type { TranscriptWordEntry, StoredKeyword, Flashcard } from '@/store/session-store'
import type { SyncSegment } from '@/lib/sync/playhead-tracker'
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
}

interface Props {
  userId: string
  session: Session
  pdfFile: { id: string; storage_path: string; iv: string } | null
  audioFile: { id: string; storage_path: string } | null
}

export function SessionClient({ userId, session, pdfFile, audioFile }: Props) {
  const router = useRouter()
  const [progress, setProgress] = useState<TranscriptionProgress | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false)
  const [isScoring, setIsScoring] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)
  const syncCancelRef = useRef<(() => void) | null>(null)
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
  const reset = useSessionStore((s) => s.reset)
  const setSessionTitle = useSessionStore((s) => s.setSessionTitle)
  const sessionTitle = useSessionStore((s) => s.sessionTitle)
  const flashcardPanelOpen = useSessionStore((s) => s.flashcardPanelOpen)
  const toggleFlashcardPanel = useSessionStore((s) => s.toggleFlashcardPanel)
  const initSessionMeta = useSessionStore((s) => s.initSessionMeta)
  const openUploadPanel = useSessionStore((s) => s.openUploadPanel)
  const isUploadPanelOpen = useSessionStore((s) => s.isUploadPanelOpen)
  const hasSlides = useSessionStore((s) => s.hasSlides)
  const hasAudio = useSessionStore((s) => s.hasAudio)

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
    const canLoad = ['transcribed', 'synced', 'syncing'].includes(session.status)
    if (!canLoad) return

    const mk = getMasterKey()
    if (!mk) return

    setIsLoadingTranscript(true)

    async function loadData() {
      // Load transcript words
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

      // Load sync map if available
      if (session.status === 'synced' || session.status === 'syncing') {
        const { data: syncRow } = await supabase
          .from('sync_map')
          .select('map_encrypted')
          .eq('session_id', session.id)
          .maybeSingle()

        if (syncRow?.map_encrypted) {
          try {
            const mapJson = await decryptText(mk!, syncRow.map_encrypted as string)
            const { segments } = JSON.parse(mapJson) as { segments: SyncSegment[] }
            loadSyncMap(segments)
          } catch {
            // Corrupt sync map — non-fatal
          }
        }
      }

      // Load keywords from DB
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
    }

    loadData()
      .catch((e) => console.error('[SessionClient] data load error:', e))
      .finally(() => setIsLoadingTranscript(false))
  }, [session.id, session.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset store on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelRef.current?.()
      syncCancelRef.current?.()
      reset()
    }
  }, [reset])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const SEEK_STEP = 5000
    const SEEK_LONG = 30

    function handler(e: KeyboardEvent) {
      // Guard: never fire while the student is typing in any input or editable field.
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
          if (!store._audioEl) return
          if (store.isPlaying) store._audioEl.pause()
          else store._audioEl.play().catch(() => {})
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
          if (prev) jumpToSlide(prev.slideIndex)
          break
        }
        case ']': {
          e.preventDefault()
          const next = store.syncMap.find((s) => s.startMs > store.currentTimeMs + 500)
          if (next) jumpToSlide(next.slideIndex)
          break
        }
        case '?': {
          store.toggleShortcutOverlay()
          break
        }
        case 't':
        case 'T': {
          store.focusTranscript()
          break
        }
        case 'p':
        case 'P': {
          store.focusPDF()
          break
        }
        case 'e':
        case 'E': {
          store.triggerTitleEdit()
          break
        }
        case 'f':
        case 'F': {
          store.toggleFlashcardPanel()
          break
        }
        case 'y':
        case 'Y': {
          store.toggleYouTubePanel()
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [seekTo, jumpToSlide])

  // ── Transcription handler ────────────────────────────────────────────────
  const handleTranscribe = useCallback(() => {
    if (!audioFile) return
    if (
      progress?.phase === 'decrypting' ||
      progress?.phase === 'modelLoading' ||
      progress?.phase === 'transcribing'
    ) return

    loadTranscriptWords([])
    setProgress({ phase: 'decrypting', modelPct: 0, segmentsComplete: 0, totalSegments: 0, error: null })

    const cancel = startTranscription(
      supabase,
      session.id,
      audioFile.storage_path,
      (p) => {
        setProgress({ ...p })
        if (p.phase === 'done') {
          cancelRef.current?.()
          cancelRef.current = null
          useNotificationStore.getState().notify({ type: 'success', message: 'Transcription complete', duration: 3000 })
        }
      },
      (words) => {
        addTranscriptWords(words.map((w) => ({ ...w, slideIndex: null })))
      },
    )

    cancelRef.current?.()
    cancelRef.current = cancel
  }, [audioFile, progress?.phase, session.id, supabase, addTranscriptWords, loadTranscriptWords])

  // ── Analyze (sync) handler ───────────────────────────────────────────────
  const handleAnalyze = useCallback(() => {
    if (!audioFile || !session.has_slides) return
    const sp = syncProgress?.phase
    if (
      sp === 'fetching' || sp === 'detecting' ||
      sp === 'bert_loading' || sp === 'bert_scoring' || sp === 'writing'
    ) return

    cancelRef.current?.()
    cancelRef.current = null

    setSyncProgress({ phase: 'fetching', modelPct: 0, error: null })

    const cancel = startSync(
      supabase,
      session.id,
      audioFile.storage_path,
      (p) => {
        setSyncProgress({ ...p })
        if (p.phase === 'done') {
          useNotificationStore.getState().notify({ type: 'success', message: 'Slides mapped to transcript', duration: 3000 })
          const mk = getMasterKey()
          if (!mk) return
          ;(async () => {
            try {
              const { data } = await supabase
                .from('sync_map')
                .select('map_encrypted')
                .eq('session_id', session.id)
                .maybeSingle()
              if (data?.map_encrypted) {
                const mapJson = await decryptText(mk, data.map_encrypted as string)
                const { segments } = JSON.parse(mapJson) as { segments: SyncSegment[] }
                loadSyncMap(segments)
              }
            } catch { /* non-fatal */ }
          })()
        }
      },
    )

    syncCancelRef.current?.()
    syncCancelRef.current = cancel
  }, [audioFile, session.has_slides, session.id, supabase, syncProgress?.phase, loadSyncMap])

  // ── Scoring handler: called after guide upload or manual trigger ─────────
  const handleScore = useCallback(
    async (inputTerms: string[], source: 'real_guide' | 'synthetic' | 'anki') => {
      const mk = getMasterKey()
      if (!mk || isScoring) return

      setIsScoring(true)
      try {
        // Fetch slide texts (encrypted) from DB
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

        // If no terms provided, generate synthetic guide from slide text + transcript
        let terms = inputTerms
        if (terms.length === 0) {
          terms = generateSyntheticGuide(
            slides.map((s) => s.text),
            currentWords.map((w) => w.word),
          )
          source = 'synthetic'
        }

        const inputKws: InputKeyword[] = terms.map((t) => ({ term: t, source }))

        const currentSyncMap = useSessionStore.getState().syncMap
        const scored = scoreKeywords(inputKws, transcriptText, slides, currentSyncMap)
        const density = computeSlideDensity(inputKws, slides)

        // Convert density map for store (Map → Record)
        const densityRecord: Record<number, number> = {}
        density.forEach((v, k) => { densityRecord[k] = v })
        loadSlideDensity(densityRecord)

        // Generate flashcards
        const cards = generateFlashcards(scored, currentWords)
        loadFlashcards(cards)

        // Persist keywords to DB — delete old ones first, then insert fresh
        await supabase.from('keywords').delete().eq('session_id', session.id)

        if (scored.length > 0) {
          const userId = (await supabase.auth.getUser()).data.user?.id
          if (userId) {
            const rows = await Promise.all(
              scored.map(async (kw) => ({
                session_id: session.id,
                user_id: userId,
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

            if (!error && inserted) {
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
          }
        }

        useNotificationStore.getState().notify({ type: 'success', message: 'Red Zone keywords identified', duration: 3000 })

        // Update session has_study_guide flag if real/anki source
        if (source !== 'synthetic') {
          await supabase
            .from('sessions')
            .update({ has_study_guide: true })
            .eq('id', session.id)
        }
      } catch (e) {
        console.error('[SessionClient] scoring error:', e)
      } finally {
        setIsScoring(false)
      }
    },
    [isScoring, session.id, supabase, loadKeywords, loadFlashcards, loadSlideDensity],
  )

  // ── Guide upload callback ────────────────────────────────────────────────
  const handleGuide = useCallback(
    (terms: string[], guideSource: GuideSource) => {
      const source: 'real_guide' | 'anki' =
        guideSource === 'anki' ? 'anki' : 'real_guide'
      handleScore(terms, source)
    },
    [handleScore],
  )

  // ── YouTube flashcard callback — merges caption cards into store + DB ────
  const handleYouTubeFlashcards = useCallback(
    async (newCards: Flashcard[]) => {
      if (newCards.length === 0) return
      const mk = getMasterKey()
      if (!mk) return

      // Merge into store (append to existing flashcards)
      const existing = useSessionStore.getState().flashcards
      loadFlashcards([...existing, ...newCards])

      // Persist to DB
      try {
        const userId = (await supabase.auth.getUser()).data.user?.id
        if (!userId) return
        const rows = await Promise.all(
          newCards.map(async (fc) => ({
            session_id: session.id,
            user_id: userId,
            keyword_id: null,
            front_encrypted: await encryptText(mk, fc.front),
            back_encrypted: await encryptText(mk, fc.back),
            slide_index: fc.slideIndex,
            zone: fc.zone,
          })),
        )
        await supabase.from('flashcards').insert(rows)
      } catch (e) {
        console.error('[SessionClient] YouTube flashcard persist error:', e)
      }
    },
    [session.id, supabase, loadFlashcards],
  )

  // ── Auto-score: run synthetic guide when no keywords yet and synced ──────
  useEffect(() => {
    const hasKeywords = useSessionStore.getState().keywords.length > 0
    const isSynced = session.status === 'synced'
    if (!hasKeywords && isSynced && !isScoring) {
      handleScore([], 'synthetic')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status])

  // ── Layout ───────────────────────────────────────────────────────────────

  const inputBadges = [
    session.has_slides && 'Slides',
    session.has_audio && 'Audio',
    session.has_study_guide && 'Guide',
  ]
    .filter(Boolean)
    .join(' · ')

  const isTranscribedOrBeyond =
    progress?.phase === 'done' ||
    ['transcribed', 'syncing', 'synced'].includes(session.status)

  const hasKeywords = keywords.length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="h-11 flex items-center justify-between px-4 border-b border-border-default shrink-0">
        <SessionTitle sessionId={session.id} />
        <div className="flex items-center gap-3">
          {isScoring && (
            <span className="text-caption uppercase tracking-wide text-amber-200 animate-pulse-slow">
              Scoring…
            </span>
          )}
          {(syncProgress?.phase === 'done' || session.status === 'synced') && (
            <span className="text-caption uppercase tracking-wide text-purple-300">Synced</span>
          )}
          {syncProgress?.phase !== 'done' &&
            session.status !== 'synced' &&
            isTranscribedOrBeyond && (
              <span className="text-caption uppercase tracking-wide text-teal-300">Transcribed</span>
            )}
          <span className="text-label text-text-tertiary">{inputBadges}</span>
          <button
            type="button"
            onClick={openUploadPanel}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-btn text-caption text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors"
          >
            <Plus size={12} strokeWidth={1.5} />
            Add files
          </button>
        </div>
      </div>

      {/* ── Three panes ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* Audio pane — 20% */}
        <div
          className="shrink-0 border-r border-border-default flex flex-col overflow-hidden bg-bg-elevated"
          style={{ width: '20%' }}
        >
          {hasAudio ? (
            <>
              <GuideUpload onGuide={handleGuide} isScoring={isScoring} />
              {session.has_audio && (
                <TranscriptionControls
                  progress={progress}
                  syncProgress={syncProgress}
                  sessionStatus={session.status}
                  hasAudio={session.has_audio}
                  hasSlides={session.has_slides}
                  onTranscribe={handleTranscribe}
                  onAnalyze={handleAnalyze}
                />
              )}
              {audioFile && isTranscribedOrBeyond && (
                <div className="flex-1 min-h-0 border-t border-border-default">
                  <AudioPlayer audioStoragePath={audioFile.storage_path} />
                </div>
              )}
            </>
          ) : (
            <GuidedEmptyState variant="audio" />
          )}
        </div>

        {/* Transcript pane — 45% */}
        <div
          id="transcript-pane"
          className="shrink-0 border-r border-border-default overflow-hidden flex flex-col"
          style={{ width: '45%' }}
        >
          {!hasAudio && !hasSlides ? (
            <GuidedEmptyState variant="transcript" />
          ) : (
            <TranscriptPane
              progress={progress}
              sessionStatus={session.status}
              hasAudio={session.has_audio}
              isLoadingTranscript={isLoadingTranscript}
              onTranscribe={handleTranscribe}
            />
          )}
        </div>

        {/* PDF pane — 35% (flex-1) */}
        <div id="pdf-pane" className="flex-1 flex flex-col overflow-hidden relative">
          {hasSlides && pdfFile ? (
            <PdfViewer
              storagePath={pdfFile.storage_path}
              sessionId={session.id}
            />
          ) : (
            <GuidedEmptyState variant="pdf" />
          )}

          {/* Keyword side panel overlays the PDF pane */}
          <KeywordSidePanel />

          {/* YouTube panel overlays the PDF pane (z-10, above keyword panel) */}
          <YouTubePanel onNewFlashcards={handleYouTubeFlashcards} />

          {/* Upload panel slides in from the right, overlaying the PDF pane */}
          <AnimatePresence>
            {isUploadPanelOpen && (
              <UploadPanel sessionId={session.id} userId={userId} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────────────── */}
      {hasKeywords && (
        <div className="shrink-0 flex flex-col border-t border-border-default">
          <KeywordChipRow />

          {/* Score button + flashcard toggle */}
          <div className="flex items-center justify-between px-4 py-1.5 border-t border-border-default">
            <button
              type="button"
              disabled={isScoring}
              onClick={() => handleScore([], 'synthetic')}
              className="text-label text-text-tertiary hover:text-text-secondary transition-colors disabled:opacity-40"
            >
              {isScoring ? 'Scoring…' : 'Re-score'}
            </button>
            <button
              type="button"
              onClick={toggleFlashcardPanel}
              className="text-label text-text-tertiary hover:text-teal-300 transition-colors"
            >
              {flashcardPanelOpen ? 'Hide flashcards' : `Flashcards (${flashcards.length})`}
            </button>
          </div>

          {flashcardPanelOpen && sessionTitle && (
            <FlashcardPanel sessionTitle={sessionTitle} />
          )}
        </div>
      )}
      <KeyboardShortcutOverlay />
    </div>
  )
}
