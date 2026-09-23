'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square } from 'lucide-react'
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
import { assertCanRecordLive } from '@/app/actions/record-live'
import { useSessionStore, getAudioEl } from '@/store/session-store'
import { useNotificationStore } from '@/store/notification-store'
import { SessionTitle } from '@/components/session/session-title'
import { CourseTagPicker } from '@/components/session/course-tag-picker'
import { KeyboardShortcutOverlay } from '@/components/session/keyboard-shortcut-overlay'
import { GuidedEmptyState } from '@/components/session/guided-empty-state'
import { AudioPlayer } from '@/components/audio/audio-player'
import { PdfViewer, type PdfViewerHandle, type SlideEntry } from '@/components/pdf/pdf-viewer'
import { SlideNavStrip } from '@/components/pdf/slide-nav-strip'
import { FlashcardPanel } from '@/components/study-guide/flashcard-panel'
import { NotesEditor } from '@/components/notes/notes-editor'
import { AskPanel } from '@/components/ask/ask-panel'
import { hasAccess, type Tier } from '@/lib/tiers/features'
import { LockedFeature } from '@/components/paywall/locked-feature'
import type { TranscriptWordEntry, StoredKeyword, Flashcard } from '@/store/session-store'
import type { InputKeyword, ScoredKeyword } from '@/lib/scoring/keyword-scorer'
import { diffKeywords, normalizeTerm } from '@/lib/rescore/keyword-diff'
import { TranscriptPane } from '@/components/transcript/transcript-pane'
import { SessionSearchBar } from '@/components/session/session-search-bar'
import { TranscriptionControls } from '@/components/transcript/transcription-controls'
import { startTranscription } from '@/lib/transcription'
import type { TranscriptionProgress } from '@/lib/transcription'
import { startSync, type SyncSegment } from '@/lib/sync/sync-engine'
import type { SyncProgress } from '@/lib/sync/sync-engine'

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
  pdfFile: { id: string; storage_path: string } | null
  /** All slide sources for this session, ordered by session_files.order_index. */
  slideFiles: { id: string; storage_path: string }[]
  /**
   * All audio takes for this session, ordered by session_files.order_index.
   * Empty array when the session has no audio yet. Newly-recorded takes are
   * appended client-side via extraAudioFiles state so the timeline renders
   * immediately without a page reload.
   */
  audioFiles: { id: string; storage_path: string }[]
  initialUserField: string | null
  domainPromptDismissed: boolean
  userTier: Tier
}

// Which tabs require an upgraded plan.
const TAB_GATES: Partial<Record<Tab, 'midnight' | 'eclipse'>> = {
  study: 'midnight',
  notes: 'midnight',
  ask: 'eclipse',
}

type Tab = 'lecture' | 'study' | 'notes' | 'ask'

// Data computed during the score phase, held for deferred execution if user confirmation is required.
interface RescorePayload {
  scored:         ScoredKeyword[]
  cards:          Flashcard[]
  densityRecord:  Record<number, number>
  redZoneMap:     Record<number, 'likely' | 'red' | null>
  existingByNorm: Map<string, string>
  removedIds:     string[]
  legacyIds:      string[]
  uid:            string
  guideType:      string
  slides:         { pageNumber: number; text: string }[]
  currentWords:   TranscriptWordEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionClient({ userId, session, pdfFile, slideFiles, audioFiles, initialUserField, domainPromptDismissed, userTier }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('lecture')
  const [isScoring, setIsScoring] = useState(false)
  // Synchronous guard for handleScore — prevents the race where two callers
  // both read isScoring===false before React flushes setIsScoring(true).
  // isScoring state is kept for UI (disabled buttons, spinner); this ref is
  // purely for race prevention and is never used in JSX.
  const isScoringRef = useRef(false)
  // Live session status — refreshed from DB on mount so a stale SSR prop
  // (e.g. 'ingesting' at render time, already 'ready' in DB) doesn't permanently
  // block auto-score or the data load-back.
  const [liveSessionStatus, setLiveSessionStatus] = useState(session.status)
  const [guideModalOpen, setGuideModalOpen] = useState(false)
  const [pendingRescore, setPendingRescore] = useState<{ payload: RescorePayload; reviewCount: number } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [liveStatus, setLiveStatus] = useState<LiveStatus>({ phase: 'idle' })
  const stopLiveRef = useRef<(() => Promise<Blob | null>) | null>(null)
  // Pre-assigned UUID for the current recording take.
  // Set at recording start so transcript_words and the final files row share the same id.
  const liveFileIdRef = useRef<string | null>(null)
  // Takes saved this client session that aren't in the SSR audioFiles prop yet.
  // Appended on a successful live save so the audio timeline renders immediately.
  const [extraAudioFiles, setExtraAudioFiles] = useState<{ id: string; storage_path: string }[]>([])
  const allAudioFiles = [...audioFiles, ...extraAudioFiles]
  const [selectedTakeIdx, setSelectedTakeIdx] = useState(0)
  // The currently displayed audio take — drives AudioPlayer, sync, and TranscriptionControls.
  const audioFile = allAudioFiles[selectedTakeIdx] ?? null
  const [slideEntries, setSlideEntries] = useState<SlideEntry[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [transcriptionProgress, setTranscriptionProgress] = useState<TranscriptionProgress | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false)
  const pdfViewerRef = useRef<PdfViewerHandle | null>(null)
  const playTrackedRef = useRef(false)
  // Holds the decrypted plain-text of the current note once the Notes tab is opened.
  // Updated by NotesEditor via onContentChange; read synchronously by SessionSearchBar.
  const notesTextRef = useRef<string>('')
  const supabase = createClient()

  const jumpToWord = useSessionStore((s) => s.jumpToWord)
  const setActiveKeyword = useSessionStore((s) => s.setActiveKeyword)
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

  // ── Refresh session status from DB on mount ──────────────────────────────
  // Covers the case where the SSR-rendered status was 'ingesting' and has since
  // flipped to 'ready'. Setting liveSessionStatus triggers both the load-back
  // and auto-score effects below.
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase
          .from('sessions')
          .select('status')
          .eq('id', session.id)
          .single()
        if (data?.status && data.status !== session.status) {
          setLiveSessionStatus(data.status as string)
        }
      } catch {
        // non-fatal — SSR value is the safe fallback
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  // ── Load transcript + sync map + keywords from DB on mount ──────────────
  useEffect(() => {
    const canLoad = ['ready', 'transcribed', 'synced', 'syncing'].includes(liveSessionStatus)
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

      // Sync map is loaded by the dedicated audioFile.id effect below,
      // which handles both initial load and take-switching in one place.

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
        .select('global_slide_index, density_score, is_likely_zone, is_red_zone')
        .eq('session_id', session.id)
      if (densityRows) {
        const rec: Record<number, number> = {}
        const zones: Record<number, 'likely' | 'red' | null> = {}
        densityRows.forEach((r) => {
          const gsi = r.global_slide_index as number
          if (r.density_score != null) rec[gsi] = r.density_score as number
          zones[gsi] = (r.is_likely_zone as boolean | null)
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

    setIsLoadingTranscript(true)
    loadData()
      .catch((e) => console.error('[SessionClient] data load error:', e))
      .finally(() => setIsLoadingTranscript(false))
  }, [session.id, liveSessionStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync map — loaded whenever the selected take or session status changes ──
  // Consolidated here (not in loadData) so take-switching is self-contained.
  // Also fires after auto-sync sets liveSessionStatus to 'synced'.
  useEffect(() => {
    const canLoad = ['synced', 'syncing'].includes(liveSessionStatus)
    if (!canLoad || !audioFile) { loadSyncMap([]); return }
    const mk = getMasterKey()
    if (!mk) return

    async function loadTakeSyncMap() {
      // Prefer the take-specific sync_map row written by migration 028+.
      // Fall back to the legacy NULL-file_id row for sessions synced before the migration.
      const { data: fileRow } = await supabase
        .from('sync_map')
        .select('map_encrypted')
        .eq('session_id', session.id)
        .eq('file_id', audioFile!.id)
        .maybeSingle()

      const { data: legacyRow } = fileRow
        ? { data: null }
        : await supabase
            .from('sync_map')
            .select('map_encrypted')
            .eq('session_id', session.id)
            .is('file_id', null)
            .maybeSingle()

      const row = fileRow ?? legacyRow
      if (row?.map_encrypted) {
        try {
          const mapJson = await decryptText(mk!, row.map_encrypted as string)
          const { segments } = JSON.parse(mapJson) as { segments: SyncSegment[] }
          loadSyncMap(segments)
        } catch {
          loadSyncMap([])  // corrupt sync map — non-fatal
        }
      } else {
        loadSyncMap([])
      }
    }

    loadTakeSyncMap().catch(console.error)
  // audioFile.id drives take-switching; liveSessionStatus drives post-sync refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFile?.id, liveSessionStatus])

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

  // ── Execute rescore DB writes ─────────────────────────────────────────────
  // Called directly from handleScore when no confirmation is needed, or from the
  // confirmation dialog after the user approves deletion of SM-2 review history.
  const executeRescore = useCallback(
    async (params: RescorePayload) => {
      const mk = getMasterKey()
      if (!mk) return

      const { scored, cards, densityRecord, redZoneMap, existingByNorm, removedIds, legacyIds, uid, guideType, slides, currentWords } = params

      // TEMP DIAG (1): scored keyword count
      console.log('[diag:1] scored.length =', scored.length)

      // ── Slide density DB writes ────────────────────────────────────────────
      // TEMP DIAG (2): about to write slide density
      console.log('[diag:2] starting slide-density write | densityRecord keys =', Object.keys(densityRecord).length)
      loadSlideDensity(densityRecord)
      if (Object.keys(densityRecord).length > 0) {
        await Promise.all(
          Object.entries(densityRecord).map(([pageStr, score]) => {
            const pageNumber = Number(pageStr)
            const isRed = score >= 30
            // pageNumber is global_slide_index — session-wide consistent
            return supabase.from('slides')
              .update({ density_score: score, is_red_zone: isRed })
              .eq('session_id', session.id)
              .eq('global_slide_index', pageNumber)
          }),
        )
        loadSlideZones(redZoneMap)
      }
      // TEMP DIAG (3): slide-density write done
      console.log('[diag:3] slide-density write complete')

      if (scored.length === 0) {
        useNotificationStore.getState().notify({ type: 'error', message: 'Scoring produced no keywords — slides may lack scorable content', duration: 5000 })
        return
      }

      // ── Clean up NULL-keyword_id flashcards from the old rescore path ──────
      // These are flashcards whose keyword_id was SET NULL when the old path
      // deleted keywords. They have no stable identity and must be replaced.
      await supabase.from('flashcards')
        .delete()
        .eq('session_id', session.id)
        .is('keyword_id', null)

      // ── Keyword upsert ────────────────────────────────────────────────────
      // Delete legacy rows (normalized_term='') and removed recognized rows.
      const idsToDelete = [...legacyIds, ...removedIds]
      if (idsToDelete.length > 0) {
        await supabase.from('keywords').delete().in('id', idsToDelete)
      }

      // Update existing keyword rows in place — preserves IDs and SM-2 chain
      const normToKwId = new Map<string, string>(existingByNorm)
      const kwsToUpdate = scored.filter((kw) => existingByNorm.has(normalizeTerm(kw.term)))

      if (kwsToUpdate.length > 0) {
        const updateRows = await Promise.all(
          kwsToUpdate.map(async (kw) => ({
            id: existingByNorm.get(normalizeTerm(kw.term))!,
            session_id: session.id,
            user_id: uid,
            normalized_term: normalizeTerm(kw.term),
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
        await supabase.from('keywords').upsert(updateRows, { onConflict: 'id' })
      }

      // Insert new keywords (terms with no existing row)
      const kwsToInsert = scored.filter((kw) => !existingByNorm.has(normalizeTerm(kw.term)))
      if (kwsToInsert.length > 0) {
        const insertRows = await Promise.all(
          kwsToInsert.map(async (kw) => ({
            session_id: session.id,
            user_id: uid,
            normalized_term: normalizeTerm(kw.term),
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
        // TEMP DIAG (4): row count and session ID immediately before the insert
        console.log('[diag:4] insertRows.length =', insertRows.length, '| session_id =', session.id)
        const { data: insertedKwRows, error: kwInsertErr } = await supabase
          .from('keywords')
          .insert(insertRows)
          .select('id, normalized_term')

        // TEMP DIAG (5): full error object if present, or confirmation it's null
        console.log('[diag:5] kwInsertErr =', kwInsertErr ? JSON.stringify(kwInsertErr) : null)

        if (kwInsertErr) {
          // PG error 23505 = unique_violation. If it names our partial unique index
          // it means a concurrent handleScore call already inserted these keywords
          // for this session — that call will have loaded everything into the store,
          // so we can silently bail rather than surfacing a spurious error toast.
          // Any other error (different code or different constraint) is a genuine
          // failure and warrants the notification.
          const isRaceDuplicate =
            kwInsertErr.code === '23505' &&
            kwInsertErr.message.includes('keywords_session_normalized_term_idx')
          if (isRaceDuplicate) {
            console.warn('[keywords] unique conflict on insert — concurrent score already completed, no-op')
            return
          }
          console.error('[keywords] insert failed:', kwInsertErr.message)
          useNotificationStore.getState().notify({ type: 'error', message: `Scoring failed: ${kwInsertErr.message}`, duration: 6000 })
          return
        }
        for (const row of insertedKwRows ?? []) {
          normToKwId.set(row.normalized_term as string, row.id as string)
        }
      }

      // Load keywords — IDs come from the now-stable normToKwId map; no DB re-fetch needed
      const loadedKws: StoredKeyword[] = scored.map((kw) => ({
        id: normToKwId.get(normalizeTerm(kw.term))!,
        term: kw.term,
        source: kw.source,
        zone: kw.zone,
        confidenceScore: kw.confidenceScore,
        mentionCount: kw.mentionCount,
        dwellTimeMs: kw.dwellTimeMs,
        emphasisScore: kw.emphasisScore,
        lectureConfidence: kw.lectureConfidence,
        slideIndices: kw.slideIndices,
      }))
      loadKeywords(loadedKws)

      // TEMP DIAG (6): reached flashcard write phase
      console.log('[diag:6] reached flashcard writes | cards.length =', cards.length)

      // ── Flashcard upsert keyed by keyword_id ──────────────────────────────
      if (cards.length > 0) {
        // Fetch existing flashcards by keyword_id so we can reuse their DB IDs.
        // This preserves flashcard_reviews FK chains for unchanged terms.
        const { data: existingFcRows } = await supabase
          .from('flashcards')
          .select('id, keyword_id')
          .eq('session_id', session.id)
          .not('keyword_id', 'is', null)

        const existingFcByKwId = new Map<string, string>(
          (existingFcRows ?? []).map((r) => [r.keyword_id as string, r.id as string]),
        )

        const fcsToUpdate: Flashcard[] = []
        const fcsToInsert: Flashcard[] = []

        for (const card of cards) {
          const kwId = normToKwId.get(normalizeTerm(card.keywordTerm))
          if (!kwId) continue
          const existingFcId = existingFcByKwId.get(kwId)
          if (existingFcId) {
            // Patch card.id to the existing DB id so enhanceFlashcards targets the right row
            card.id = existingFcId
            fcsToUpdate.push(card)
          } else {
            fcsToInsert.push(card)
          }
        }

        // Delete flashcards for removed keywords.
        // The FK is ON DELETE SET NULL, not CASCADE, so we must delete explicitly.
        if (removedIds.length > 0) {
          await supabase.from('flashcards').delete().in('keyword_id', removedIds)
        }

        if (fcsToUpdate.length > 0) {
          const updateFcRows = await Promise.all(
            fcsToUpdate.map(async (c) => ({
              id: c.id,
              session_id: session.id,
              user_id: uid,
              keyword_id: normToKwId.get(normalizeTerm(c.keywordTerm))!,
              front_encrypted: await encryptText(mk, c.front),
              back_encrypted: await encryptText(mk, c.back),
              slide_index: c.slideIndex,
              zone: c.zone,
            })),
          )
          await supabase.from('flashcards').upsert(updateFcRows, { onConflict: 'id' })
        }

        if (fcsToInsert.length > 0) {
          const insertFcRows = await Promise.all(
            fcsToInsert.map(async (c) => ({
              id: c.id,
              session_id: session.id,
              user_id: uid,
              keyword_id: normToKwId.get(normalizeTerm(c.keywordTerm))!,
              front_encrypted: await encryptText(mk, c.front),
              back_encrypted: await encryptText(mk, c.back),
              slide_index: c.slideIndex,
              zone: c.zone,
            })),
          )
          await supabase.from('flashcards').insert(insertFcRows)
        }

        loadFlashcards(cards)

        // Enhance flashcard backs with Claude — Midnight+ only.
        // Dusk users keep the auto-generated backs; no server call is made.
        if (hasAccess(userTier, 'midnight')) {
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

      // ── Session metadata ───────────────────────────────────────────────────
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
    },
    [session.id, supabase, loadKeywords, loadFlashcards, loadSlideDensity, loadSlideZones, userTier],
  )

  // ── Scoring handler ──────────────────────────────────────────────────────
  // payload.type === 'extract': call LLM to extract terms (guide text or null for auto)
  // payload.type === 'anki':    use pre-extracted card fronts directly
  const handleScore = useCallback(
    async (payload: GuidePayload | { type: 'extract'; guideText: string | null }) => {
      const mk = getMasterKey()
      if (!mk) {
        useNotificationStore.getState().notify({ type: 'error', message: 'Vault is locked — unlock before scoring', duration: 4000 })
        return
      }
      if (isScoringRef.current || isScoring || !!pendingRescore) return
      isScoringRef.current = true

      setIsScoring(true)
      try {
        const { data: slideRows } = await supabase
          .from('slides')
          .select('global_slide_index, text_encrypted')
          .eq('session_id', session.id)
          .order('global_slide_index')

        const slides = slideRows
          ? await Promise.all(
              slideRows.map(async (s) => ({
                // Property name kept as 'pageNumber' for keyword-scorer compatibility;
                // value is global_slide_index so citations are session-wide consistent.
                pageNumber: s.global_slide_index as number,
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
            useNotificationStore.getState().notify({ type: 'error', message: `Keyword extraction failed (${resp.status}) — check console`, duration: 5000 })
            return
          }

          const { keywords: extracted } = await resp.json() as {
            keywords: { term: string; source: 'guide' | 'inferred' | 'both' }[]
          }

          if (!extracted?.length) {
            useNotificationStore.getState().notify({ type: 'error', message: 'No keywords found — slides may not have enough text yet', duration: 5000 })
            return
          }

          // Map LLM source tags to InputKeyword source values
          inputKws = extracted.map((kw) => ({
            term: kw.term,
            source: (kw.source === 'guide' ? 'real_guide'
              : kw.source === 'both' ? 'both'
              : 'synthetic') as InputKeyword['source'],
          }))
        }

        // TEMP DIAG: LLM extraction result before scoreKeywords
        console.log('[diag:llm] inputKws.length =', inputKws.length, '| first 5 =', inputKws.slice(0, 5))

        const currentSyncMap = useSessionStore.getState().syncMap
        const scored = scoreKeywords(inputKws, transcriptText, slides, currentSyncMap)
        const density = computeSlideDensity(inputKws, slides)

        const densityRecord: Record<number, number> = {}
        density.forEach((v, k) => { densityRecord[k] = v })

        const redZoneMap: Record<number, 'likely' | 'red' | null> = {}
        density.forEach((score, pageNumber) => { redZoneMap[pageNumber] = score >= 30 ? 'red' : null })

        const cards = generateFlashcards(scored, currentWords)

        const uid = (await supabase.auth.getUser()).data.user?.id
        if (!uid) return

        // ── Diff old vs. new keyword sets for upsert ──────────────────────────
        const { data: existingKwRows } = await supabase
          .from('keywords')
          .select('id, normalized_term, source')
          .eq('session_id', session.id)

        const { existingByNorm, removedIds, legacyIds } = diffKeywords(
          (existingKwRows ?? []).map((r) => ({
            id: r.id as string,
            normalized_term: (r.normalized_term as string) ?? '',
            source: r.source as string,
          })),
          scored.map((kw) => kw.term),
        )

        const rescorePayload: RescorePayload = {
          scored, cards, densityRecord, redZoneMap,
          existingByNorm, removedIds, legacyIds,
          uid, guideType, slides, currentWords,
        }

        // ── Check for SM-2 review history on removed recognized keywords ──────
        if (removedIds.length > 0) {
          const { data: removedFcs } = await supabase
            .from('flashcards')
            .select('id')
            .in('keyword_id', removedIds)
            .eq('session_id', session.id)

          const removedFcIds = (removedFcs ?? []).map((f) => f.id as string)
          let reviewCount = 0

          if (removedFcIds.length > 0) {
            const { count } = await supabase
              .from('flashcard_reviews')
              .select('id', { count: 'exact', head: true })
              .in('flashcard_id', removedFcIds)
            reviewCount = count ?? 0
          }

          if (reviewCount > 0) {
            // Pause and surface a confirmation dialog before deleting review history
            setIsScoring(false)
            setPendingRescore({ payload: rescorePayload, reviewCount })
            return
          }
        }

        await executeRescore(rescorePayload)
      } catch (e) {
        console.error('[SessionClient] scoring error:', e)
      } finally {
        isScoringRef.current = false
        setIsScoring(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isScoring, pendingRescore, session.id, supabase, executeRescore],
  )

  // ── Live recording ────────────────────────────────────────────────────────
  const handleStartRecording = useCallback(async () => {
    const mk = getMasterKey()
    if (!mk || isRecording) return

    // Server-authoritative tier check before requesting mic access or spinning
    // up the Whisper worker.  A Dusk user must not produce a single transcribed
    // word via live recording, not just be blocked from saving the result.
    // The client-side hasAccess guard on the Record Live button is the fast
    // first line; this call is the authoritative backstop before anything starts.
    try {
      await assertCanRecordLive()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Record Live unavailable'
      useNotificationStore.getState().notify({ type: 'error', message: msg, duration: 5000 })
      return
    }

    // Pre-assign the file UUID so transcript_words written during recording and
    // the files row written on stop share the same id — required for scoped sync.
    const fileId = crypto.randomUUID()
    liveFileIdRef.current = fileId

    setIsRecording(true)
    setLiveStatus({ phase: 'requesting_mic' })
    stopLiveRef.current = startLiveTranscription(
      supabase,
      session.id,
      mk,
      fileId,
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

    // Capture the pre-assigned fileId before clearing the ref.
    const fileId = liveFileIdRef.current
    liveFileIdRef.current = null

    setLiveStatus({ phase: 'saving' })

    try {
      const blob = await stopFn()
      if (blob && fileId) {
        const mk = getMasterKey()
        if (!mk) throw new Error('Vault locked')
        const buf = await blob.arrayBuffer()

        // Pass the pre-assigned fileId so the files row uses the same id that
        // was already written to transcript_words.file_id during recording.
        // source: 'recording' marks this for the DB-level RLS gate on
        // transcript_words that blocks recording-sourced rows without midnight+.
        // addFilesToExistingSession throws on any DB write failure and rolls
        // back the storage blob + files row — no silent orphans.
        await addFilesToExistingSession(
          supabase,
          [{
            id: fileId,
            data: buf,
            name: 'live-recording.webm',
            mimeType: blob.type || 'audio/webm',
            type: 'audio',
            source: 'recording',
            sizeBytes: buf.byteLength,
          }],
          userId,
          session.id,
          () => {},
        )

        // Words already in DB from live transcription — mark directly as transcribed.
        // Only set status AFTER addFilesToExistingSession fully succeeds so a failed
        // save never leaves the session in a state that looks like it has audio.
        await supabase.from('sessions').update({ has_audio: true, status: 'transcribed' }).eq('id', session.id)
        useSessionStore.getState().setHasAudio(true)

        // Append the new take to the client-side list so the audio timeline
        // renders immediately (the SSR audioFiles prop is immutable).
        const newTake = { id: fileId, storage_path: `${userId}/recordings/${fileId}.bin` }
        const nextTakeIdx = audioFiles.length + extraAudioFiles.length
        setExtraAudioFiles((prev) => [...prev, newTake])
        setSelectedTakeIdx(nextTakeIdx)

        useNotificationStore.getState().notify({ type: 'success', message: 'Recording saved', duration: 3000 })

        // Auto-sync the just-saved take against the session's existing slides.
        // Fire-and-forget — progress is surfaced via syncProgress → TranscriptionControls.
        // Only when there are slides to sync against; sessions without slides skip silently.
        if (session.has_slides) {
          setSyncProgress(null)
          setLiveSessionStatus('syncing')
          startSync(
            supabase,
            session.id,
            newTake.storage_path,
            setSyncProgress,
            fileId,
            (segments) => {
              // Populate the store directly from the computed segments — no DB round-trip.
              loadSyncMap(segments)
              setLiveSessionStatus('synced')
            },
          )
        }
      }
    } catch (e) {
      console.error('[SessionClient] live save error:', e)
      useNotificationStore.getState().notify({ type: 'error', message: 'Failed to save recording', duration: 4000 })
    } finally {
      setIsRecording(false)
      setLiveStatus({ phase: 'idle' })
    }
  }, [supabase, session.id, session.has_slides, userId, audioFiles.length, extraAudioFiles.length, loadSyncMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Single auto-score gate ────────────────────────────────────────────────
  // Both trigger sites (status change + PdfViewer slide extraction) funnel
  // through here so the synchronous ref guard is checked exactly once before
  // any call reaches handleScore — closing the window where two callers both
  // read isScoringRef.current===false before the first sets it to true.
  //
  // Root-cause fix: the gate queries the DB for existing keywords rather than
  // reading the Zustand store. The store reads 0 before the async load-back
  // completes, causing a false 'no keywords exist' result on every re-entry to
  // an already-scored session. DB count is the authoritative source of truth:
  // if ANY keyword row exists for this session, auto-score never fires.
  const maybeAutoScore = useCallback(async () => {
    if (isScoringRef.current) return
    if (session.has_study_guide && session.guide_type !== 'synthetic' && session.guide_type !== null) return

    // Query DB directly — never trust the client store, which may not yet
    // reflect rows loaded by the concurrent load-back effect.
    const { count, error } = await supabase
      .from('keywords')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id)

    if (error) {
      // Fail safe: if we can't confirm zero keywords, don't fire.
      console.warn('[maybeAutoScore] keywords count query failed, skipping auto-score:', error.message)
      return
    }

    if ((count ?? 0) > 0) return  // session already scored — full stop

    handleScore({ type: 'extract', guideText: null })
  }, [handleScore, session.has_study_guide, session.guide_type, session.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // supabase is captured from the render-scope closure (same pattern as loadData effect above)

  // ── Callback from PdfViewer after fresh slide extraction ─────────────────
  const handleSlidesExtracted = useCallback(() => {
    void maybeAutoScore()  // async — fire-and-forget; errors are caught inside
  }, [maybeAutoScore])

  // ── Auto-score on status change ───────────────────────────────────────────
  // Depends on liveSessionStatus (not the static SSR prop) so it re-evaluates
  // once the mount-time status fetch resolves a stale initial value.
  // maybeAutoScore is intentionally excluded from deps — it changes whenever
  // isScoring changes, which would cause a scoring→complete→re-run loop.
  // The ref guard inside maybeAutoScore makes this safe.
  useEffect(() => {
    if (!session.has_slides) return
    if (!['ready', 'synced'].includes(liveSessionStatus)) return
    void maybeAutoScore()  // async — fire-and-forget; errors are caught inside
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSessionStatus, session.has_slides])

  // ── Transcription / sync handlers ───────────────────────────────────────
  const handleTranscribe = useCallback(() => {
    if (!audioFile) return
    setTranscriptionProgress(null)
    startTranscription(
      supabase,
      session.id,
      audioFile.storage_path,
      setTranscriptionProgress,
      (words) => addTranscriptWords(words.map((w) => ({ ...w, slideIndex: null }))),
    )
  }, [audioFile, session.id, supabase, addTranscriptWords])

  const handleAnalyze = useCallback(() => {
    if (!audioFile) return
    setSyncProgress(null)
    setLiveSessionStatus('syncing')
    startSync(
      supabase,
      session.id,
      audioFile.storage_path,
      setSyncProgress,
      audioFile.id,
      (segments) => {
        loadSyncMap(segments)
        setLiveSessionStatus('synced')
      },
    )
  }, [audioFile, session.id, supabase, loadSyncMap])

  // ── Keyword zone map — used by live recording pane ───────────────────────
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
  const currentZone = slideZoneMap[currentPage] ?? null
  // hasAudioFile: true once the store reflects audio existence AND at least one
  // take is in the combined list (covers newly-saved takes from this client session).
  const hasAudioFile = hasAudio && allAudioFiles.length > 0

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
          {(['lecture', 'study', 'notes', 'ask'] as Tab[]).map((t) => {
            const gate = TAB_GATES[t]
            const locked = !!gate && !hasAccess(userTier, gate)
            const active = tab === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  height: 28, padding: '0 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5,
                  background: active ? '#1E1D2E' : 'transparent',
                  color: active ? '#E2E8F0' : locked ? '#3A4155' : '#5B6478',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {locked && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        {/* Right: subject tag + search + export */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setGuideModalOpen(true)}
            disabled={isScoring}
            style={{
              height: 32, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
              borderRadius: 8, border: '1px solid #23222F', background: '#0D0D14',
              fontSize: 12, color: '#7C8398', cursor: isScoring ? 'not-allowed' : 'pointer',
              opacity: isScoring ? 0.5 : 1, flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="1" width="12" height="16" rx="2" /><path d="M6 6 H12 M6 9 H12 M6 12 H9" />
            </svg>
            Study guide
          </button>
          <CourseTagPicker sessionId={session.id} initialTag={session.course_tag} />
          <SessionSearchBar
            transcriptWords={transcriptWords}
            keywords={keywords}
            notesTextRef={notesTextRef}
            onJumpToTranscript={(wordId, startMs) => {
              setTab('lecture')
              seekTo(startMs)
              jumpToWord(wordId)
            }}
            onJumpToKeyword={(id) => {
              setTab('study')
              setActiveKeyword(id)
            }}
            onJumpToNotes={() => setTab('notes')}
          />
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
        <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col">
          {!hasAccess(userTier, 'midnight') ? (
            <LockedFeature
              requiredTier="midnight"
              feature="Study tab"
              description="Review flashcards with spaced repetition, track mastery, and see per-keyword progress — unlocked on Midnight."
            />
          ) : flashcards.length > 0 ? (
            <FlashcardPanel sessionTitle={sessionTitle ?? ''} sessionId={session.id} userId={userId} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <span className="text-text-tertiary text-body-sm">No flashcards yet — add a study guide or let Nocturne score your slides.</span>
              {session.has_slides && (
                <button
                  type="button"
                  onClick={() => handleScore({ type: 'extract', guideText: null })}
                  disabled={isScoring}
                  style={{
                    marginTop: 4, height: 32, padding: '0 16px',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    borderRadius: 8, border: '1px solid #23222F', background: '#0D0D14',
                    fontSize: 12, color: isScoring ? '#3A4155' : '#7C8398',
                    cursor: isScoring ? 'not-allowed' : 'pointer',
                    opacity: isScoring ? 0.5 : 1,
                  }}
                >
                  {isScoring ? 'Scoring…' : 'Score now'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* NOTES mode */}
      {tab === 'notes' && (
        <div className="flex-1 min-h-0 flex flex-col p-6">
          {!hasAccess(userTier, 'midnight') ? (
            <LockedFeature
              requiredTier="midnight"
              feature="Notes tab"
              description="Write and save encrypted notes per session — unlocked on Midnight."
            />
          ) : (
            <NotesEditor
              sessionId={session.id}
              userId={userId}
              totalSlides={totalPages}
              onGoToSlide={(slideIndex) => {
                setTab('lecture')
                pdfViewerRef.current?.goToPage(slideIndex)
                jumpToSlide(slideIndex)
              }}
              onContentChange={(text) => { notesTextRef.current = text }}
            />
          )}
        </div>
      )}

      {/* ASK mode */}
      {tab === 'ask' && (
        <div className="flex-1 min-h-0 flex flex-col p-6">
          {!hasAccess(userTier, 'eclipse') ? (
            <LockedFeature
              requiredTier="eclipse"
              feature="Ask tab"
              description="Ask questions grounded in this session's slides and transcript — answered by Claude using only your lecture content."
            />
          ) : (
            <AskPanel sessionId={session.id} userId={userId} />
          )}
        </div>
      )}

      {/* LECTURE mode */}
      {tab === 'lecture' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

          {/* Row: outline rail + slide hero */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

            {/* ── Outline rail (170px) ──────────────────────────────────── */}
            <div style={{ width: 170, flexShrink: 0, borderRight: '1px solid #16151E', background: '#0A0A0F', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '13px 14px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5B6478' }}>Outline</span>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, color: '#3F485C' }}>{totalPages > 0 ? `${totalPages} slides` : ''}</span>
              </div>

              {slideEntries.length > 0 ? (
                <SlideNavStrip
                  slides={slideEntries}
                  currentPage={currentPage}
                  onPageSelect={(page) => {
                    pdfViewerRef.current?.goToPage(page)
                    jumpToSlide(page)
                  }}
                />
              ) : (
                <div style={{ flex: 1 }} />
              )}

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
                  {/* Record live button — Midnight+ only */}
                  {hasAccess(userTier, 'midnight') ? (
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
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Upgrade to Midnight to record live"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        height: 32, padding: '0 11px', borderRadius: 8, fontSize: 11.5, cursor: 'not-allowed',
                        border: '1px solid #1B1A29', background: '#0D0D14',
                        color: '#3A4155', opacity: 0.55, flexShrink: 0,
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Record live
                    </button>
                  )}
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
                    fileId={pdfFile.id}
                    slideFiles={slideFiles}
                    sessionId={session.id}
                    onSlidesExtracted={handleSlidesExtracted}
                    onPdfDocReady={(entries, pages) => { setSlideEntries(entries); setTotalPages(pages) }}
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
          {hasAudioFile && audioFile && (
            <div style={{ flexShrink: 0, height: 400, borderTop: '1px solid #16151E', background: '#0A0A0F', display: 'flex', flexDirection: 'column' }}>

              {/* Take selector — only visible when there are multiple audio takes */}
              {allAudioFiles.length > 1 && (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderBottom: '1px solid #16151E' }}>
                  <span style={{ fontSize: 9.5, color: '#3F485C', fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.05em', textTransform: 'uppercase', marginRight: 4 }}>Take</span>
                  {allAudioFiles.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedTakeIdx(i)}
                      style={{
                        height: 22, padding: '0 9px', borderRadius: 5,
                        border: `1px solid ${selectedTakeIdx === i ? '#2D2B45' : 'transparent'}`,
                        background: selectedTakeIdx === i ? '#111119' : 'transparent',
                        color: selectedTakeIdx === i ? '#C4B5FD' : '#5B6478',
                        fontSize: 10.5, fontFamily: 'var(--font-mono), monospace',
                        cursor: 'pointer',
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Transcription controls header */}
              <div style={{ flexShrink: 0 }}>
                <TranscriptionControls
                  progress={transcriptionProgress}
                  syncProgress={syncProgress}
                  sessionStatus={liveSessionStatus}
                  hasAudio={!!audioFile}
                  hasSlides={hasSlides}
                  onTranscribe={handleTranscribe}
                  onAnalyze={handleAnalyze}
                />
              </div>

              {/* Transcript pane */}
              <div style={{ flex: 1, minHeight: 0, borderTop: '1px solid #16151E' }}>
                <TranscriptPane
                  progress={transcriptionProgress}
                  sessionStatus={liveSessionStatus}
                  hasAudio={!!audioFile}
                  isLoadingTranscript={isLoadingTranscript}
                  onTranscribe={handleTranscribe}
                />
              </div>

              {/* Time-axis density ribbon — bars sized by audio duration, not slide count */}
              {syncMap.length > 0 && durationMs > 0 && (
                <div style={{ flexShrink: 0, height: 40, borderTop: '1px solid #16151E', padding: '0 16px', display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ position: 'relative', width: '100%', height: 32 }}>
                    {syncMap.map((seg, i) => {
                      const leftPct  = (seg.startMs / durationMs) * 100
                      const widthPct = ((seg.endMs - seg.startMs) / durationMs) * 100
                      const score    = slideDensityMap[seg.slideIndex] ?? 0
                      const zone     = slideZoneMap[seg.slideIndex]
                      const barColor = zone === 'red' ? '#FB7185' : zone === 'likely' ? '#FBBF24' : '#2D2B45'
                      const barH     = Math.max(3, Math.round((score / 100) * 32))
                      return (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            bottom: 0,
                            height: barH,
                            background: barColor,
                            borderRadius: '2px 2px 0 0',
                            opacity: seg.slideIndex === currentPage ? 1 : 0.6,
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Audio player */}
              <div style={{ height: 150, flexShrink: 0, borderTop: '1px solid #16151E' }}>
                <AudioPlayer audioStoragePath={audioFile.storage_path} />
              </div>
            </div>
          )}

          {/* ── No-audio empty state ─────────────────────────────────────── */}
          {!hasAudioFile && !isRecording && (
            <div style={{ flexShrink: 0, borderTop: '1px solid #16151E', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '14px 26px' }}>
              <Mic size={14} strokeWidth={1.5} style={{ color: '#3F485C', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: '#5B6478' }}>No audio recorded for this session</span>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                {hasAccess(userTier, 'midnight') && (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid #23222F', background: '#0D0D14', color: '#5B6478', fontSize: 11.5, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <Mic size={10} strokeWidth={1.5} />
                    Record live
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => useSessionStore.getState().openUploadPanel()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid #23222F', background: '#0D0D14', color: '#5B6478', fontSize: 11.5, cursor: 'pointer', flexShrink: 0 }}
                >
                  Upload audio
                </button>
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

      {/* ── Study guide modal ────────────────────────────────────────────── */}
      {guideModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}>
          <div style={{ background: '#0D0D14', border: '1px solid #23222F', borderRadius: 14, width: 360, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid #16151E' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#E2E8F0' }}>Update study guide</span>
              <button
                type="button"
                onClick={() => setGuideModalOpen(false)}
                style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #1E1E2E', background: 'transparent', color: '#5B6478', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4 L14 14 M14 4 L4 14" /></svg>
              </button>
            </div>
            {/* Upload form */}
            <GuideUpload
              onGuide={(payload) => { setGuideModalOpen(false); handleScore(payload) }}
              isScoring={isScoring}
            />
          </div>
        </div>
      )}

      {/* ── Rescore confirmation dialog ──────────────────────────────────── */}
      {pendingRescore && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)' }}>
          <div style={{ background: '#0F0F19', border: '1px solid #1E1E2E', borderRadius: 16, padding: 28, maxWidth: 400, width: '90%', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#E2E8F0', margin: '0 0 10px' }}>Remove studied keywords?</p>
              <p style={{ fontSize: 13.5, color: '#94A3B8', lineHeight: 1.65, margin: 0 }}>
                This rescore removes {pendingRescore.payload.removedIds.length} keyword{pendingRescore.payload.removedIds.length !== 1 ? 's' : ''} you&apos;ve been reviewing.{' '}
                <span style={{ color: '#E2E8F0', fontWeight: 500 }}>{pendingRescore.reviewCount} review{pendingRescore.reviewCount !== 1 ? 's' : ''}</span>{' '}
                (streak progress, ease factors, due dates) will be permanently deleted.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPendingRescore(null)}
                style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #1E1E2E', background: 'transparent', color: '#94A3B8', fontSize: 13.5, cursor: 'pointer' }}
              >
                Keep current keywords
              </button>
              <button
                type="button"
                onClick={async () => {
                  const p = pendingRescore.payload
                  setPendingRescore(null)
                  setIsScoring(true)
                  try {
                    await executeRescore(p)
                  } catch (e) {
                    console.error('[SessionClient] confirmed rescore error:', e)
                  } finally {
                    setIsScoring(false)
                  }
                }}
                style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: '#FCA5A5', fontSize: 13.5, cursor: 'pointer', fontWeight: 500 }}
              >
                Remove and rescore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
