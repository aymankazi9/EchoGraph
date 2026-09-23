import { describe, it, expect } from 'vitest'
import { diffKeywords, normalizeTerm } from './keyword-diff'

describe('normalizeTerm', () => {
  it('lowercases, trims, and collapses internal whitespace', () => {
    expect(normalizeTerm('  Mitosis  ')).toBe('mitosis')
    expect(normalizeTerm('Cell  Division')).toBe('cell division')
    expect(normalizeTerm('DNA Replication')).toBe('dna replication')
  })
})

describe('diffKeywords', () => {
  it('returns all as inserts when no existing rows', () => {
    const diff = diffKeywords([], ['Mitosis', 'Meiosis'])
    expect(diff.existingByNorm.size).toBe(0)
    expect(diff.insertTerms).toHaveLength(2)
    expect(diff.removedIds).toHaveLength(0)
    expect(diff.legacyIds).toHaveLength(0)
  })

  it('preserves keyword ID for an unchanged term', () => {
    const diff = diffKeywords(
      [{ id: 'kw-1', normalized_term: 'mitosis', source: 'synthetic' }],
      ['Mitosis'],
    )
    expect(diff.existingByNorm.get('mitosis')).toBe('kw-1')
    expect(diff.insertTerms).toHaveLength(0)
    expect(diff.removedIds).toHaveLength(0)
  })

  it('preserves ID for a reworded term with the same normalization (case change)', () => {
    // "Mitosis" and "MITOSIS" normalize to the same key — same DB row should be kept
    const diff = diffKeywords(
      [{ id: 'kw-1', normalized_term: 'mitosis', source: 'synthetic' }],
      ['MITOSIS'],
    )
    expect(diff.existingByNorm.get('mitosis')).toBe('kw-1')
    expect(diff.insertTerms).toHaveLength(0)
    expect(diff.removedIds).toHaveLength(0)
  })

  it('marks a removed term in removedIds, does not affect unchanged terms', () => {
    const diff = diffKeywords(
      [
        { id: 'kw-1', normalized_term: 'mitosis', source: 'real_guide' },
        { id: 'kw-2', normalized_term: 'meiosis', source: 'synthetic' },
      ],
      ['Mitosis'],
    )
    expect(diff.removedIds).toContain('kw-2')
    expect(diff.removedIds).not.toContain('kw-1')
    expect(diff.existingByNorm.get('mitosis')).toBe('kw-1')
  })

  it('classifies legacy rows (normalized_term = "") as legacyIds, not removedIds', () => {
    const diff = diffKeywords(
      [
        { id: 'old-1', normalized_term: '', source: 'synthetic' },
        { id: 'old-2', normalized_term: '', source: 'synthetic' },
      ],
      ['Mitosis'],
    )
    expect(diff.legacyIds).toHaveLength(2)
    expect(diff.removedIds).toHaveLength(0)
    expect(diff.insertTerms).toContain('mitosis')
  })

  it('handles a mix of legacy, unchanged, removed, and new terms correctly', () => {
    // Regression scenario: one legacy, one kept, one removed, one new
    const diff = diffKeywords(
      [
        { id: 'old-1', normalized_term: '', source: 'synthetic' },       // legacy — goes to legacyIds
        { id: 'kw-1', normalized_term: 'mitosis', source: 'real_guide' }, // unchanged — stays
        { id: 'kw-2', normalized_term: 'meiosis', source: 'synthetic' },  // removed — goes to removedIds
      ],
      ['Mitosis', 'Cell Division'],                  // "meiosis" gone, "cell division" new
    )
    expect(diff.legacyIds).toEqual(['old-1'])
    expect(diff.existingByNorm.get('mitosis')).toBe('kw-1')
    expect(diff.removedIds).toEqual(['kw-2'])
    expect(diff.insertTerms).toContain('cell division')
    expect(diff.insertTerms).not.toContain('mitosis')
  })

  it('never removes or updates manual keywords regardless of whether they appear in new terms', () => {
    // Manual cards must survive a full rescore that produces a completely different keyword set
    const diff = diffKeywords(
      [
        { id: 'manual-1', normalized_term: 'my custom term', source: 'manual' },
        { id: 'kw-1',     normalized_term: 'mitosis',        source: 'synthetic' },
      ],
      ['Meiosis'],  // neither 'my custom term' nor 'mitosis' in new set
    )
    expect(diff.removedIds).not.toContain('manual-1')  // manual: never in removedIds
    expect(diff.existingByNorm.has('my custom term')).toBe(false)  // manual: never in existingByNorm
    expect(diff.removedIds).toContain('kw-1')          // synthetic not in new set → removed as normal
    expect(diff.insertTerms).toContain('meiosis')
  })
})
