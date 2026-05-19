'use client'

// Lives in the audio pane (left 20%). Shows transcribe + analyze buttons and
// progress bars. CONTEXT.md §10 rule 10: no simultaneous ML pipelines.

import { Mic } from 'lucide-react'
import type { TranscriptionProgress } from '@/lib/transcription'
import type { SyncProgress } from '@/lib/sync/sync-engine'

interface Props {
  progress: TranscriptionProgress | null
  syncProgress: SyncProgress | null
  sessionStatus: string
  hasAudio: boolean
  hasSlides: boolean
  onTranscribe: () => void
  onAnalyze: () => void
}

export function TranscriptionControls({
  progress,
  syncProgress,
  sessionStatus,
  hasAudio,
  hasSlides,
  onTranscribe,
  onAnalyze,
}: Props) {
  if (!hasAudio) return null

  const phase = progress?.phase ?? 'idle'
  const isTranscribing = phase === 'decrypting' || phase === 'modelLoading' || phase === 'transcribing'
  const isTranscribeDone = phase === 'done' || sessionStatus === 'transcribed' || sessionStatus === 'synced' || sessionStatus === 'syncing'
  const isBlockedByOtherTab = sessionStatus === 'transcribing' && !progress

  const syncPhase = syncProgress?.phase ?? 'idle'
  const isSyncing = syncPhase === 'fetching' || syncPhase === 'detecting' ||
    syncPhase === 'bert_loading' || syncPhase === 'bert_scoring' || syncPhase === 'writing'
  const isSynced = syncPhase === 'done' || sessionStatus === 'synced'

  return (
    <div className="flex flex-col gap-3 p-4 w-full">
      {/* ── Transcription status ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {isTranscribing && (
          <span className="w-2 h-2 rounded-full bg-amber-200 animate-pulse-slow shrink-0" />
        )}
        {isTranscribeDone && !isSyncing && !isSynced && (
          <span className="w-2 h-2 rounded-full bg-teal-300 shrink-0" />
        )}
        {isSynced && (
          <span className="w-2 h-2 rounded-full bg-purple-300 shrink-0" />
        )}
        <span className="text-body-sm text-text-secondary">
          {isBlockedByOtherTab && 'Transcription in progress…'}
          {!isBlockedByOtherTab && phase === 'idle' && !isTranscribeDone && 'Ready to transcribe'}
          {phase === 'decrypting' && 'Decrypting audio…'}
          {phase === 'modelLoading' && (
            progress?.modelPct != null && progress.modelPct < 50
              ? `Downloading Whisper model (142 MB)… ${Math.round(progress.modelPct / 0.5)}%`
              : 'Loading model…'
          )}
          {phase === 'transcribing' && (
            progress
              ? `Transcribing… ${progress.segmentsComplete} / ${progress.totalSegments} segments`
              : 'Transcribing…'
          )}
          {phase === 'done' && !isSyncing && !isSynced && 'Transcribed'}
          {phase === 'error' && 'Transcription failed'}
          {isTranscribeDone && (syncPhase === 'fetching' || syncPhase === 'detecting') && 'Analyzing audio…'}
          {syncPhase === 'bert_loading' && (
            syncProgress?.modelPct != null && syncProgress.modelPct < 50
              ? `Downloading BERT model… ${syncProgress.modelPct}%`
              : 'Loading BERT model…'
          )}
          {syncPhase === 'bert_scoring' && 'Scoring slides…'}
          {syncPhase === 'writing' && 'Saving sync map…'}
          {isSynced && 'Slides synced'}
          {syncPhase === 'error' && 'Slide sync failed'}
        </span>
      </div>

      {/* ── Whisper model download bar (purple) ─────────────────────────────── */}
      {phase === 'modelLoading' && progress && progress.modelPct < 100 && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-caption text-text-tertiary uppercase tracking-wide">Model</span>
            <span className="text-caption text-text-tertiary">
              {Math.round(Math.max(0, ((progress.modelPct - 40) / 60) * 100))}%
            </span>
          </div>
          <div className="h-1 w-full bg-bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-300 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${Math.max(0, ((progress.modelPct - 40) / 60) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Whisper inference progress bar (amber) ──────────────────────────── */}
      {phase === 'transcribing' && progress && progress.totalSegments > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-caption text-text-tertiary uppercase tracking-wide">Transcribing</span>
            <span className="text-caption text-text-tertiary">
              {Math.round((progress.segmentsComplete / progress.totalSegments) * 100)}%
            </span>
          </div>
          <div className="h-1 w-full bg-bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-200 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${(progress.segmentsComplete / progress.totalSegments) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── BERT model download bar (purple) ────────────────────────────────── */}
      {syncPhase === 'bert_loading' && syncProgress && syncProgress.modelPct < 100 && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-caption text-text-tertiary uppercase tracking-wide">BERT</span>
            <span className="text-caption text-text-tertiary">{syncProgress.modelPct}%</span>
          </div>
          <div className="h-1 w-full bg-bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-300 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${syncProgress.modelPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Transcription error ──────────────────────────────────────────────── */}
      {phase === 'error' && progress?.error && (
        <p className="text-label text-red-200">{progress.error}</p>
      )}

      {/* ── Sync error ───────────────────────────────────────────────────────── */}
      {syncPhase === 'error' && syncProgress?.error && (
        <p className="text-label text-red-200">{syncProgress.error}</p>
      )}

      {/* ── Transcribe button — primary placement per CONTEXT.md goal #8 ────── */}
      {!isTranscribing && !isTranscribeDone && !isBlockedByOtherTab && (
        <button
          type="button"
          onClick={onTranscribe}
          className="flex items-center gap-2 h-9 px-4 rounded-btn text-body font-medium bg-teal-300 text-text-inverse hover:bg-teal-400 transition-colors self-start"
        >
          <Mic size={14} strokeWidth={1.5} />
          Transcribe
        </button>
      )}

      {/* ── Retry transcription after error ─────────────────────────────────── */}
      {phase === 'error' && (
        <button
          type="button"
          onClick={onTranscribe}
          className="h-9 px-4 rounded-btn text-body font-medium border border-border-default text-text-secondary hover:bg-bg-subtle transition-colors self-start"
        >
          Retry
        </button>
      )}

      {/* ── Analyze slides button — shown after transcription, before sync ───── */}
      {isTranscribeDone && hasSlides && !isSyncing && !isSynced && (
        <button
          type="button"
          onClick={onAnalyze}
          className="h-9 px-4 rounded-btn text-body font-medium bg-purple-300 text-text-inverse hover:bg-purple-400 transition-colors self-start"
        >
          Analyze slides
        </button>
      )}

      {/* ── Retry sync after error ───────────────────────────────────────────── */}
      {syncPhase === 'error' && (
        <button
          type="button"
          onClick={onAnalyze}
          className="h-9 px-4 rounded-btn text-body font-medium border border-border-default text-text-secondary hover:bg-bg-subtle transition-colors self-start"
        >
          Retry analysis
        </button>
      )}
    </div>
  )
}
