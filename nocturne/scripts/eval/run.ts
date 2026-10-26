#!/usr/bin/env node
// Prompt eval script — run manually to benchmark extraction and enhancement.
//
// Usage:
//   node --experimental-strip-types scripts/eval/run.ts
//
// Reads ANTHROPIC_API_KEY from .env.local (same file used by the dev server).
// Writes results to scripts/eval/results/baseline.json (or a timestamped file
// if --tag=<label> is passed).
//
// IMPORTANT: The prompts below must be kept in sync with:
//   - extract/keywords/route.ts → buildPrompt() + callClaude system prompt
//   - generate/flashcards/route.ts → buildPromptBlock() + callClaude system prompt

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixtures, type Fixture } from './fixtures.ts'

// ── Load .env.local ───────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '../../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
}

const API_KEY = process.env.ANTHROPIC_API_KEY
if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY not set — add it to .env.local')
  process.exit(1)
}

// ── Anthropic call (no DB logging — this is a standalone script) ──────────────

async function callClaude(system: string, userMsg: string): Promise<{ text: string; latencyMs: number }> {
  const t0 = Date.now()
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: userMsg }],
    }),
  })
  const latencyMs = Date.now() - t0
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`)
  const data = await resp.json() as { content: { type: string; text: string }[] }
  const text = data.content?.find((b) => b.type === 'text')?.text ?? ''
  return { text, latencyMs }
}

// ── Extraction prompt (mirror of extract/keywords/route.ts buildPrompt) ────────
// KEEP IN SYNC with src/app/api/extract/keywords/route.ts → buildPrompt()

// KEEP IN SYNC with src/app/api/extract/keywords/route.ts → buildPrompt()
function buildExtractionPrompt(
  guideText: string | null,
  slideBlock: string,
  transcriptBlock: string,
): string {
  const sourceRule = guideText
    ? [
        '3. Tag each term with source — choose exactly one:',
        '   "guide"    — present in the study guide only',
        '   "inferred" — identified from lecture content (slides/transcript) independently',
        '   "both"     — present in the study guide AND independently emphasized in the lecture',
      ].join('\n')
    : '3. Tag every term with source: "inferred" (the only valid value when no study guide is supplied).'

  const parts: string[] = [
    'You are an experienced TA preparing a study list for a college-level exam.',
    'Your job is to identify the specific terms a student must know — not to summarise the lecture.',
    '',
    'Extract every term the material warrants.',
    'A short or thin lecture produces a short list; a dense lecture may produce many.',
    'Do not pad to reach a number and do not cap to stay under one.',
    '',
    'Prioritise (in order):',
    '  • Named laws, theorems, principles, and equations (e.g. "bayes\' theorem", "ohm\'s law", "mens rea")',
    '  • Field-specific technical vocabulary that would appear in a textbook glossary',
    '  • Named processes, mechanisms, pathways, and structures (e.g. "krebs cycle", "big-o notation")',
    '  • Multi-word technical phrases where the combination carries specific meaning',
    '',
    '(The example terms above illustrate the type and specificity to look for across any subject.',
    'Do not extract them unless they explicitly appear in the supplied material below.)',
    '',
    'Skip — do not extract:',
    '  • Announcements, logistics, and administrative text ("exam next week", "office hours", "submit on Canvas")',
    '  • Slide titles, section headers, and running headers',
    '  • Generic standalone nouns with no technical meaning in isolation:',
    '    "system", "process", "factor", "structure", "function", "level", "type", "concept",',
    '    "approach", "method", "result", "data", "example", "question", "value", "model", "case"',
    '  • Example-specific numbers, dates, or incidental proper nouns — extract the named concept, not the example',
    '    (e.g. "In 1905, Einstein derived..." → extract "special relativity" not "1905" or "Einstein")',
    '  • Terms the professor explicitly marks as not testable',
    '',
    'Rules:',
    '1. Prefer the most complete, specific form: "ideal gas law" not "gas law", "opportunity cost" not "cost".',
    '2. Merge synonyms and abbreviations into one canonical term using the more complete or widely recognised form.',
    '   Examples: "Na⁺/K⁺ ATPase" and "sodium-potassium pump" → "sodium-potassium ATPase"',
    '             "mRNA" alone is too generic — keep it only if the lecture treats it as a standalone concept.',
    sourceRule,
    '4. Tag each term with kind — choose exactly one:',
    '   "definition"  — a named thing with a precise meaning (e.g. "opportunity cost", "mens rea", "due process")',
    '   "equation"    — a named equation, law, or formula (e.g. "bayes\' theorem", "hooke\'s law", "ohm\'s law")',
    '   "process"     — a named sequence of steps or mechanism (e.g. "krebs cycle", "meiosis", "binary search")',
    '   "structure"   — a named physical or conceptual structure (e.g. "mitochondria", "separation of powers")',
    '   "principle"   — a named rule or governing idea that is not itself an equation (e.g. "parsimony", "law of demand")',
    '5. Use lowercase for all terms.',
    '6. Only return terms explicitly present in the supplied slides or transcript.',
    '   Do not invent or infer terms the material does not mention.',
    '7. If the slides and transcript contain no extractable content, return exactly { "keywords": [] }.',
    '',
    'Return exactly this JSON and nothing else:',
    '{ "keywords": [{ "term": "...", "source": "guide"|"inferred"|"both", "kind": "definition"|"equation"|"process"|"structure"|"principle" }] }',
  ]

  if (guideText) parts.push('', '--- STUDY GUIDE ---', guideText.slice(0, 8000))
  if (slideBlock) parts.push('', '--- SLIDES ---', slideBlock)
  if (transcriptBlock) parts.push('', '--- LECTURE TRANSCRIPT ---', transcriptBlock)

  return parts.join('\n')
}

const EXTRACTION_SYSTEM =
  'You are a precise study-term extractor for university lectures. ' +
  'Return only valid JSON — no markdown fences, no explanation.'

// ── Enhancement prompt (mirror of generate/flashcards/route.ts) ───────────────
// KEEP IN SYNC with src/app/api/generate/flashcards/route.ts → buildPromptBlock() + system

// KEEP IN SYNC with src/app/api/generate/flashcards/route.ts → buildCardBlock() + system
interface KeywordContext {
  term: string
  zone: 'red' | 'likely'
  kind?: string
  transcriptContext: string
  slideContext: string
}

function buildEnhancementBlock(kw: KeywordContext, index: number): string {
  const lines = [
    `CARD_ID: eval-${index}`,
    `TERM: ${kw.term}`,
    `KIND: ${kw.kind ?? 'definition'}`,
    `PRIORITY: ${kw.zone === 'red' ? 'high — professor emphasized this' : 'moderate'}`,
  ]
  if (kw.transcriptContext) lines.push(`LECTURE: ${kw.transcriptContext}`)
  if (kw.slideContext) lines.push(`SLIDE: ${kw.slideContext}`)
  return lines.join('\n')
}

const ENHANCEMENT_SYSTEM = [
  'You write flashcard back sides for university exam terms.',
  'Rules:',
  '  • 1–2 sentences, ≤25 words total. Lead directly with the definition/answer — do not restate the term.',
  '  • Use only the supplied lecture context. Do not add outside knowledge.',
  '  • No markdown, no bullet points, no slide citations, no hedging phrases ("refers to", "in general").',
  '  • If KIND is "equation": include the one-line formula using $...$  inline LaTeX, then one phrase of meaning.',
  '  • If KIND is "process": name the key steps or end-result in ≤25 words.',
  '  • If KIND is "structure": name the location/composition and primary function in ≤25 words.',
  '  • If KIND is "principle": state the rule and what it predicts or prohibits in ≤25 words.',
  '  • Return valid JSON only — no markdown fences, no explanation.',
].join('\n')

// ── Metrics helpers ───────────────────────────────────────────────────────────

/** Normalize a term for comparison — lowercase, trim, collapse whitespace. */
function norm(t: string): string {
  return t.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * True if `candidate` matches `target`:
 * - exact match after normalization, OR
 * - one is a substring of the other (handles "expected utility" matching "expected utility theorem")
 */
function termMatches(candidate: string, target: string): boolean {
  const c = norm(candidate)
  const t = norm(target)
  return c === t || c.includes(t) || t.includes(c)
}

function recall(extracted: string[], mustHave: string[]): number {
  const hits = mustHave.filter((m) => extracted.some((e) => termMatches(e, m)))
  return hits.length / mustHave.length
}

function noiseCount(extracted: string[], noiseTerms: string[]): number {
  return extracted.filter((e) => noiseTerms.some((n) => termMatches(e, n))).length
}

function jaccard(set1: string[], set2: string[]): number {
  const s1 = new Set(set1.map(norm))
  const s2 = new Set(set2.map(norm))
  let intersection = 0
  for (const t of s1) if (s2.has(t)) intersection++
  const union = s1.size + s2.size - intersection
  return union === 0 ? 1 : intersection / union
}

/** Count sentences in a string by end-of-sentence punctuation. */
function sentenceCount(text: string): number {
  return (text.match(/[.!?]+/g) ?? []).length
}

// ── Extraction run ────────────────────────────────────────────────────────────

async function runExtraction(fixture: Fixture): Promise<{
  run1: string[]
  run2: string[]
  recall1: number
  recall2: number
  noiseCount1: number
  noiseCount2: number
  total1: number
  total2: number
  jaccard12: number
  latency1Ms: number
  latency2Ms: number
}> {
  const slideBlock = fixture.slides
    .filter((s) => s.text.trim())
    .map((s) => `[Slide ${s.pageNumber}] ${s.text.trim()}`)
    .join('\n\n')

  const prompt = buildExtractionPrompt(fixture.guideText, slideBlock, fixture.transcriptText)

  const runOnce = async (): Promise<{ terms: string[]; latencyMs: number }> => {
    const { text, latencyMs } = await callClaude(EXTRACTION_SYSTEM, prompt)
    try {
      const raw = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      const parsed = JSON.parse(raw) as { keywords: { term: string }[] }
      return { terms: (parsed.keywords ?? []).map((k) => k.term), latencyMs }
    } catch {
      console.warn(`  [warn] JSON parse failed — returning empty terms`)
      return { terms: [], latencyMs }
    }
  }

  console.log(`  run 1…`)
  const { terms: run1, latencyMs: l1 } = await runOnce()
  console.log(`  run 2…`)
  const { terms: run2, latencyMs: l2 } = await runOnce()

  return {
    run1,
    run2,
    recall1: recall(run1, fixture.mustHaveTerms),
    recall2: recall(run2, fixture.mustHaveTerms),
    noiseCount1: noiseCount(run1, fixture.noiseTerms),
    noiseCount2: noiseCount(run2, fixture.noiseTerms),
    total1: run1.length,
    total2: run2.length,
    jaccard12: jaccard(run1, run2),
    latency1Ms: l1,
    latency2Ms: l2,
  }
}

// ── Enhancement run (uses extracted terms from the fixture's first run) ────────

async function runEnhancement(
  fixture: Fixture,
  extractedTerms: string[],
): Promise<{
  avgWordCount: number
  shareOverLimit: number
  latencyMs: number
  sampleCount: number
}> {
  // Use up to 15 terms — enough to measure quality without burning tokens
  const sample = extractedTerms.slice(0, 15)
  if (sample.length === 0) {
    return { avgWordCount: 0, shareOverLimit: 0, latencyMs: 0, sampleCount: 0 }
  }

  const keywords: KeywordContext[] = sample.map((term) => {
    // Find a transcript context snippet around the first mention
    const words = fixture.transcriptText.split(/\s+/)
    const idx = words.findIndex((w) => w.toLowerCase().includes(term.toLowerCase().split(' ')[0]!))
    const start = Math.max(0, idx - 15)
    const end = Math.min(words.length, idx + 45)
    const transcriptContext = idx === -1 ? '' : words.slice(start, end).join(' ')

    // First slide that mentions the term
    const slideMatch = fixture.slides.find((s) =>
      s.text.toLowerCase().includes(term.toLowerCase().split(' ')[0]!),
    )
    const slideContext = slideMatch?.text.slice(0, 400) ?? ''

    return { term, zone: 'red' as const, transcriptContext, slideContext }
  })

  const termList = keywords.map((kw, i) => buildEnhancementBlock(kw, i)).join('\n\n')
  const userMsg =
    'Generate flashcard backs. Return exactly:\n' +
    '{ "results": [{ "id": "...", "back": "..." }] }\n\n' +
    'Each "id" must match the CARD_ID supplied for that term.\n\n' +
    termList

  const { text, latencyMs } = await callClaude(ENHANCEMENT_SYSTEM, userMsg)

  let backs: string[] = []
  try {
    const raw = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(raw) as { results: { id: string; back: string }[] }
    backs = (parsed.results ?? []).map((r) => r.back).filter(Boolean)
  } catch {
    console.warn(`  [warn] Enhancement JSON parse failed`)
  }

  if (backs.length === 0) {
    return { avgWordCount: 0, shareOverLimit: 0, latencyMs, sampleCount: sample.length }
  }

  const wordCounts = backs.map((b) => b.split(/\s+/).filter(Boolean).length)
  const avgWordCount = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
  const sentenceCounts = backs.map(sentenceCount)
  // New prompt targets 1–2 sentences; > 2 is over-limit
  const shareOverLimit = sentenceCounts.filter((s) => s > 2).length / backs.length

  return { avgWordCount, shareOverLimit, latencyMs, sampleCount: backs.length }
}

// ── Formatting ────────────────────────────────────────────────────────────────

function pct(n: number): string { return `${(n * 100).toFixed(1)}%` }
function ms(n: number): string { return `${n}ms` }

function printExtractionTable(
  results: Array<{ fixture: string; recall1: number; recall2: number; noiseCount1: number; noiseCount2: number; total1: number; total2: number; jaccard12: number; latency1Ms: number; latency2Ms: number }>,
) {
  console.log('\n── Extraction ──────────────────────────────────────────────────────────────')
  console.log(
    'Fixture'.padEnd(36),
    'Recall1'.padStart(8),
    'Recall2'.padStart(8),
    'Noise1'.padStart(7),
    'Noise2'.padStart(7),
    'Total1'.padStart(7),
    'Total2'.padStart(7),
    'Jaccard'.padStart(8),
    'Lat1'.padStart(7),
    'Lat2'.padStart(7),
  )
  for (const r of results) {
    console.log(
      r.fixture.padEnd(36),
      pct(r.recall1).padStart(8),
      pct(r.recall2).padStart(8),
      String(r.noiseCount1).padStart(7),
      String(r.noiseCount2).padStart(7),
      String(r.total1).padStart(7),
      String(r.total2).padStart(7),
      pct(r.jaccard12).padStart(8),
      ms(r.latency1Ms).padStart(7),
      ms(r.latency2Ms).padStart(7),
    )
  }
}

function printEnhancementTable(
  results: Array<{ fixture: string; avgWordCount: number; shareOverLimit: number; latencyMs: number; sampleCount: number }>,
) {
  console.log('\n── Enhancement (fixture 1 only) ────────────────────────────────────────────')
  console.log(
    'Fixture'.padEnd(36),
    'AvgWords'.padStart(9),
    '>3 Sent'.padStart(8),
    'Sample'.padStart(7),
    'Latency'.padStart(8),
  )
  for (const r of results) {
    console.log(
      r.fixture.padEnd(36),
      r.avgWordCount.toFixed(1).padStart(9),
      pct(r.shareOverLimit).padStart(8),
      String(r.sampleCount).padStart(7),
      ms(r.latencyMs).padStart(8),
    )
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const tagArg = process.argv.find((a) => a.startsWith('--tag='))
  const tag = tagArg ? tagArg.slice(6) : 'baseline'

  console.log(`\n=== Prompt Eval — ${tag} ===`)
  console.log(`Model: claude-haiku-4-5-20251001`)
  console.log(`Date:  ${new Date().toISOString()}`)
  console.log(`Fixtures: ${fixtures.map((f) => f.name).join(', ')}\n`)

  const extractionResults: Array<{
    fixture: string
    run1: string[]
    run2: string[]
    recall1: number
    recall2: number
    noiseCount1: number
    noiseCount2: number
    total1: number
    total2: number
    jaccard12: number
    latency1Ms: number
    latency2Ms: number
  }> = []

  const enhancementResults: Array<{
    fixture: string
    avgWordCount: number
    shareOverLimit: number
    latencyMs: number
    sampleCount: number
  }> = []

  for (const fixture of fixtures) {
    console.log(`[${fixture.name}] extraction…`)
    const ext = await runExtraction(fixture)
    extractionResults.push({ fixture: fixture.name, ...ext })

    // Only run enhancement on first fixture (expected-utility) to keep cost low.
    // Swap to run on all fixtures if needed.
    if (fixture.name === 'expected-utility') {
      console.log(`[${fixture.name}] enhancement (${Math.min(ext.run1.length, 15)} terms)…`)
      const enh = await runEnhancement(fixture, ext.run1)
      enhancementResults.push({ fixture: fixture.name, ...enh })
    }
  }

  printExtractionTable(extractionResults)
  printEnhancementTable(enhancementResults)

  // ── Save results ──────────────────────────────────────────────────────────
  const output = {
    tag,
    model: 'claude-haiku-4-5-20251001',
    timestamp: new Date().toISOString(),
    extraction: extractionResults.map(({ run1, run2, ...metrics }) => ({
      ...metrics,
      // Store first 30 extracted terms from each run for diff inspection
      run1Sample: run1.slice(0, 30),
      run2Sample: run2.slice(0, 30),
    })),
    enhancement: enhancementResults,
  }

  const resultsDir = path.join(__dirname, 'results')
  const outPath = path.join(resultsDir, `${tag}.json`)
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\nResults saved → ${outPath}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
