// Pure utility for diffing old vs. new keyword sets by normalized term identity.
// Used by handleScore to determine which keywords to update/insert/delete.

/** Canonical identity key: lowercased, trimmed, whitespace-collapsed. */
export function normalizeTerm(term: string): string {
  return term.toLowerCase().trim().replace(/\s+/g, ' ')
}

export interface ExistingKeywordRow {
  id: string
  /** '' for rows written by the old delete-all/insert-all path (no identity key). */
  normalized_term: string
  /** Source tag — 'manual' rows are always preserved; rescore never deletes them. */
  source: string
}

export interface KeywordDiff {
  /** normalizedTerm → DB id for existing rows that match the new set (UPDATE these). */
  existingByNorm: Map<string, string>
  /** New terms with no existing row — should be INSERTed. */
  insertTerms: string[]
  /** IDs of recognized rows whose term no longer appears — should be DELETEd (with confirmation if they have SM-2 history). */
  removedIds: string[]
  /** IDs of old-path rows (normalized_term = '') — DELETEd without confirmation. */
  legacyIds: string[]
}

export function diffKeywords(
  existingRows: ExistingKeywordRow[],
  newTerms: string[],
): KeywordDiff {
  const newNorms = new Set(newTerms.map(normalizeTerm))
  const existingByNorm = new Map<string, string>()
  const legacyIds: string[] = []

  for (const row of existingRows) {
    // Manual keywords are never touched by rescore — skip entirely so they
    // never land in existingByNorm (preventing accidental UPDATE) or
    // removedIds (preventing DELETE when they're absent from the new scored set).
    if (row.source === 'manual') continue

    if (row.normalized_term === '') {
      legacyIds.push(row.id)
    } else {
      existingByNorm.set(row.normalized_term, row.id)
    }
  }

  const insertTerms: string[] = []
  for (const nt of newNorms) {
    if (!existingByNorm.has(nt)) insertTerms.push(nt)
  }

  const removedIds = [...existingByNorm.entries()]
    .filter(([nt]) => !newNorms.has(nt))
    .map(([, id]) => id)

  return { existingByNorm, insertTerms, removedIds, legacyIds }
}
