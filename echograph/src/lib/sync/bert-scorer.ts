// Browser-only. Orchestrates bert.worker for text similarity scoring.
// CONTEXT.md §10 rule 10: must only be called after Whisper worker is terminated.

/** Single source of truth for the silence gap threshold literal. */
export function getSilenceThreshold(): number {
  return 1500  // ms — see CONTEXT.md §11 for tuning discussion
}

/** Exported for unit testing. Works on any float vectors; normalized inputs give [0, 1]. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * Embeds all texts via BERT and returns scores[segIdx][slideIdx].
 * onProgress receives the current phase and model download percentage.
 */
export function scoreSegmentsAgainstSlides(
  segmentTexts: string[],
  slideTexts: string[],
  onProgress: (phase: 'bert_loading' | 'bert_scoring', modelPct: number) => void,
): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/bert.worker.ts', import.meta.url),
    )

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as {
        type: string
        progress?: number
        scores?: number[][]
        message?: string
      }

      if (msg.type === 'MODEL_LOADING') {
        onProgress('bert_loading', Math.round(msg.progress ?? 0))
      } else if (msg.type === 'MODEL_READY') {
        onProgress('bert_scoring', 100)
      } else if (msg.type === 'SCORES') {
        worker.terminate()
        resolve(msg.scores ?? [])
      } else if (msg.type === 'ERROR') {
        worker.terminate()
        reject(new Error(msg.message ?? 'BERT worker error'))
      }
    }

    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message ?? 'BERT worker crashed'))
    }

    worker.postMessage({ type: 'SCORE', slideTexts, segmentTexts })
  })
}
