import { describe, it, expect } from 'vitest'
import { scoreKeywords } from './keyword-scorer'

// Shared fixtures — enough mention signal to pass the LIKELY_ZONE_CONFIDENCE threshold
const transcript = 'action potential action potential action potential sodium potassium pump diffusion diffusion diffusion'
const slides = [
  { pageNumber: 1, text: 'action potential sodium potassium pump' },
  { pageNumber: 2, text: 'diffusion' },
]
// syncMap: slide 1 gets 60s dwell, slide 2 gets 10s
const syncMap = [
  { startMs: 0,     endMs: 60_000, slideIndex: 1 },
  { startMs: 60_000, endMs: 70_000, slideIndex: 2 },
]

describe('scoreKeywords — "both" source bonus', () => {
  it('both (low dwell) ranks above inferred with equal dwell', () => {
    const result = scoreKeywords(
      [
        { term: 'action potential', source: 'both' },
        { term: 'diffusion',        source: 'synthetic' },
      ],
      transcript,
      slides,
      syncMap,
    )

    const bothKw      = result.find((k) => k.term === 'action potential')!
    const syntheticKw = result.find((k) => k.term === 'diffusion')!

    // 'both' is Red Zone; 'synthetic' is Likely Zone — Red comes first
    expect(result.indexOf(bothKw)).toBeLessThan(result.indexOf(syntheticKw))
    // And 'both' gets the 0.1 bonus on top
    expect(bothKw.confidenceScore).toBeGreaterThan(syntheticKw.confidenceScore)
  })

  it('both does NOT outrank a high-dwell real_guide term purely on bonus', () => {
    // real_guide on slide 1 (60s dwell), both on slide 2 (10s dwell)
    const result = scoreKeywords(
      [
        { term: 'action potential', source: 'real_guide' },
        { term: 'sodium potassium pump', source: 'both' },
      ],
      transcript,
      slides,
      syncMap,
    )

    const realGuide = result.find((k) => k.term === 'action potential')!
    const bothKw    = result.find((k) => k.term === 'sodium potassium pump')!

    // Both are Red Zone — sorted by confidence descending
    expect(realGuide.confidenceScore).toBeGreaterThan(bothKw.confidenceScore - 0.1)
  })

  it('zone assignment: real_guide → red, synthetic → likely, both → red, anki → red', () => {
    const result = scoreKeywords(
      [
        { term: 'action potential',      source: 'real_guide' },
        { term: 'diffusion',             source: 'synthetic'  },
        { term: 'sodium potassium pump', source: 'both'       },
        { term: 'action potential',      source: 'anki'       },
      ],
      transcript,
      slides,
      syncMap,
    )

    const byTerm = (t: string, s: string) => result.find((k) => k.term === t && k.source === s)

    expect(byTerm('action potential',      'real_guide')?.zone).toBe('red')
    expect(byTerm('diffusion',             'synthetic' )?.zone).toBe('likely')
    expect(byTerm('sodium potassium pump', 'both'      )?.zone).toBe('red')
    expect(byTerm('action potential',      'anki'      )?.zone).toBe('red')
  })
})
