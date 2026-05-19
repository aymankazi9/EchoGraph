// Generates a synthetic study guide when no real guide is provided.
// Uses TF-IDF on slide text + transcript, boosted by domain corpus.
// Produces "Likely Zone" terms rather than "Red Zone".

import usmleTerms from '@/lib/corpus/usmle-highyield.json'

// ─── TF-IDF ───────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
}

// Stopwords — high-frequency terms that carry no keyword signal
const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'are', 'for', 'which',
  'has', 'have', 'been', 'was', 'were', 'will', 'can', 'may', 'when',
  'than', 'then', 'they', 'their', 'there', 'also', 'more', 'but', 'not',
  'its', 'into', 'after', 'some', 'these', 'other', 'about', 'each',
  'such', 'only', 'both', 'where', 'how', 'what', 'because', 'through',
  'during', 'here', 'while', 'our', 'all', 'two', 'one', 'three',
])

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) {
    if (!STOPWORDS.has(t)) tf.set(t, (tf.get(t) ?? 0) + 1)
  }
  return tf
}

/** Exported for unit testing. */
export function computeTFIDF(documents: string[]): Map<string, number> {
  const N = documents.length
  if (N === 0) return new Map()

  const tokenizedDocs = documents.map(tokenize)
  const df = new Map<string, number>()

  // Document frequency pass
  for (const tokens of tokenizedDocs) {
    const uniq = new Set(tokens)
    for (const t of uniq) df.set(t, (df.get(t) ?? 0) + 1)
  }

  // TF-IDF accumulation across all documents
  const scores = new Map<string, number>()
  for (const tokens of tokenizedDocs) {
    const tf = termFrequency(tokens)
    const docLen = tokens.length || 1
    for (const [term, count] of tf) {
      const tfscore = count / docLen
      const idf = Math.log(N / (df.get(term) ?? 1))
      scores.set(term, (scores.get(term) ?? 0) + tfscore * idf)
    }
  }

  return scores
}

// ─── Domain boost ─────────────────────────────────────────────────────────────

const DOMAIN_CORPORA: Record<string, string[]> = {
  premed: usmleTerms.terms,
  engineering: [
    'algorithm', 'complexity', 'derivative', 'eigenvalue', 'entropy', 'fourier',
    'gradient', 'hamiltonian', 'integral', 'kirchhoff', 'laplacian', 'momentum',
    'newton', 'ohm', 'potential', 'quantum', 'recursion', 'thermodynamics',
    'topology', 'vector', 'wavefunction', 'impedance', 'capacitance', 'resistor',
    'transistor', 'diode', 'amplifier', 'bandwidth', 'frequency', 'modulation',
  ],
  law: [
    'burden of proof', 'causation', 'civil procedure', 'common law', 'consideration',
    'constitutional', 'contract', 'damages', 'defendant', 'due process', 'estoppel',
    'evidence', 'federal jurisdiction', 'fourth amendment', 'habeas corpus', 'hearsay',
    'injunction', 'jurisdiction', 'negligence', 'plaintiff', 'precedent', 'promissory',
    'property', 'res judicata', 'statute', 'strict liability', 'tort', 'warrant',
  ],
}

/**
 * Applies a domain corpus boost to TF-IDF scores.
 * Terms appearing in the domain corpus receive a 2× multiplier.
 */
export function applyDomainBoost(
  scores: Map<string, number>,
  domain: string,
): Map<string, number> {
  const corpus = DOMAIN_CORPORA[domain]
  if (!corpus) return scores

  const boosted = new Map(scores)
  for (const term of corpus) {
    const t = term.toLowerCase()
    if (boosted.has(t)) boosted.set(t, boosted.get(t)! * 2)
  }
  return boosted
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns top-N keywords as a synthetic study guide. */
export function generateSyntheticGuide(
  slideTexts: string[],
  transcriptWords: string[],
  domain = 'other',
  topN = 80,
): string[] {
  // Combine slides + transcript as separate "documents"
  const docs = [
    ...slideTexts.filter(Boolean),
    transcriptWords.join(' '),
  ]

  if (docs.length === 0) return []

  let scores = computeTFIDF(docs)
  scores = applyDomainBoost(scores, domain)

  // Sort descending by score, take top N
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term]) => term)
}
