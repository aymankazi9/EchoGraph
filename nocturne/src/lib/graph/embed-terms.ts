// Browser-only. Spins up bert.worker's EMBED message for the Map tab's
// embedding-cosine signal. Mirrors src/lib/sync/bert-scorer.ts's worker-wrapping
// pattern exactly (same worker, same singleton extractor — this just asks for
// raw vectors instead of a cross-similarity matrix).
// CONTEXT.md §10 rule 10: callers must not invoke this while Whisper or the
// sync-engine's own BERT scoring is in flight — that gate lives in the caller
// (map-tab.tsx checks isScoring/sync/recording state before calling this).

export function embedTerms(
  terms: string[],
  onProgress?: (modelPct: number) => void,
): Promise<Record<string, number[]>> {
  return new Promise((resolve, reject) => {
    if (terms.length === 0) { resolve({}); return }

    const worker = new Worker(new URL('../workers/bert.worker.ts', import.meta.url))

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as {
        type: string
        progress?: number
        vectors?: number[][]
        message?: string
      }

      if (msg.type === 'MODEL_LOADING') {
        onProgress?.(Math.round(msg.progress ?? 0))
      } else if (msg.type === 'MODEL_READY') {
        onProgress?.(100)
      } else if (msg.type === 'EMBEDDINGS') {
        worker.terminate()
        const vectors = msg.vectors ?? []
        const byTerm: Record<string, number[]> = {}
        terms.forEach((term, i) => { if (vectors[i]) byTerm[term] = vectors[i] })
        resolve(byTerm)
      } else if (msg.type === 'ERROR') {
        worker.terminate()
        reject(new Error(msg.message ?? 'BERT worker error'))
      }
    }

    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message ?? 'BERT worker crashed'))
    }

    worker.postMessage({ type: 'EMBED', texts: terms })
  })
}
