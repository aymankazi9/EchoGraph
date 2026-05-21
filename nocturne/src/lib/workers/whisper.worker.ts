// @ts-nocheck — @huggingface/transformers types don't resolve cleanly under moduleResolution:bundler
// Runs in a dedicated Web Worker — never on the main thread.
// Transformers.js handles CacheStorage model caching automatically.
// CONTEXT.md §10 rule 2: all ML runs in Web Workers.

import { pipeline, env } from '@huggingface/transformers'

// Browser default: allowLocalModels = false, useBrowserCache = true.
// Explicitly confirming: never fall back to local files.
env.allowLocalModels = false

// ─── Message types ────────────────────────────────────────────────────────────

type InMsg = {
  type: 'TRANSCRIBE'
  audio: Float32Array  // 16kHz mono PCM, transferred from main thread
}

type ProgressMsg =
  | { type: 'MODEL_LOADING'; progress: number; file: string }
  | { type: 'MODEL_READY' }
  | { type: 'SEGMENT'; words: { word: string; startMs: number; endMs: number }[]; segmentIndex: number; totalSegments: number }
  | { type: 'DONE' }
  | { type: 'ERROR'; message: string }

const post = (msg: ProgressMsg) =>
  (self as unknown as { postMessage(d: ProgressMsg): void }).postMessage(msg)

// ─── Pipeline singleton ───────────────────────────────────────────────────────

// Cached after first load — subsequent calls return immediately from CacheStorage.
let transcriber: Awaited<ReturnType<typeof pipeline>> | null = null

async function getTranscriber() {
  if (transcriber) return transcriber

  transcriber = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-base',
    {
      progress_callback: (p: { status: string; progress?: number; file?: string }) => {
        // Only forward actual download progress to avoid UI noise on cached loads.
        if (p.status === 'progress') {
          post({ type: 'MODEL_LOADING', progress: p.progress ?? 0, file: p.file ?? '' })
        }
      },
    },
  )

  return transcriber
}

// ─── Inference ────────────────────────────────────────────────────────────────

// 30 seconds × 16 000 Hz = 480 000 samples per chunk.
const CHUNK_SAMPLES = 30 * 16_000

self.addEventListener('message', async (event: MessageEvent<InMsg>) => {
  if (event.data.type !== 'TRANSCRIBE') return

  try {
    const t = await getTranscriber()
    post({ type: 'MODEL_READY' })

    const { audio } = event.data
    const totalSegments = Math.max(1, Math.ceil(audio.length / CHUNK_SAMPLES))

    // Process each 30-second slice sequentially — yields a stream of SEGMENT
    // messages so the UI can render words progressively as inference runs.
    // CONTEXT.md §10 rule 10: Whisper and BERT must never run simultaneously.
    for (let i = 0; i < totalSegments; i++) {
      const start = i * CHUNK_SAMPLES
      const chunk = audio.slice(start, start + CHUNK_SAMPLES)

      // Whisper expects Float32Array at 16kHz. Default sampling_rate is 16000.
      const result = await (t as (input: Float32Array, options: Record<string, unknown>) => Promise<{
        text: string
        chunks?: { text: string; timestamp: [number | null, number | null] }[]
      }>)(chunk, { return_timestamps: 'word' })

      // Offset timestamps by the chunk's start position in the full audio.
      const chunkOffsetMs = i * 30 * 1000

      const words = (result.chunks ?? [])
        .map((c) => ({
          word: c.text.trim(),
          startMs: Math.round((c.timestamp[0] ?? 0) * 1000) + chunkOffsetMs,
          endMs: Math.round((c.timestamp[1] ?? c.timestamp[0] ?? 0) * 1000) + chunkOffsetMs,
        }))
        .filter((w) => w.word.length > 0)

      post({ type: 'SEGMENT', words, segmentIndex: i, totalSegments })
    }

    post({ type: 'DONE' })
  } catch (e) {
    post({ type: 'ERROR', message: String(e) })
  }
})
