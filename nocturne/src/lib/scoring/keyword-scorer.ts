// Scores a keyword list against transcript + slide data.
// Output feeds the keywords DB table and drives Red/Likely Zone UI.

import type { SyncSegment } from '@/lib/sync/playhead-tracker'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InputKeyword {
  term: string
  // 'both' = appeared in user's study guide AND independently identified from lecture content
  source: 'real_guide' | 'synthetic' | 'anki' | 'both'
}

export interface ScoredKeyword extends InputKeyword {
  zone: 'red' | 'likely'
  mentionCount: number
  dwellTimeMs: number
  emphasisScore: number
  lectureConfidence: number
  confidenceScore: number
  slideIndices: number[]  // 1-based page numbers
}

export interface SlideText {
  pageNumber: number
  text: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalizes a value into 0–1 given the observed maximum.
 * Returns 0 (not NaN) when max ≤ 0 or non-finite — covers the degenerate
 * case where all inputs for a component are identical (commonly all-zero),
 * which would otherwise propagate NaN through every downstream calculation.
 */
function normalize(value: number, max: number): number {
  if (!(max > 0)) return 0   // catches 0, negative, NaN, and ±Infinity
  return Math.min(value / max, 1)
}

/**
 * Finds all occurrences of a keyword phrase in a token array.
 * Returns the count and a set of matching token indices.
 */
function matchKeywordInTokens(keyword: string, tokens: string[]): number {
  const kwTokens = keyword.toLowerCase().split(/\s+/)
  let count = 0

  if (kwTokens.length === 1) {
    for (const t of tokens) {
      if (t === kwTokens[0]) count++
    }
  } else {
    for (let i = 0; i <= tokens.length - kwTokens.length; i++) {
      let match = true
      for (let j = 0; j < kwTokens.length; j++) {
        if (tokens[i + j] !== kwTokens[j]) { match = false; break }
      }
      if (match) count++
    }
  }

  return count
}

/**
 * Returns the 1-based page numbers of slides whose text contains the keyword.
 */
function slidesContaining(keyword: string, slides: SlideText[]): number[] {
  const kw = keyword.toLowerCase()
  return slides
    .filter((s) => s.text.toLowerCase().includes(kw))
    .map((s) => s.pageNumber)
}

/**
 * Computes total dwell time for a keyword: sum of syncMap segment durations
 * for segments whose slideIndex matches one of the keyword's slides.
 */
function computeDwellTime(
  slideIndices: number[],
  syncMap: SyncSegment[],
): number {
  const slideSet = new Set(slideIndices)
  return syncMap
    .filter((seg) => slideSet.has(seg.slideIndex))
    .reduce((sum, seg) => sum + (seg.endMs - seg.startMs), 0)
}

// ─── Slide density ────────────────────────────────────────────────────────────

/**
 * Computes keyword density per slide (0-100).
 * Returns a map from pageNumber → density score.
 */
export function computeSlideDensity(
  keywords: InputKeyword[],
  slides: SlideText[],
): Map<number, number> {
  const density = new Map<number, number>()

  for (const slide of slides) {
    const text = slide.text.toLowerCase()
    const tokens = text.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) { density.set(slide.pageNumber, 0); continue }

    let hitCount = 0
    for (const kw of keywords) {
      if (text.includes(kw.term.toLowerCase())) hitCount++
    }

    // Density = hits / total keywords (0-1), scaled to 0-100
    density.set(slide.pageNumber, Math.round((hitCount / keywords.length) * 100))
  }

  return density
}

// ─── Professor Emphasis Detection ─────────────────────────────────────────────

/**
 * Emphasis score: normalized dwell time × normalized mention count.
 * Captures "professor spent time on this AND said it repeatedly."
 */
function computeEmphasisScore(
  dwellTimeMs: number,
  mentionCount: number,
  maxDwell: number,
  maxMentions: number,
): number {
  return normalize(dwellTimeMs, maxDwell) * 0.6 + normalize(mentionCount, maxMentions) * 0.4
}

// ─── Lecture Confidence Score ─────────────────────────────────────────────────

/**
 * Lecture confidence: slide_density contribution × verbal coverage.
 * High = keyword appears prominently on slides AND in transcript.
 */
function computeLectureConfidence(
  slideIndices: number[],
  slides: SlideText[],
  density: Map<number, number>,
  mentionCount: number,
  maxMentions: number,
): number {
  if (slideIndices.length === 0) return normalize(mentionCount, maxMentions) * 0.4

  const avgDensityForKw =
    slideIndices.reduce((sum, idx) => sum + (density.get(idx) ?? 0), 0) /
    slideIndices.length

  return (avgDensityForKw / 100) * 0.5 + normalize(mentionCount, maxMentions) * 0.5
}

// ─── Zone thresholds ──────────────────────────────────────────────────────────

// Real guide / anki keywords: Red Zone if confidence ≥ 0.1 (they're already curated)
const RED_ZONE_CONFIDENCE = 0.1
// Synthetic/inferred keywords: Likely Zone if confidence ≥ 0.10.
// Lowered from 0.15 — the prompt now filters generic terms at extraction time,
// so borderline-but-real terms that survive extraction deserve to be retained.
const LIKELY_ZONE_CONFIDENCE = 0.10

// ─── Slides-only scoring ──────────────────────────────────────────────────────
//
// When the session has no transcript (tokens.length === 0), mention counts and
// dwell times are all zero.  The normal formula's maximum achievable confidence
// becomes (avgSlideDensity/100 * 0.5) * 0.3 = 0.15, i.e. exactly at the
// synthetic drop threshold — so virtually every synthetic keyword gets dropped.
//
// In slides-only mode we bypass the weighted formula and score directly from
// avgSlideDensity: how much a term clusters with other keywords on the same
// slides it appears on.  Guide-sourced terms get a confidence floor so they
// always survive even if they appear on sparse slides — the study guide
// explicitly named them as important.

/** Floor applied to guide-sourced terms when no transcript is present. */
const GUIDE_SLIDES_ONLY_FLOOR = 0.5

/**
 * Slides-only confidence: avgSlideDensity (0–1) as the primary signal.
 * Guide-backed terms (real_guide, anki, both) receive at least GUIDE_SLIDES_ONLY_FLOOR
 * so they are never discarded for lacking transcript coverage that doesn't exist yet.
 */
function computeSlideOnlyConfidence(
  kw: InputKeyword,
  slideIndices: number[],
  density: Map<number, number>,
): number {
  const avgDensity =
    slideIndices.length > 0
      ? slideIndices.reduce((sum, idx) => sum + (density.get(idx) ?? 0), 0) /
        (slideIndices.length * 100)   // density is 0-100; normalise to 0-1
      : 0

  const isGuideBacked =
    kw.source === 'real_guide' || kw.source === 'anki' || kw.source === 'both'
  return isGuideBacked ? Math.max(GUIDE_SLIDES_ONLY_FLOOR, avgDensity) : avgDensity
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

/**
 * Scores all input keywords against transcript + slide + syncMap data.
 * Returns scored keywords (low-confidence synthetic ones are dropped).
 */
export function scoreKeywords(
  keywords: InputKeyword[],
  transcriptText: string,
  slides: SlideText[],
  syncMap: SyncSegment[],
): ScoredKeyword[] {
  if (keywords.length === 0) return []

  const tokens = transcriptText
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  // Slides-only mode: no transcript tokens means mention count and dwell time
  // are both zero for every keyword, which starves the normal formula.
  // Switch to the slides-only confidence path for this run.
  const slidesOnlyMode = tokens.length === 0

  const density = computeSlideDensity(keywords, slides)

  // First pass: raw metrics
  const rawScores = keywords.map((kw) => {
    const mentionCount = matchKeywordInTokens(kw.term, tokens)
    const slideIndices = slidesContaining(kw.term, slides)
    const dwellTimeMs = computeDwellTime(slideIndices, syncMap)
    return { kw, mentionCount, slideIndices, dwellTimeMs }
  })

  const maxMentions = Math.max(...rawScores.map((r) => r.mentionCount), 1)
  const maxDwell = Math.max(...rawScores.map((r) => r.dwellTimeMs), 1)

  // Second pass: derived scores
  const scored: ScoredKeyword[] = []
  // TEMP DIAG: collect full diagnostic entry for every dropped keyword
  const dropped: {
    term: string; source: string
    confidenceScore: number; emphasisScore: number; lectureConfidence: number
    dwellTimeMs: number; mentionCount: number
  }[] = []

  for (const { kw, mentionCount, slideIndices, dwellTimeMs } of rawScores) {
    const emphasisScore = computeEmphasisScore(
      dwellTimeMs,
      mentionCount,
      maxDwell,
      maxMentions,
    )
    const lectureConfidence = computeLectureConfidence(
      slideIndices,
      slides,
      density,
      mentionCount,
      maxMentions,
    )

    // Overall confidence
    let confidenceScore: number
    if (slidesOnlyMode) {
      // No transcript — use slide-density-based formula so keywords aren't
      // silently dropped for lacking coverage that doesn't exist yet.
      // emphasisScore / lectureConfidence are still stored for transparency.
      confidenceScore = computeSlideOnlyConfidence(kw, slideIndices, density)
    } else {
      // Normal formula: weighted average of emphasis, lecture confidence, mention rate.
      confidenceScore =
        emphasisScore * 0.5 +
        lectureConfidence * 0.3 +
        normalize(mentionCount, maxMentions) * 0.2

      // 'both' bonus: term in study guide AND independently supported by lecture.
      // Lifts ranking within Red Zone only — does not affect zone assignment.
      if (kw.source === 'both') confidenceScore = Math.min(1.0, confidenceScore + 0.1)
    }

    // Zone assignment: keyed off source tag, not confidenceScore.
    // Guide-sourced terms → Red Zone; synthetic/inferred → Likely Zone.
    // This holds in both normal and slides-only mode — the formula change
    // above only affects confidenceScore, not the source tag.
    const isSynthetic = kw.source === 'synthetic'
    const threshold = isSynthetic ? LIKELY_ZONE_CONFIDENCE : RED_ZONE_CONFIDENCE

    // In slides-only mode, skip the confidence drop gate for synthetic keywords.
    // dwell-time and mention-count are structurally zero for everything when
    // there is no transcript — the threshold is a meaningless signal in that
    // context. Quality control belongs in LLM extraction, not scoring.
    // confidenceScore is still computed and stored for within-zone ordering.
    if (confidenceScore < threshold && isSynthetic && !slidesOnlyMode) {
      dropped.push({
        term: kw.term,
        source: kw.source,
        confidenceScore,   // raw, not rounded — lets caller see 0 vs NaN vs tiny float
        emphasisScore,
        lectureConfidence,
        dwellTimeMs,
        mentionCount,
      })
      continue  // drop low-signal synthetic
    }

    const zone: 'red' | 'likely' = isSynthetic ? 'likely' : 'red'

    scored.push({
      ...kw,
      zone,
      mentionCount,
      dwellTimeMs,
      emphasisScore: Math.round(emphasisScore * 1000) / 1000,
      lectureConfidence: Math.round(lectureConfidence * 1000) / 1000,
      confidenceScore: Math.round(confidenceScore * 1000) / 1000,
      slideIndices,
    })
  }

  // TEMP DIAG: entry vs. survival counts + dropped detail
  // Only synthetic keywords can be dropped (threshold 0.15).
  // Non-synthetic (guide/both/anki/real_guide) are never dropped regardless of score.
  if (dropped.length > 0) {
    const nanCount  = dropped.filter(d => isNaN(d.confidenceScore)).length
    const zeroCount = dropped.filter(d => d.confidenceScore === 0).length
    const sourceCounts = dropped.reduce<Record<string, number>>((acc, d) => {
      acc[d.source] = (acc[d.source] ?? 0) + 1; return acc
    }, {})
    console.log(
      '[diag:scorer] entered =', keywords.length,
      '| survived =', scored.length,
      '| dropped =', dropped.length,
      '| NaN confidenceScore =', nanCount,
      '| zero confidenceScore =', zeroCount,
      '| dropped source breakdown =', sourceCounts,
    )
    console.log('[diag:scorer] dropped sample (first 10 of', dropped.length, '):',
      dropped.slice(0, 10))
  } else {
    console.log(
      '[diag:scorer] entered =', keywords.length,
      '| survived =', scored.length,
      '| dropped = 0',
    )
  }

  // Sort: red zone first, then by confidence descending
  return scored.sort((a, b) => {
    if (a.zone !== b.zone) return a.zone === 'red' ? -1 : 1
    return b.confidenceScore - a.confidenceScore
  })
}
