// Browser-only. Orchestrates silence detection + BERT scoring → sync map.
// CONTEXT.md §10 rule 10: startSync must only be called after Whisper worker is gone.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getMasterKey } from '@/lib/crypto/vault'
import { fetchAndDecryptFile, decryptText } from '@/lib/crypto/decrypt'
import { encryptText } from '@/lib/crypto/encrypt'
import { detectSilenceGaps } from './silence-detector'
import { getSilenceThreshold, scoreSegmentsAgainstSlides } from './bert-scorer'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncPhase =
  | 'fetching'
  | 'detecting'
  | 'bert_loading'
  | 'bert_scoring'
  | 'writing'
  | 'done'
  | 'error'

export interface SyncProgress {
  phase: SyncPhase
  /** 0-100 during BERT model download */
  modelPct: number
  error: string | null
}

export type OnSyncProgress = (p: SyncProgress) => void

interface SyncSegment {
  startMs: number
  endMs: number
  slideIndex: number  // page_number (1-based)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_CONFIDENCE = 0.5  // segments scoring below this inherit from prior segment
const MIN_SEGMENT_WORDS = 5  // short segments skip BERT and inherit

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Decode any browser-supported audio to 16 kHz mono Float32Array.
// AudioContext is main-thread only — must NOT be called inside a Worker.
async function decodeToFloat32(audioBuffer: ArrayBuffer): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate: 16_000 })
  try {
    const decoded = await ctx.decodeAudioData(audioBuffer.slice(0))
    const pcm = new Float32Array(decoded.length)
    pcm.set(decoded.getChannelData(0))
    return pcm
  } finally {
    ctx.close()
  }
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Runs the full slide-sync pipeline: silence detection → BERT scoring → DB writes.
 * Returns a cancel function. Requires session.status = 'transcribed' and has_slides = true.
 */
export function startSync(
  supabase: SupabaseClient,
  sessionId: string,
  audioStoragePath: string,
  onProgress: OnSyncProgress,
): () => void {
  let cancelled = false

  const state: SyncProgress = { phase: 'fetching', modelPct: 0, error: null }
  const emit = () => onProgress({ ...state })

  async function run() {
    const mk = getMasterKey()
    if (!mk) throw new Error('Vault is locked — please unlock before analyzing.')

    await supabase.from('sessions').update({ status: 'syncing' }).eq('id', sessionId)
    emit()

    // ── Phase 1: Fetch + decrypt transcript words ────────────────────────────
    const { data: wordRows, error: wordErr } = await supabase
      .from('transcript_words')
      .select('id, word_encrypted, start_time_ms, end_time_ms')
      .eq('session_id', sessionId)
      .order('start_time_ms')

    if (wordErr) throw new Error(wordErr.message)
    if (cancelled) return
    if (!wordRows || wordRows.length === 0) throw new Error('No transcript words — transcribe first.')

    const words = await Promise.all(
      wordRows.map(async (w) => ({
        id: w.id as string,
        word: await decryptText(mk, w.word_encrypted as string),
        startMs: w.start_time_ms as number,
        endMs: w.end_time_ms as number,
      })),
    )
    if (cancelled) return

    // ── Phase 2: Fetch + decrypt slide texts ─────────────────────────────────
    const { data: slideRows, error: slideErr } = await supabase
      .from('slides')
      .select('page_number, text_encrypted')
      .eq('session_id', sessionId)
      .order('page_number')

    if (slideErr) throw new Error(slideErr.message)
    if (cancelled) return
    if (!slideRows || slideRows.length === 0) throw new Error('No slides found — upload a PDF first.')

    const slides = await Promise.all(
      slideRows.map(async (s) => ({
        pageNumber: s.page_number as number,
        text: s.text_encrypted
          ? await decryptText(mk, s.text_encrypted as string).catch(() => '')
          : '',
      })),
    )
    if (cancelled) return

    // ── Phase 3: Decrypt audio → PCM → silence detection ────────────────────
    state.phase = 'detecting'
    emit()

    const opusBuffer = await fetchAndDecryptFile(supabase, audioStoragePath, mk)
    if (cancelled) return

    const pcm = await decodeToFloat32(opusBuffer)
    if (cancelled) return

    const totalDurationMs = Math.round((pcm.length / 16_000) * 1000)
    // detectSilenceGaps transfers pcm.buffer — pcm is detached after this call
    const gaps = await detectSilenceGaps(pcm, getSilenceThreshold())
    if (cancelled) return

    // ── Phase 4: Build time segments from gap midpoints ──────────────────────
    const breakPoints = gaps.map((g) => Math.round((g.startMs + g.endMs) / 2))
    const segmentBounds: { startMs: number; endMs: number }[] = []
    let prev = 0
    for (const bp of breakPoints) {
      segmentBounds.push({ startMs: prev, endMs: bp })
      prev = bp
    }
    segmentBounds.push({ startMs: prev, endMs: totalDurationMs })

    // Collect words per segment for BERT input text
    const segmentTexts = segmentBounds.map(({ startMs, endMs }) =>
      words
        .filter((w) => w.startMs >= startMs && w.endMs <= endMs)
        .map((w) => w.word)
        .join(' '),
    )

    // Segments with too few words get empty string → inherit from prior
    const bertInputs = segmentTexts.map((t) =>
      t.trim().split(/\s+/).filter(Boolean).length >= MIN_SEGMENT_WORDS ? t : '',
    )

    // ── Phase 5: BERT scoring ────────────────────────────────────────────────
    const slideTexts = slides.map((s) => s.text)

    const scores = await scoreSegmentsAgainstSlides(
      bertInputs,
      slideTexts,
      (phase, modelPct) => {
        if (cancelled) return
        state.phase = phase
        state.modelPct = modelPct
        emit()
      },
    )
    if (cancelled) return

    // ── Phase 6: Assign slides to segments ───────────────────────────────────
    state.phase = 'writing'
    emit()

    let lastSlideIdx = 0
    const syncSegments: SyncSegment[] = segmentBounds.map((bounds, si) => {
      const segScores = scores[si]
      let slideIdx = -1

      if (segScores && bertInputs[si].length > 0) {
        const maxScore = Math.max(...segScores)
        if (maxScore >= MIN_CONFIDENCE) {
          slideIdx = segScores.indexOf(maxScore)
        }
      }

      if (slideIdx === -1) slideIdx = lastSlideIdx
      lastSlideIdx = slideIdx

      return { ...bounds, slideIndex: slides[slideIdx]?.pageNumber ?? slideIdx + 1 }
    })

    // ── Phase 7: Encrypt + upsert sync_map ──────────────────────────────────
    const mapEncrypted = await encryptText(mk, JSON.stringify({ segments: syncSegments }))
    const { error: upsertErr } = await supabase
      .from('sync_map')
      .upsert({ session_id: sessionId, map_encrypted: mapEncrypted }, { onConflict: 'session_id' })

    if (upsertErr) throw new Error(upsertErr.message)
    if (cancelled) return

    // ── Phase 8: Backfill transcript_words.slide_index (one UPDATE per segment)
    await Promise.all([
      // All segments except last: filter by [startMs, endMs)
      ...syncSegments.slice(0, -1).map(({ startMs, endMs, slideIndex }) =>
        supabase
          .from('transcript_words')
          .update({ slide_index: slideIndex })
          .eq('session_id', sessionId)
          .gte('start_time_ms', startMs)
          .lt('start_time_ms', endMs),
      ),
      // Last segment: everything from startMs onward
      supabase
        .from('transcript_words')
        .update({ slide_index: syncSegments.at(-1)!.slideIndex })
        .eq('session_id', sessionId)
        .gte('start_time_ms', syncSegments.at(-1)!.startMs),
    ])

    if (cancelled) return

    // ── Phase 9: Update session status ───────────────────────────────────────
    await supabase.from('sessions').update({ status: 'synced' }).eq('id', sessionId)

    state.phase = 'done'
    emit()
  }

  run().catch(async (e) => {
    if (!cancelled) {
      state.phase = 'error'
      state.error = e instanceof Error ? e.message : 'Sync failed'
      emit()
      try {
        await supabase.from('sessions').update({ status: 'transcribed' }).eq('id', sessionId)
      } catch { /* ignore */ }
    }
  })

  return () => { cancelled = true }
}
