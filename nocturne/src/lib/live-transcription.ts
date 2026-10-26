// Browser-only — import only from 'use client' components.
// Manages: mic capture → 16kHz AudioContext → chunked Whisper inference → word stream.
// On stop: flushes the remaining accumulator, waits for worker drain, returns a Blob.
// The Blob should be passed to addFilesToExistingSession to persist the recording.

import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptText } from '@/lib/crypto/encrypt'
import {
  writeCheckpointMeta,
  writeCheckpointChunk,
} from '@/lib/recording/recording-checkpoint'

// ─── Constants ────────────────────────────────────────────────────────────────

// 12-second Whisper chunks — good accuracy, ~1-3s transcription lag on base model.
const CHUNK_SEC     = 12
const CHUNK_SAMPLES = CHUNK_SEC * 16_000

// MediaRecorder timeslice — fires ondataavailable every 5s for crash recovery.
const TIMESLICE_MS = 5_000

// Flag the take as interrupted if PCM clock drifts this far from wall-clock time.
const DRIFT_THRESHOLD_SEC = 5

// Level meter — AnalyserNode sampled 4/s.
const LEVEL_INTERVAL_MS  = 250
// RMS-to-display scale factor. Speech peaks at ~0.04 raw RMS; multiply × 20 → ~0.8 display.
const LEVEL_SCALE        = 20
// Silence detection: fire onSilenceDetected after this many consecutive low-level frames.
// 10 s / 0.25 s per frame = 40 frames.
const SILENCE_THRESHOLD  = 0.003  // raw RMS below this = no audio signal
const SILENCE_FRAMES     = 40

// ─── Types ────────────────────────────────────────────────────────────────────

export type LiveStatus =
  | { phase: 'idle' }
  | { phase: 'requesting_mic' }
  | { phase: 'model_loading'; progress: number }
  | { phase: 'recording'; elapsedSec: number; drifted?: true; quotaWarning?: true; dbWriteError?: string }
  | { phase: 'saving' }
  | { phase: 'saved' }
  | { phase: 'error'; message: string }

export interface LiveWord {
  id: string
  word: string
  startMs: number
  endMs: number
}

export interface LiveTranscriptionOptions {
  supabase: SupabaseClient
  sessionId: string
  /** Needed for checkpoint metadata to reconstruct the upload path on recovery. */
  userId: string
  mk: CryptoKey
  /**
   * Pre-assigned file UUID for this take. Must match the `id` passed to
   * addFilesToExistingSession so transcript_words rows link to their audio file.
   */
  fileId: string
  onWords: (words: LiveWord[]) => void
  onStatus: (s: LiveStatus) => void
  /** Called once if PCM clock drifts > DRIFT_THRESHOLD_SEC from wall clock. */
  onDriftDetected?: () => void
  /**
   * 0–1 RMS-derived level, sampled ~4 times/s.
   * Useful for a level meter; 0 = silence, 1 = clipping.
   */
  onLevel?: (level: number) => void
  /**
   * Seconds of audio waiting in the Whisper queue (not yet transcribed).
   * Sampled ~4 times/s. A value >= CHUNK_SEC means the worker is behind.
   */
  onLag?: (lagSec: number) => void
  /** Called each time a Whisper chunk finishes processing (0-indexed). */
  onChunkComplete?: (chunkIndex: number) => void
  /**
   * Running estimate of the recording size in bytes, sampled ~4 times/s.
   * Derived from the raw MediaRecorder blobs before encode.
   */
  onSizeEstimate?: (bytes: number) => void
  /** Called once after ~10 s of continuous silence (rms < threshold). */
  onSilenceDetected?: () => void
}

type WorkerMsg =
  | { type: 'MODEL_LOADING'; progress: number }
  | { type: 'MODEL_READY' }
  | { type: 'SEGMENT'; words: { word: string; startMs: number; endMs: number }[] }
  | { type: 'CHUNK_DONE' }
  | { type: 'ERROR'; message: string }

// ─── Mime picker ──────────────────────────────────────────────────────────────

function pickMime(): string {
  for (const t of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Starts live mic transcription. Returns an async stop function that flushes
 * in-flight audio, drains the Whisper worker queue, and returns the recorded Blob.
 *
 * Words arrive via `onWords` as each 12s chunk completes (~1-3s lag).
 * Status updates arrive via `onStatus` — forward to React state.
 */
export function startLiveTranscription(opts: LiveTranscriptionOptions): () => Promise<Blob | null> {
  const { supabase, sessionId, userId, mk, fileId, onWords, onStatus } = opts

  let isStopping = false
  let drainResolve: (() => void) | null = null

  // ── Resources ───────────────────────────────────────────────────────────────
  let worker:        Worker        | null = null
  let ctx:           AudioContext  | null = null
  let analyser:      AnalyserNode  | null = null
  let stream:        MediaStream   | null = null
  let mediaRecorder: MediaRecorder | null = null
  let elapsedTimer:  ReturnType<typeof setInterval> | null = null
  let levelTimer:    ReturnType<typeof setInterval> | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wakeLock:      any = null  // WakeLockSentinel — typed as any; API not in all tslibs

  // ── Sample accumulator ──────────────────────────────────────────────────────
  let accumulator = new Float32Array(CHUNK_SAMPLES * 2)
  let accOffset = 0
  let chunkCount = 0

  // ── Inference queue ─────────────────────────────────────────────────────────
  const chunkQueue: { audio: Float32Array; chunkStartMs: number }[] = []
  let workerBusy = false
  let completedChunks = 0

  // ── MediaRecorder output ────────────────────────────────────────────────────
  const recordedChunks: Blob[] = []
  const selectedMime = pickMime()

  // ── Checkpoint state ────────────────────────────────────────────────────────
  let checkpointEnabled  = false
  let checkpointChunkIdx = 0

  // ── Status flags (sticky: included in all subsequent recording updates) ─────
  let drifted      = false
  let quotaWarning = false
  let lastDbError: string | null = null

  // ── Drift detection ─────────────────────────────────────────────────────────
  let recordingStartedMs:     number | null = null
  let totalSamplesReceived    = 0
  let lastDriftCheckSamples   = 0

  // ── Silence detection ───────────────────────────────────────────────────────
  let lowLevelFrames = 0
  let silenceFired   = false

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function emitRecordingStatus(elapsedSec: number) {
    onStatus({
      phase: 'recording',
      elapsedSec,
      ...(drifted       && { drifted: true as const }),
      ...(quotaWarning  && { quotaWarning: true as const }),
      ...(lastDbError   && { dbWriteError: lastDbError }),
    })
  }

  async function acquireWakeLock() {
    if (!('wakeLock' in navigator)) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wakeLock = await (navigator as any).wakeLock.request('screen')
      wakeLock.addEventListener('release', () => { wakeLock = null })
    } catch {
      // Non-fatal — OS or browser may restrict wake lock in some contexts
    }
  }

  function releaseWakeLock() {
    if (!wakeLock) return
    wakeLock.release().catch(() => {})
    wakeLock = null
  }

  // visibilitychange: re-acquire wake lock and resume AudioContext when tab regains focus.
  // Defined here so both doStop and teardownOnError can removeEventListener with the same ref.
  const handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible' || isStopping) return
    if (!wakeLock) void acquireWakeLock()
    // Chrome throttles AudioContext in hidden tabs; resume it on regain
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
  }

  /** Synchronous cleanup for error paths — no waiting, just kill everything. */
  function teardownOnError() {
    clearInterval(elapsedTimer!)
    clearInterval(levelTimer!)
    elapsedTimer = null
    levelTimer   = null
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    releaseWakeLock()
    worker?.terminate()
    worker = null
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    ctx?.close().catch(() => {})
    ctx      = null
    analyser = null
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop() } catch { /* ignore */ }
    }
    mediaRecorder = null
  }

  function drainQueue() {
    if (workerBusy || chunkQueue.length === 0 || !worker) return
    const next = chunkQueue.shift()!
    workerBusy = true
    worker.postMessage(
      { type: 'TRANSCRIBE_CHUNK', audio: next.audio, chunkStartMs: next.chunkStartMs },
      [next.audio.buffer],
    )
  }

  function checkDrift() {
    if (!recordingStartedMs || drifted) return
    if (totalSamplesReceived - lastDriftCheckSamples < 16_000) return  // throttle to ~1/s
    lastDriftCheckSamples = totalSamplesReceived

    const audioSec = totalSamplesReceived / 16_000
    const wallSec  = (Date.now() - recordingStartedMs) / 1000
    if (Math.abs(wallSec - audioSec) > DRIFT_THRESHOLD_SEC) {
      drifted = true
      opts.onDriftDetected?.()
      emitRecordingStatus(Math.round(wallSec))
    }
  }

  function pushSamples(samples: Float32Array) {
    totalSamplesReceived += samples.length
    checkDrift()

    if (accOffset + samples.length > accumulator.length) {
      const bigger = new Float32Array(Math.max(accumulator.length * 2, accOffset + samples.length))
      bigger.set(accumulator.subarray(0, accOffset))
      accumulator = bigger
    }
    accumulator.set(samples, accOffset)
    accOffset += samples.length

    while (accOffset >= CHUNK_SAMPLES) {
      const chunk = new Float32Array(CHUNK_SAMPLES)
      chunk.set(accumulator.subarray(0, CHUNK_SAMPLES))
      chunkQueue.push({ audio: chunk, chunkStartMs: chunkCount * CHUNK_SEC * 1000 })
      chunkCount++
      accumulator.copyWithin(0, CHUNK_SAMPLES, accOffset)
      accOffset -= CHUNK_SAMPLES
      drainQueue()
    }
  }

  // ── Graceful stop ─────────────────────────────────────────────────────────────

  async function doStop(): Promise<Blob | null> {
    if (isStopping) return null
    isStopping = true

    clearInterval(elapsedTimer!)
    clearInterval(levelTimer!)
    elapsedTimer = null
    levelTimer   = null
    try { ctx?.suspend() } catch { /* ignore */ }

    // Flush remaining samples as a final Whisper chunk
    if (accOffset > 0) {
      const finalChunk = new Float32Array(accOffset)
      finalChunk.set(accumulator.subarray(0, accOffset))
      accOffset = 0
      chunkQueue.push({ audio: finalChunk, chunkStartMs: chunkCount * CHUNK_SEC * 1000 })
      drainQueue()
    }

    // Wait for all queued chunks to finish transcription
    if (chunkQueue.length > 0 || workerBusy) {
      await new Promise<void>((resolve) => { drainResolve = resolve })
    }

    worker?.terminate()
    worker = null

    stream?.getTracks().forEach((t) => t.stop())
    stream = null

    try { await ctx?.close() } catch { /* ignore */ }
    ctx      = null
    analyser = null

    document.removeEventListener('visibilitychange', handleVisibilityChange)
    releaseWakeLock()

    // Collect MediaRecorder output
    onStatus({ phase: 'saving' })
    return new Promise<Blob | null>((resolve) => {
      if (!mediaRecorder) { resolve(null); return }

      mediaRecorder.addEventListener('stop', () => {
        const blob = new Blob(recordedChunks, { type: selectedMime || 'audio/webm' })
        resolve(blob)
      }, { once: true })

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      } else {
        resolve(new Blob(recordedChunks, { type: selectedMime || 'audio/webm' }))
      }
    })
  }

  // ── Async setup ───────────────────────────────────────────────────────────────

  ;(async () => {
    try {
      onStatus({ phase: 'requesting_mic' })

      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      if (isStopping) { stream.getTracks().forEach((t) => t.stop()); return }

      // MediaRecorder captures the raw stream for post-session storage.
      // Started immediately so no audio is missed during model load.
      // TIMESLICE_MS causes ondataavailable to fire at regular intervals,
      // enabling crash-recovery checkpoint writes.
      const recordingStartedAt = Date.now()
      mediaRecorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined)

      // Write checkpoint meta before starting.  Fire-and-forget — the first chunk
      // fires after TIMESLICE_MS (5s), giving IDB plenty of time to settle.
      writeCheckpointMeta(fileId, sessionId, userId, recordingStartedAt, selectedMime || 'audio/webm')
        .then(() => { checkpointEnabled = true })
        .catch((err) => {
          console.warn('[live-transcription] checkpoint meta write failed, crash recovery unavailable:', err)
        })

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size === 0) return
        recordedChunks.push(e.data)

        if (!checkpointEnabled) return
        const idx = checkpointChunkIdx++
        try {
          const buf = await e.data.arrayBuffer()
          await writeCheckpointChunk(fileId, idx, buf, mk)
        } catch (err) {
          if (err instanceof DOMException && err.name === 'QuotaExceededError') {
            checkpointEnabled = false
            quotaWarning = true
            const elapsed = recordingStartedMs
              ? Math.round((Date.now() - recordingStartedMs) / 1000)
              : 0
            emitRecordingStatus(elapsed)
          }
          console.warn('[live-transcription] checkpoint chunk write failed:', err)
        }
      }

      mediaRecorder.start(TIMESLICE_MS)

      // Acquire wake lock and watch for visibility changes from this point on
      document.addEventListener('visibilitychange', handleVisibilityChange)
      void acquireWakeLock()

      // AudioContext at 16kHz — browser downsamples mic input automatically
      ctx = new AudioContext({ sampleRate: 16_000 })
      const source = ctx.createMediaStreamSource(stream)

      // AnalyserNode — parallel branch for level meter and silence detection.
      // Not in the audio chain (source → processor path is unchanged).
      analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.4
      source.connect(analyser)

      // ScriptProcessorNode accumulates 16kHz samples.
      // Deprecated in favor of AudioWorklet but remains the lowest-complexity option
      // for real-time PCM accumulation without a separate worklet module file.
      // bufferSize 4096 @ 16kHz → fires every ~256ms
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (isStopping) return
        pushSamples(new Float32Array(e.inputBuffer.getChannelData(0)))
      }

      // Muted gain node — keeps the processor alive in Chrome without routing
      // mic audio to speakers
      const mute = ctx.createGain()
      mute.gain.value = 0
      source.connect(processor)
      processor.connect(mute)
      mute.connect(ctx.destination)

      // Whisper worker — stays alive for the full recording session
      worker = new Worker(new URL('./workers/whisper.worker.ts', import.meta.url))

      worker.onmessage = async (e: MessageEvent<WorkerMsg>) => {
        const msg = e.data

        if (msg.type === 'MODEL_LOADING') {
          onStatus({ phase: 'model_loading', progress: Math.round(msg.progress) })

        } else if (msg.type === 'MODEL_READY') {
          recordingStartedMs = Date.now()
          emitRecordingStatus(0)

          // 1-s elapsed timer
          elapsedTimer = setInterval(() => {
            if (!isStopping && recordingStartedMs) {
              emitRecordingStatus(Math.round((Date.now() - recordingStartedMs) / 1000))
            }
          }, 1000)

          // Level / lag / size / silence sampler at 4/s
          const timeDomainBuf = new Float32Array(analyser!.fftSize)
          levelTimer = setInterval(() => {
            if (isStopping || !analyser) return

            // ── Level ─────────────────────────────────────────────────────────
            analyser.getFloatTimeDomainData(timeDomainBuf)
            let sumSq = 0
            for (let i = 0; i < timeDomainBuf.length; i++) sumSq += timeDomainBuf[i] ** 2
            const rms = Math.sqrt(sumSq / timeDomainBuf.length)
            opts.onLevel?.(Math.min(1, rms * LEVEL_SCALE))

            // ── Silence detection (fires once after ~10 s below threshold) ──
            if (rms < SILENCE_THRESHOLD) {
              if (!silenceFired && ++lowLevelFrames >= SILENCE_FRAMES) {
                silenceFired = true
                opts.onSilenceDetected?.()
              }
            } else {
              lowLevelFrames = 0
            }

            // ── Lag — unprocessed chunks × chunk duration ───────────────────
            opts.onLag?.(chunkQueue.length * CHUNK_SEC)

            // ── Estimated size ─────────────────────────────────────────────
            let total = 0
            for (const c of recordedChunks) total += c.size
            opts.onSizeEstimate?.(total)

          }, LEVEL_INTERVAL_MS)

        } else if (msg.type === 'SEGMENT') {
          const words: LiveWord[] = msg.words.map((w) => ({ ...w, id: crypto.randomUUID() }))
          onWords(words)

          // Persist to DB — same path as batch transcription.
          // file_id links each word to its source audio take so sync and
          // transcript queries can scope to a single recording.
          if (words.length > 0) {
            const rows = await Promise.all(
              words.map(async (w) => ({
                id: w.id,
                session_id: sessionId,
                file_id: fileId,
                word_encrypted: await encryptText(mk, w.word),
                start_time_ms: w.startMs,
                end_time_ms: w.endMs,
                slide_index: null,
              })),
            )
            const { error } = await supabase.from('transcript_words').insert(rows)
            if (error) {
              console.error('[live-transcription] DB write error:', error.message)
              // Forward to status so the UI can warn the user (non-fatal; recording continues)
              lastDbError = error.message
              if (!isStopping && recordingStartedMs) {
                emitRecordingStatus(Math.round((Date.now() - recordingStartedMs) / 1000))
              }
            }
          }

        } else if (msg.type === 'CHUNK_DONE') {
          workerBusy = false
          completedChunks++
          opts.onChunkComplete?.(completedChunks - 1)
          drainQueue()
          if (isStopping && chunkQueue.length === 0 && !workerBusy) {
            drainResolve?.()
          }

        } else if (msg.type === 'ERROR') {
          console.error('[live-transcription] worker error:', msg.message)
          if (!isStopping) {
            onStatus({ phase: 'error', message: msg.message })
          }
        }
      }

      worker.onerror = (e) => {
        if (!isStopping) {
          teardownOnError()
          onStatus({ phase: 'error', message: e.message ?? 'Whisper worker crashed' })
        }
      }

      // Trigger model load immediately by sending an empty chunk.
      // This fires MODEL_LOADING/MODEL_READY before real audio arrives so the
      // first real chunk doesn't stall waiting for model initialization.
      const warmup = new Float32Array(16_000) // 1s of silence
      worker.postMessage({ type: 'TRANSCRIBE_CHUNK', audio: warmup, chunkStartMs: -99999 }, [warmup.buffer])
      // warmup chunk is discarded: its SEGMENT will have startMs < 0, filtered by onWords callers

    } catch (e) {
      teardownOnError()
      if (!isStopping) {
        onStatus({ phase: 'error', message: e instanceof Error ? e.message : 'Failed to start recording' })
      }
    }
  })()

  return doStop
}
