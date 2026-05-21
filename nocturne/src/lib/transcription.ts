// Browser-only — import only from 'use client' components.
// Orchestrates: decrypt audio → decode PCM → Whisper worker → stream to DB.
// CONTEXT.md §10 rules: all ML in Worker, never simultaneous with BERT.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getMasterKey } from '@/lib/crypto/vault'
import { fetchAndDecryptFile } from '@/lib/crypto/decrypt'
import { encryptText } from '@/lib/crypto/encrypt'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranscriptWord {
  /** Stable UUID — assigned in transcription.ts, persisted to DB, used for store active-word tracking. */
  id: string
  word: string
  startMs: number
  endMs: number
}

export interface TranscriptionProgress {
  phase: 'decrypting' | 'modelLoading' | 'transcribing' | 'done' | 'error'
  /** 0-100 during model download, 100 once ready */
  modelPct: number
  segmentsComplete: number
  totalSegments: number
  error: string | null
}

export type OnTranscriptionProgress = (p: TranscriptionProgress) => void
/** Called with each 30-second segment's words as they arrive. */
export type OnSegment = (words: TranscriptWord[]) => void

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Decode any browser-supported audio format to a 16kHz mono Float32Array.
// AudioContext is main-thread only — this must NOT be called inside a Worker.
async function decodeToFloat32(audioBuffer: ArrayBuffer): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16_000 })
  try {
    const decoded = await ctx.decodeAudioData(audioBuffer.slice(0))
    // Copy channel 0 into a fresh standalone buffer (safe to transfer).
    const pcm = new Float32Array(decoded.length)
    pcm.set(decoded.getChannelData(0))
    return pcm
  } finally {
    ctx.close()
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Starts a full transcription run for the given audio file.
 * Returns a cancel function — call it to abort in-flight work.
 */
export function startTranscription(
  supabase: SupabaseClient,
  sessionId: string,
  audioStoragePath: string,
  onProgress: OnTranscriptionProgress,
  onSegment: OnSegment,
): () => void {
  let cancelled = false
  let worker: Worker | null = null

  const state: TranscriptionProgress = {
    phase: 'decrypting',
    modelPct: 0,
    segmentsComplete: 0,
    totalSegments: 0,
    error: null,
  }

  const emit = () => onProgress({ ...state })

  async function run() {
    const mk = getMasterKey()
    if (!mk) throw new Error('Vault is locked — please unlock before transcribing.')

    // Mark session as transcribing to guard against concurrent runs.
    await supabase.from('sessions').update({ status: 'transcribing' }).eq('id', sessionId)

    // ── Phase 1: Decrypt audio .bin ─────────────────────────────────────────
    emit()
    const opusBuffer = await fetchAndDecryptFile(
      supabase,
      audioStoragePath,
      mk,
      (_phase, pct) => {
        if (cancelled) return
        state.modelPct = Math.round(pct * 0.3) // 0-30% of the model bar during fetch
        emit()
      },
    )
    if (cancelled) return

    // ── Phase 2: Decode Opus → PCM ──────────────────────────────────────────
    state.phase = 'modelLoading'
    state.modelPct = 30
    emit()

    const pcm = await decodeToFloat32(opusBuffer)
    if (cancelled) return

    state.modelPct = 40
    emit()

    // ── Phase 3: Whisper worker ─────────────────────────────────────────────
    await new Promise<void>((resolve, reject) => {
      worker = new Worker(new URL('./workers/whisper.worker.ts', import.meta.url))

      worker.onmessage = async (e: MessageEvent) => {
        if (cancelled) return

        const msg = e.data as {
          type: string
          progress?: number
          file?: string
          words?: TranscriptWord[]
          segmentIndex?: number
          totalSegments?: number
          message?: string
        }

        if (msg.type === 'MODEL_LOADING') {
          // Map worker's 0-100 download progress into 40-100 of our model bar.
          state.phase = 'modelLoading'
          state.modelPct = 40 + Math.round((msg.progress ?? 0) * 0.6)
          emit()

        } else if (msg.type === 'MODEL_READY') {
          state.phase = 'transcribing'
          state.modelPct = 100
          emit()

        } else if (msg.type === 'SEGMENT') {
          const rawWords = msg.words ?? []
          state.segmentsComplete = (msg.segmentIndex ?? 0) + 1
          state.totalSegments = msg.totalSegments ?? 1
          emit()

          // Assign stable IDs before notifying UI so the store can track active word by ID.
          const words: TranscriptWord[] = rawWords.map((w) => ({
            ...w,
            id: crypto.randomUUID(),
          }))

          // Notify UI immediately so words render before DB write completes.
          onSegment(words)

          // Write words to DB — reuse the same IDs so store IDs match DB IDs.
          if (words.length > 0) {
            const rows = await Promise.all(
              words.map(async (w) => ({
                id: w.id,
                session_id: sessionId,
                word_encrypted: await encryptText(mk, w.word),
                start_time_ms: w.startMs,
                end_time_ms: w.endMs,
                slide_index: null,
              })),
            )
            const { error } = await supabase.from('transcript_words').insert(rows)
            if (error) console.error('[transcription] DB write error:', error.message)
          }

        } else if (msg.type === 'DONE') {
          state.phase = 'done'
          emit()
          await supabase.from('sessions').update({ status: 'transcribed' }).eq('id', sessionId)
          resolve()

        } else if (msg.type === 'ERROR') {
          reject(new Error(msg.message ?? 'Whisper worker error'))
        }
      }

      worker.onerror = (e) => reject(new Error(e.message ?? 'Whisper worker crashed'))

      // Transfer Float32Array to worker — zero-copy.
      worker.postMessage({ type: 'TRANSCRIBE', audio: pcm }, [pcm.buffer])
    })
  }

  run().catch(async (e) => {
    if (!cancelled) {
      state.phase = 'error'
      state.error = e instanceof Error ? e.message : 'Transcription failed'
      emit()
      // Roll back session status so the user can retry.
      try { await supabase.from('sessions').update({ status: 'ready' }).eq('id', sessionId) } catch { /* ignore */ }
    }
  })

  return () => {
    cancelled = true
    worker?.terminate()
    worker = null
  }
}
