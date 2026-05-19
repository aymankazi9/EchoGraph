// Runs in a dedicated Web Worker. BERT feature-extraction via Transformers.js.
// CONTEXT.md §10 rule 10: never runs simultaneously with Whisper — caller ensures this.

import { pipeline, env } from '@huggingface/transformers'

env.allowLocalModels = false

type InMsg = { type: 'SCORE'; slideTexts: string[]; segmentTexts: string[] }
type OutMsg =
  | { type: 'MODEL_LOADING'; progress: number; file: string }
  | { type: 'MODEL_READY' }
  | { type: 'SCORES'; scores: number[][] }
  | { type: 'ERROR'; message: string }

const post = (msg: OutMsg) =>
  (self as unknown as { postMessage(d: OutMsg): void }).postMessage(msg)

let extractor: Awaited<ReturnType<typeof pipeline>> | null = null

async function getExtractor() {
  if (extractor) return extractor
  extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    {
      progress_callback: (p: { status: string; progress?: number; file?: string }) => {
        if (p.status === 'progress') {
          post({ type: 'MODEL_LOADING', progress: p.progress ?? 0, file: p.file ?? '' })
        }
      },
    },
  )
  return extractor
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

self.addEventListener('message', async (event: MessageEvent<InMsg>) => {
  if (event.data.type !== 'SCORE') return

  try {
    const ext = await getExtractor()
    post({ type: 'MODEL_READY' })

    const { slideTexts, segmentTexts } = event.data

    if (segmentTexts.length === 0 || slideTexts.length === 0) {
      post({ type: 'SCORES', scores: [] })
      return
    }

    const allTexts = [...segmentTexts, ...slideTexts]
    const output = await (ext as (
      input: string[],
      opts: Record<string, unknown>,
    ) => Promise<{ tolist(): number[][] }>)(allTexts, { pooling: 'mean', normalize: true })

    const embeddings = output.tolist()
    const segEmbeddings = embeddings.slice(0, segmentTexts.length)
    const slideEmbeddings = embeddings.slice(segmentTexts.length)

    const scores = segEmbeddings.map((segEmb) =>
      slideEmbeddings.map((slideEmb) => cosineSimilarity(segEmb, slideEmb)),
    )
    post({ type: 'SCORES', scores })
  } catch (e) {
    post({ type: 'ERROR', message: String(e) })
  }
})
