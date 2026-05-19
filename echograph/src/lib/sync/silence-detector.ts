// Browser-only. Spawns silence.worker to detect amplitude gaps in PCM audio.

export interface SilenceGap {
  startMs: number
  endMs: number
}

/**
 * Analyzes PCM for silence gaps exceeding thresholdMs.
 * Transfers audio.buffer to the worker — caller must not use audio after this call.
 */
export function detectSilenceGaps(
  audio: Float32Array,
  thresholdMs: number,
): Promise<SilenceGap[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/silence.worker.ts', import.meta.url),
    )

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type: string; gaps?: SilenceGap[]; message?: string }
      worker.terminate()
      if (msg.type === 'GAPS') resolve(msg.gaps ?? [])
      else reject(new Error(msg.message ?? 'Silence worker error'))
    }

    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message ?? 'Silence worker crashed'))
    }

    worker.postMessage({ type: 'ANALYZE', audio, thresholdMs }, [audio.buffer])
  })
}
