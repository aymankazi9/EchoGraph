'use client'

// Center 45% pane. Reads words from session store — covers both live transcription
// (words stream in via addTranscriptWords) and post-load playback (words from DB).
// Keywords are matched via sliding window and forwarded to WordSpan for hot-linking.
// DESIGN_SYSTEM.md §7: fadeUp per paragraph block on initial appearance.

import { useMemo } from 'react'
import { Mic } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { WordSpan } from './word-span'
import { useSessionStore } from '@/store/session-store'
import type { TranscriptWordEntry } from '@/store/session-store'
import type { TranscriptionProgress } from '@/lib/transcription'

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] },
  },
}

// ─── Paragraph grouping ───────────────────────────────────────────────────────

function groupIntoParagraphs(words: TranscriptWordEntry[]): TranscriptWordEntry[][] {
  if (words.length === 0) return []
  const paras: TranscriptWordEntry[][] = [[words[0]]]
  for (let i = 1; i < words.length; i++) {
    if (words[i].startMs - words[i - 1].endMs > 1500) paras.push([])
    paras[paras.length - 1].push(words[i])
  }
  return paras
}

// ─── Keyword annotation ───────────────────────────────────────────────────────

interface KeywordAnnotation {
  zone: 'red' | 'likely'
  keywordId: string
}

/**
 * Builds a word-index → KeywordAnnotation map via sliding window.
 * Multi-word keywords mark all their tokens.
 */
function buildAnnotationMap(
  words: TranscriptWordEntry[],
  keywords: { id: string; term: string; zone: 'red' | 'likely' }[],
): Map<string, KeywordAnnotation> {
  const map = new Map<string, KeywordAnnotation>()
  if (keywords.length === 0) return map

  const tokens = words.map((w) => w.word.toLowerCase().replace(/[^a-z0-9-]/g, ''))

  for (const kw of keywords) {
    const kwTokens = kw.term.split(/\s+/)
    const n = kwTokens.length

    for (let i = 0; i <= tokens.length - n; i++) {
      let match = true
      for (let j = 0; j < n; j++) {
        if (!tokens[i + j].startsWith(kwTokens[j].toLowerCase())) { match = false; break }
      }
      if (match) {
        for (let j = 0; j < n; j++) {
          const wordId = words[i + j]?.id
          if (wordId && !map.has(wordId)) {
            map.set(wordId, { zone: kw.zone, keywordId: kw.id })
          }
        }
      }
    }
  }

  return map
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  progress: TranscriptionProgress | null
  sessionStatus: string
  hasAudio: boolean
  isLoadingTranscript: boolean
  onTranscribe: () => void
}

export function TranscriptPane({
  progress,
  sessionStatus,
  hasAudio,
  isLoadingTranscript,
  onTranscribe,
}: Props) {
  const words = useSessionStore((s) => s.transcriptWords)
  const keywords = useSessionStore((s) => s.keywords)

  const paragraphs = useMemo(() => groupIntoParagraphs(words), [words])
  const annotationMap = useMemo(
    () =>
      buildAnnotationMap(
        words,
        keywords.map((k) => ({ id: k.id, term: k.term, zone: k.zone })),
      ),
    [words, keywords],
  )

  const phase = progress?.phase ?? 'idle'
  const isActive = phase === 'decrypting' || phase === 'modelLoading' || phase === 'transcribing'
  const hasWords = words.length > 0

  // ── Loading state (fetching transcript from DB) ──────────────────────────
  if (isLoadingTranscript && !hasWords) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-label text-text-tertiary animate-pulse-slow">Loading transcript…</span>
      </div>
    )
  }

  // ── Previously transcribed with no words yet loaded ──────────────────────
  if (sessionStatus === 'transcribed' && !hasWords && !isActive) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
        <Mic size={32} strokeWidth={1.5} className="text-text-tertiary" />
        <p className="text-body-sm text-text-secondary text-center">
          Transcript stored in your vault.
          <br />
          Re-transcribe to view it here.
        </p>
        {hasAudio && (
          <button
            type="button"
            onClick={onTranscribe}
            className="h-9 px-4 rounded-btn text-body font-medium border border-border-default text-text-secondary hover:bg-bg-subtle transition-colors"
          >
            Re-transcribe
          </button>
        )}
      </div>
    )
  }

  // ── Empty state — no transcript yet ─────────────────────────────────────
  if (!hasWords && !isActive) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
        <Mic size={32} strokeWidth={1.5} className="text-text-tertiary" />
        <p className="text-body-sm text-text-secondary">No transcript yet</p>
        {hasAudio && (
          <button
            type="button"
            onClick={onTranscribe}
            className="h-9 px-4 rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
          >
            Transcribe
          </button>
        )}
        {!hasAudio && (
          <p className="text-label text-text-tertiary text-center max-w-[200px]">
            Upload a recording to enable transcription.
          </p>
        )}
      </div>
    )
  }

  // ── Words: streaming (isActive) or loaded (playback) ────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Transcription progress bar — shown during inference */}
      {isActive && progress && progress.totalSegments > 0 && phase === 'transcribing' && (
        <div className="shrink-0 px-4 pt-4 pb-2">
          <div className="flex justify-between mb-1">
            <span className="text-body-sm text-text-secondary">Transcribing…</span>
            <span className="text-label text-text-tertiary">
              {progress.segmentsComplete}/{progress.totalSegments}
            </span>
          </div>
          <div className="h-1 w-full bg-bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-200 transition-all duration-300 ease-out rounded-full"
              style={{
                width: `${progress.totalSegments > 0 ? (progress.segmentsComplete / progress.totalSegments) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Scrollable word stream */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AnimatePresence initial={false}>
          {paragraphs.map((paraWords, i) => (
            <motion.div
              key={paraWords[0]?.id ?? i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="mb-4 leading-relaxed"
            >
              {paraWords.map((w) => {
                const annotation = annotationMap.get(w.id)
                return (
                  <WordSpan
                    key={w.id}
                    id={w.id}
                    word={w.word}
                    startMs={w.startMs}
                    endMs={w.endMs}
                    keywordZone={annotation?.zone ?? null}
                    keywordId={annotation?.keywordId ?? null}
                  />
                )
              })}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Inline pulse indicator while transcribing */}
        {isActive && (
          <span className="inline-block w-2 h-4 bg-text-tertiary opacity-60 animate-pulse-slow rounded-sm" />
        )}
      </div>
    </div>
  )
}
