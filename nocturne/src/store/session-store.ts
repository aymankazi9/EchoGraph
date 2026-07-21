// Single source of truth for session playback state.
// All three panes subscribe to this store — no prop drilling for playback state.
// CONTEXT.md §10 rule 10: seekTo must only be called after Whisper is terminated.

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { getActiveSlideIndex, getActiveWordId } from '@/lib/sync/playhead-tracker'
import type { SyncSegment } from '@/lib/sync/playhead-tracker'
import type { Flashcard } from '@/lib/scoring/flashcard-generator'
import type { VideoResult } from '@/lib/youtube/search'

// ─── Types ────────────────────────────────────────────────────────────────────

export type { SyncSegment }
export type { Flashcard }
export type { VideoResult }

export type GuidanceState = 'empty' | 'has_slides' | 'has_audio' | 'has_slides_and_audio' | 'complete'

export function deriveGuidance(hasSlides: boolean, hasAudio: boolean, sessionStatus: string): GuidanceState {
  if (['transcribed', 'syncing', 'synced'].includes(sessionStatus)) return 'complete'
  if (hasSlides && hasAudio) return 'has_slides_and_audio'
  if (hasSlides) return 'has_slides'
  if (hasAudio) return 'has_audio'
  return 'empty'
}

export interface TranscriptWordEntry {
  id: string
  word: string
  startMs: number
  endMs: number
  slideIndex: number | null
}

export interface StoredKeyword {
  id: string
  term: string
  source: 'real_guide' | 'synthetic' | 'anki' | 'both'
  zone: 'red' | 'likely'
  confidenceScore: number
  mentionCount: number
  dwellTimeMs: number
  emphasisScore: number
  lectureConfidence: number
  slideIndices: number[]
}

interface State {
  transcriptWords: TranscriptWordEntry[]
  syncMap: SyncSegment[]
  currentTimeMs: number
  durationMs: number
  isPlaying: boolean
  playbackSpeed: number
  /** page_number of the currently active slide (1-based). 0 = not yet determined. */
  activeSlideIndex: number
  /** id of the word whose [startMs, endMs] window contains currentTimeMs. */
  activeWordId: string | null
  /** Scored and zoned keywords for this session. */
  keywords: StoredKeyword[]
  /** Currently focused keyword id (side panel open). */
  activeKeywordId: string | null
  /** Generated flashcards for this session. */
  flashcards: Flashcard[]
  /** Slide density scores: pageNumber → 0-100. */
  slideDensityMap: Record<number, number>
  /** Zone classification per slide: 'likely' (synthetic), 'red' (real guide), or null. */
  slideZoneMap: Record<number, 'likely' | 'red' | null>
  /** Consent granted for this session only (never persisted). */
  youtubeConsentGranted: boolean
  /** Ask tab: user has opted-in to sending lecture content to the RAG endpoint this session. */
  askConsentGranted: boolean
  /** YouTube search results for the active keyword query. */
  youtubeResults: VideoResult[]
  /** Whether the YouTube panel is open. */
  youtubePanelOpen: boolean
  /** True while file blobs are being fetched and decrypted on session mount. */
  isDecrypting: boolean
  /** Decrypted session title for display and editing. */
  sessionTitle: string
  /** Set by E shortcut — SessionTitle reads this to auto-enter edit mode. */
  isTitleEditing: boolean
  /** Whether the keyboard shortcut overlay is open. */
  isShortcutOverlayOpen: boolean
  /** Whether the flashcard panel is open. */
  flashcardPanelOpen: boolean
  /** Session metadata — mirrors session row flags, used for guided empty state. */
  hasSlides: boolean
  hasAudio: boolean
  hasStudyGuide: boolean
  sessionStatus: string
  /** Whether the add-files upload panel is open. */
  isUploadPanelOpen: boolean
}

interface Actions {
  /** Called by AudioPlayer after the <audio> element mounts. */
  registerAudio(el: HTMLAudioElement): void
  unregisterAudio(): void
  /** Called from timeupdate (already rate-limited to 250ms in AudioPlayer). */
  onTimeUpdate(ms: number): void
  onDurationChange(ms: number): void
  onPlayStateChange(playing: boolean): void
  /** Seeks audio + immediately updates store derived state. */
  seekTo(ms: number): void
  setSpeed(speed: number): void
  /** Finds first syncMap entry for slideIndex, seeks there. */
  jumpToSlide(slideIndex: number): void
  /** Finds word by id, seeks to its startMs. */
  jumpToWord(wordId: string): void
  loadSyncMap(segments: SyncSegment[]): void
  /** Replaces all transcript words (DB load). */
  loadTranscriptWords(words: TranscriptWordEntry[]): void
  /** Merges new words in (live transcription streaming). */
  addTranscriptWords(words: TranscriptWordEntry[]): void
  /** Replaces keyword list (after scoring run). */
  loadKeywords(keywords: StoredKeyword[]): void
  setActiveKeyword(id: string | null): void
  loadFlashcards(cards: Flashcard[]): void
  loadSlideDensity(map: Record<number, number>): void
  loadSlideZones(map: Record<number, 'likely' | 'red' | null>): void
  /** Sets YouTube per-session consent (never persisted — clears on refresh). */
  grantYoutubeConsent(): void
  /** Sets Ask per-session consent (never persisted — clears on refresh). */
  grantAskConsent(): void
  setYoutubeResults(results: VideoResult[]): void
  setYoutubePanelOpen(open: boolean): void
  setIsDecrypting(v: boolean): void
  setSessionTitle(title: string): void
  /** Called by E shortcut — SessionTitle reacts and clears flag after entering edit mode. */
  triggerTitleEdit(): void
  clearTitleEdit(): void
  toggleShortcutOverlay(): void
  /** Seeks ±seconds relative to currentTimeMs. */
  seekRelative(seconds: number): void
  focusTranscript(): void
  focusPDF(): void
  toggleFlashcardPanel(): void
  toggleYouTubePanel(): void
  /** Seeds session metadata from server props — used for guided empty state. */
  initSessionMeta(meta: { hasSlides: boolean; hasAudio: boolean; hasStudyGuide: boolean; status: string }): void
  setHasSlides(v: boolean): void
  setHasAudio(v: boolean): void
  setHasStudyGuide(v: boolean): void
  openUploadPanel(): void
  closeUploadPanel(): void
  /** Call on session unmount to prevent stale state leaking across sessions. */
  reset(): void
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: State = {
  transcriptWords: [],
  syncMap: [],
  currentTimeMs: 0,
  durationMs: 0,
  isPlaying: false,
  playbackSpeed: 1,
  activeSlideIndex: 0,
  activeWordId: null,
  keywords: [],
  activeKeywordId: null,
  flashcards: [],
  slideDensityMap: {},
  slideZoneMap: {},
  youtubeConsentGranted: false,
  askConsentGranted: false,
  youtubeResults: [],
  youtubePanelOpen: false,
  isDecrypting: false,
  sessionTitle: '',
  isTitleEditing: false,
  isShortcutOverlayOpen: false,
  flashcardPanelOpen: false,
  hasSlides: false,
  hasAudio: false,
  hasStudyGuide: false,
  sessionStatus: 'ingesting',
  isUploadPanelOpen: false,
}

// ─── Audio element (module-level — Immer cannot proxy DOM objects) ────────────

let _audioEl: HTMLAudioElement | null = null

export function getAudioEl(): HTMLAudioElement | null {
  return _audioEl
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSessionStore = create<State & Actions>()(
  immer((set, get) => ({
    ...initialState,

    registerAudio: (el) => { _audioEl = el },

    unregisterAudio: () => { _audioEl = null },

    onTimeUpdate: (ms) => set((s) => {
      s.currentTimeMs = ms
      s.activeSlideIndex = getActiveSlideIndex(ms, s.syncMap)
      s.activeWordId = getActiveWordId(ms, s.transcriptWords)
    }),

    onDurationChange: (ms) => set((s) => { s.durationMs = ms }),

    onPlayStateChange: (playing) => set((s) => { s.isPlaying = playing }),

    seekTo: (ms) => {
      if (_audioEl) _audioEl.currentTime = ms / 1000
      const { syncMap, transcriptWords } = get()
      set((s) => {
        s.currentTimeMs = ms
        s.activeSlideIndex = getActiveSlideIndex(ms, syncMap)
        s.activeWordId = getActiveWordId(ms, transcriptWords)
      })
    },

    setSpeed: (speed) => {
      if (_audioEl) _audioEl.playbackRate = speed
      set((s) => { s.playbackSpeed = speed })
    },

    jumpToSlide: (slideIndex) => {
      const { syncMap } = get()
      const seg = syncMap.find((s) => s.slideIndex === slideIndex)
      if (seg) get().seekTo(seg.startMs)
    },

    jumpToWord: (wordId) => {
      const { transcriptWords } = get()
      const word = transcriptWords.find((w) => w.id === wordId)
      if (word) get().seekTo(word.startMs)
    },

    loadSyncMap: (segments) => {
      const { currentTimeMs, transcriptWords } = get()
      set((s) => {
        s.syncMap = segments
        s.activeSlideIndex = getActiveSlideIndex(currentTimeMs, segments)
        s.activeWordId = getActiveWordId(currentTimeMs, transcriptWords)
      })
    },

    loadTranscriptWords: (words) => {
      const { currentTimeMs, syncMap } = get()
      set((s) => {
        s.transcriptWords = words
        s.activeWordId = getActiveWordId(currentTimeMs, words)
        s.activeSlideIndex = getActiveSlideIndex(currentTimeMs, syncMap)
      })
    },

    addTranscriptWords: (newWords) => {
      const { transcriptWords, currentTimeMs, syncMap } = get()
      const merged = [...transcriptWords, ...newWords].sort((a, b) => a.startMs - b.startMs)
      set((s) => {
        s.transcriptWords = merged
        s.activeWordId = getActiveWordId(currentTimeMs, merged)
        s.activeSlideIndex = getActiveSlideIndex(currentTimeMs, syncMap)
      })
    },

    loadKeywords: (keywords) => set((s) => { s.keywords = keywords }),

    setActiveKeyword: (id) => set((s) => { s.activeKeywordId = id }),

    loadFlashcards: (cards) => set((s) => { s.flashcards = cards }),

    loadSlideDensity: (map) => set((s) => { s.slideDensityMap = map }),

    loadSlideZones: (map) => set((s) => { s.slideZoneMap = map }),

    grantYoutubeConsent: () => set((s) => { s.youtubeConsentGranted = true }),

    grantAskConsent: () => set((s) => { s.askConsentGranted = true }),

    setYoutubeResults: (results) => set((s) => { s.youtubeResults = results }),

    setYoutubePanelOpen: (open) => set((s) => { s.youtubePanelOpen = open }),

    setIsDecrypting: (v) => set((s) => { s.isDecrypting = v }),

    setSessionTitle: (title) => set((s) => { s.sessionTitle = title }),

    triggerTitleEdit: () => set((s) => { s.isTitleEditing = true }),

    clearTitleEdit: () => set((s) => { s.isTitleEditing = false }),

    toggleShortcutOverlay: () => set((s) => { s.isShortcutOverlayOpen = !s.isShortcutOverlayOpen }),

    seekRelative: (seconds) => {
      const { currentTimeMs, durationMs } = get()
      get().seekTo(Math.max(0, Math.min(durationMs, currentTimeMs + seconds * 1000)))
    },

    focusTranscript: () => {
      const el = document.getElementById('transcript-pane') as HTMLElement | null
      if (el) { el.tabIndex = -1; el.focus() }
    },

    focusPDF: () => {
      const el = document.getElementById('pdf-pane') as HTMLElement | null
      if (el) { el.tabIndex = -1; el.focus() }
    },

    toggleFlashcardPanel: () => set((s) => { s.flashcardPanelOpen = !s.flashcardPanelOpen }),

    toggleYouTubePanel: () => set((s) => { s.youtubePanelOpen = !s.youtubePanelOpen }),

    initSessionMeta: ({ hasSlides, hasAudio, hasStudyGuide, status }) =>
      set((s) => {
        s.hasSlides = hasSlides
        s.hasAudio = hasAudio
        s.hasStudyGuide = hasStudyGuide
        s.sessionStatus = status
      }),

    setHasSlides: (v) => set((s) => { s.hasSlides = v }),
    setHasAudio: (v) => set((s) => { s.hasAudio = v }),
    setHasStudyGuide: (v) => set((s) => { s.hasStudyGuide = v }),

    openUploadPanel: () =>
      set((s) => { s.isUploadPanelOpen = true; s.youtubePanelOpen = false; s.activeKeywordId = null }),

    closeUploadPanel: () => set((s) => { s.isUploadPanelOpen = false }),

    reset: () => set(initialState),
  })),
)
