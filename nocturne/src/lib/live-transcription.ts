// Browser-only — import only from 'use client' components.
// Manages: mic capture → 16kHz AudioContext → chunked Whisper inference → word stream.
// On stop: flushes the remaining accumulator and returns a Blob for post-session storage.
// The Blob should be passed to addFilesToExistingSession to persist the recording.

import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptText } from '@/lib/crypto/encrypt'

// 12-second chunks — long enough for good Whisper accuracy, short enough for
// ~1-3s transcription lag (whisper-base processes 12s in ~0.5-1s on modern hardware).
const CHUNK_SEC = 12
const CHUNK_SAMPLES = CHUNK_SEC * 16_000

export type LiveStatus =
  | { phase: 'idle' }
  | { phase: 'requesting_mic' }
  | { phase: 'model_loading'; progress: number }
  | { phase: 'recording'; elapsedSec: number }
  | { phase: 'saving' }
  | { phase: 'error'; message: string }

export interface LiveWord {
  id: string
  word: string
  startMs: number
  endMs: number
}

type WorkerMsg =
  | { type: 'MODEL_LOADING'; progress: number }
  | { type: 'MODEL_READY' }
  | { type: 'SEGMENT'; words: { word: string; startMs: number; endMs: number }[] }
  | { type: 'CHUNK_DONE' }
  | { type: 'ERROR'; message: string }

// Picks the best supported MediaRecorder mime type for the current browser.
function pickMime(): string {
  for (const t of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

/**
 * Starts live mic transcription. Returns an async stop function that flushes
 * in-flight audio, waits for the worker to finish, and returns the recorded Blob.
 *
 * Words arrive via `onWords` as each 12s chunk completes (typically ~1-3s lag).
 * Status updates arrive via `onStatus` — subscribe and forward to React state.
 */
export function startLiveTranscription(
  supabase: SupabaseClient,
  sessionId: string,
  mk: CryptoKey,
  onWords: (words: LiveWord[]) => void,
  onStatus: (s: LiveStatus) => void,
): () => Promise<Blob | null> {
  let isStopping = false
  let drainResolve: (() => void) | null = null

  // Resources to clean up on stop
  let worker: Worker | null = null
  let ctx: AudioContext | null = null
  let stream: MediaStream | null = null
  let elapsedTimer: ReturnType<typeof setInterval> | null = null

  // Sample accumulator
  let accumulator = new Float32Array(CHUNK_SAMPLES * 2)
  let accOffset = 0
  let chunkCount = 0

  // Inference queue — worker processes one chunk at a time
  const chunkQueue: { audio: Float32Array; chunkStartMs: number }[] = []
  let workerBusy = false

  // MediaRecorder chunks for final storage blob
  const recordedChunks: Blob[] = []
  let mediaRecorder: MediaRecorder | null = null
  const selectedMime = pickMime()

  function drainQueue() {
    if (workerBusy || chunkQueue.length === 0 || !worker) return
    const next = chunkQueue.shift()!
    workerBusy = true
    worker.postMessage(
      { type: 'TRANSCRIBE_CHUNK', audio: next.audio, chunkStartMs: next.chunkStartMs },
      [next.audio.buffer],
    )
  }

  function pushSamples(samples: Float32Array) {
    // Grow accumulator if needed
    if (accOffset + samples.length > accumulator.length) {
      const bigger = new Float32Array(Math.max(accumulator.length * 2, accOffset + samples.length))
      bigger.set(accumulator.subarray(0, accOffset))
      accumulator = bigger
    }
    accumulator.set(samples, accOffset)
    accOffset += samples.length

    // Drain complete chunks
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

  // Actual stop — called by the returned function
  async function doStop(): Promise<Blob | null> {
    if (isStopping) return null
    isStopping = true

    // Disconnect mic processing
    clearInterval(elapsedTimer!)
    elapsedTimer = null
    try { ctx?.suspend() } catch { /* ignore */ }

    // Flush remaining samples as a final chunk
    if (accOffset > 0) {
      const finalChunk = new Float32Array(accOffset)
      finalChunk.set(accumulator.subarray(0, accOffset))
      accOffset = 0
      chunkQueue.push({ audio: finalChunk, chunkStartMs: chunkCount * CHUNK_SEC * 1000 })
      drainQueue()
    }

    // Wait for all queued chunks to finish
    if (chunkQueue.length > 0 || workerBusy) {
      await new Promise<void>((resolve) => { drainResolve = resolve })
    }

    worker?.terminate()
    worker = null

    stream?.getTracks().forEach((t) => t.stop())
    stream = null

    try { await ctx?.close() } catch { /* ignore */ }
    ctx = null

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
        const blob = new Blob(recordedChunks, { type: selectedMime || 'audio/webm' })
        resolve(blob)
      }
    })
  }

  // Async setup — runs in the background after startLiveTranscription returns
  ;(async () => {
    try {
      onStatus({ phase: 'requesting_mic' })

      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      if (isStopping) { stream.getTracks().forEach((t) => t.stop()); return }

      // MediaRecorder on the original stream — for post-session audio storage
      mediaRecorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined)
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data) }
      mediaRecorder.start()

      // AudioContext at 16kHz — browser downsamples mic input automatically
      ctx = new AudioContext({ sampleRate: 16_000 })
      const source = ctx.createMediaStreamSource(stream)

      // ScriptProcessorNode accumulates 16kHz samples.
      // Deprecated in favor of AudioWorklet but remains the lowest-complexity option
      // for real-time PCM accumulation without a separate worklet module file.
      // bufferSize 4096 @ 16kHz → fires every ~256ms
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (isStopping) return
        pushSamples(new Float32Array(e.inputBuffer.getChannelData(0)))
      }

      // Muted gain node — required to keep the processor alive in Chrome without
      // routing mic audio to the speakers.
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
          const startedAt = Date.now()
          onStatus({ phase: 'recording', elapsedSec: 0 })
          elapsedTimer = setInterval(() => {
            if (!isStopping) {
              onStatus({ phase: 'recording', elapsedSec: Math.round((Date.now() - startedAt) / 1000) })
            }
          }, 1000)

        } else if (msg.type === 'SEGMENT') {
          const words: LiveWord[] = msg.words.map((w) => ({ ...w, id: crypto.randomUUID() }))
          onWords(words)

          // Persist to DB — same as batch transcription flow
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
            if (error) console.error('[live-transcription] DB write error:', error.message)
          }

        } else if (msg.type === 'CHUNK_DONE') {
          workerBusy = false
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
      if (!isStopping) {
        onStatus({ phase: 'error', message: e instanceof Error ? e.message : 'Failed to start recording' })
      }
    }
  })()

  return doStop
}
