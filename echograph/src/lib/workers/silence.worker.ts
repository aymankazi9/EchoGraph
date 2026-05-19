// Runs in a Web Worker. Analyzes PCM Float32Array for silence gaps via RMS.
// CONTEXT.md §10 rule 2: all processing in Web Workers.

export {}  // Make this a module so local types don't pollute the global TS scope.

const SAMPLE_RATE = 16_000
const WINDOW_SAMPLES = 160  // 10 ms at 16 kHz
const SILENCE_RMS = 0.01    // amplitude below this = silent

type InMsg = { type: 'ANALYZE'; audio: Float32Array; thresholdMs: number }
type OutMsg =
  | { type: 'GAPS'; gaps: { startMs: number; endMs: number }[] }
  | { type: 'ERROR'; message: string }

const post = (msg: OutMsg) =>
  (self as unknown as { postMessage(d: OutMsg): void }).postMessage(msg)

self.addEventListener('message', (event: MessageEvent<InMsg>) => {
  if (event.data.type !== 'ANALYZE') return

  try {
    const { audio, thresholdMs } = event.data
    const thresholdSamples = Math.round((SAMPLE_RATE * thresholdMs) / 1000)
    const gaps: { startMs: number; endMs: number }[] = []
    let silenceStart: number | null = null

    for (let i = 0; i < audio.length; i += WINDOW_SAMPLES) {
      const end = Math.min(i + WINDOW_SAMPLES, audio.length)
      let sum = 0
      for (let j = i; j < end; j++) sum += audio[j] * audio[j]
      const rms = Math.sqrt(sum / (end - i))

      if (rms < SILENCE_RMS && silenceStart === null) {
        silenceStart = i
      } else if (rms >= SILENCE_RMS && silenceStart !== null) {
        if (i - silenceStart >= thresholdSamples) {
          gaps.push({
            startMs: Math.round((silenceStart / SAMPLE_RATE) * 1000),
            endMs: Math.round((i / SAMPLE_RATE) * 1000),
          })
        }
        silenceStart = null
      }
    }

    if (silenceStart !== null && audio.length - silenceStart >= thresholdSamples) {
      gaps.push({
        startMs: Math.round((silenceStart / SAMPLE_RATE) * 1000),
        endMs: Math.round((audio.length / SAMPLE_RATE) * 1000),
      })
    }

    post({ type: 'GAPS', gaps })
  } catch (e) {
    post({ type: 'ERROR', message: String(e) })
  }
})
