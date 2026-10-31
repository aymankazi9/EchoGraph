// Sample content ported from the Nocturne Landing v2 reference (design_handoff_nocturne) —
// per reading-the-references.md, the data arrays in a .dc.html script are real sample content
// meant to be reused as fixtures, not placeholder lorem ipsum.

export type Zone = 'RED' | 'LIKELY'

export const SUBJECTS = [
  {
    code: 'BIOL 201',
    topic: 'Cellular Respiration',
    dir: 'BIOL201/L14',
    terms: 412,
    time: '1m 36s',
    refs: 'L09 21:40 · L12 08:12 · L14 11:42',
    kw: [
      ['electron transport chain', '0.94', 'RED'],
      ['substrate-level phosphorylation', '0.88', 'RED'],
      ['net ATP yield', '0.83', 'RED'],
      ['glycolysis', '0.72', 'LIKELY'],
      ['pyruvate', '0.60', 'LIKELY'],
    ] as [string, string, Zone][],
    nodes: ['electron transport chain', 'net ATP yield', 'substrate-level phosph.', 'glycolysis', 'pyruvate', 'Krebs cycle', 'NADH'],
  },
  {
    code: 'CHEM 241',
    topic: 'Nucleophilic Substitution',
    dir: 'CHEM241/L08',
    terms: 367,
    time: '1m 22s',
    refs: 'L06 14:05 · L07 22:48 · L08 31:12',
    kw: [
      ['SN2 backside attack', '0.96', 'RED'],
      ['carbocation stability', '0.89', 'RED'],
      ['leaving group ability', '0.81', 'RED'],
      ['polar aprotic solvents', '0.69', 'LIKELY'],
      ['Walden inversion', '0.58', 'LIKELY'],
    ] as [string, string, Zone][],
    nodes: ['SN2 backside attack', 'leaving group ability', 'carbocation stability', 'SN1 mechanism', 'Walden inversion', 'polar aprotic solvents', 'nucleophile strength'],
  },
  {
    code: 'ECON 102',
    topic: 'Monetary Policy',
    dir: 'ECON102/L11',
    terms: 298,
    time: '1m 51s',
    refs: 'L07 18:22 · L10 09:47 · L11 26:03',
    kw: [
      ['money multiplier', '0.93', 'RED'],
      ['open market operations', '0.87', 'RED'],
      ['federal funds rate', '0.80', 'RED'],
      ['quantity theory of money', '0.66', 'LIKELY'],
      ['velocity of money', '0.55', 'LIKELY'],
    ] as [string, string, Zone][],
    nodes: ['money multiplier', 'federal funds rate', 'open market ops', 'reserve ratio', 'quantity theory', 'velocity of money', 'inflation target'],
  },
]

// Shared node layout (percent positions) for the mini concept-graph — hero Path B swaps in
// subject-specific labels/confidences; the demo carousel's Map step uses the literal labels.
export const GRAPH_LAYOUT = [
  { x: 52, y: 46, focus: true },
  { x: 80, y: 22, red: true },
  { x: 24, y: 20, red: true },
  { x: 16, y: 68 },
  { x: 38, y: 84 },
  { x: 72, y: 78 },
  { x: 88, y: 52 },
]

export const GRAPH_EDGES: [number, number][] = [[0, 1], [0, 2], [0, 6], [0, 5], [0, 4], [3, 4], [4, 5], [2, 3], [5, 6]]

export const DEMO_NODE_LABELS = ['electron transport chain', 'net ATP yield', 'substrate-level phosph.', 'glycolysis', 'pyruvate', 'Krebs cycle', 'NADH']
export const DEMO_NODE_CONFIDENCE: Record<number, string> = { 0: '0.94', 1: '0.83', 2: '0.88' }

export const DEMO_LINES = [
  { ts: '00.000', src: 'boot', msg: 'nocturne-core 0.9.2 · wasm32 · 8 threads' },
  { ts: '00.214', src: 'whisper', msg: 'model base.en loaded from disk (142 MB)' },
  { ts: '00.231', src: 'net', msg: 'network disabled · 0 bytes out' },
  { ts: '01.870', src: 'asr', msg: 'transcribing lecture-14.m4a · 48:12' },
  { ts: '94.402', src: 'asr', msg: '8,412 words · word-level timestamps' },
  { ts: '95.118', src: 'align', msg: '38 slides ↔ audio · silence-gap sync' },
  { ts: '95.640', src: 'align', msg: 'slide 07 dwell 4m 51s · peak emphasis' },
  { ts: '96.020', src: 'score', msg: 'electron transport chain', val: '0.94', red: true },
  { ts: '96.041', src: 'score', msg: 'substrate-level phosphorylation', val: '0.88', red: true },
  { ts: '96.057', src: 'score', msg: 'net ATP yield', val: '0.83', red: true },
  { ts: '96.070', src: 'score', msg: 'glycolysis', val: '0.72', red: false },
  { ts: '96.082', src: 'score', msg: 'pyruvate', val: '0.60', red: false },
  { ts: '96.300', src: 'done', msg: 'red_zone.json written · 3 RED · 2 LIKELY' },
]

export const XREF_ROWS: [string, string, string, string][] = [
  ['electron transport chain', 'intro', '—', 'peak'],
  ['net ATP yield', '—', 'mention', 'peak'],
  ['substrate-level phosph.', 'intro', 'mention', 'peak'],
  ['glycolysis', 'peak', 'mention', '—'],
  ['Krebs cycle', '—', 'intro', 'mention'],
]

export const KEY_CHAIN: [string, string][] = [
  ['PASSPHRASE', 'your memory only'],
  ['↓ PBKDF2-SHA256', '310,000 iterations'],
  ['KEK', 'memory only · discarded'],
  ['↓ AES-KW', 'unwrap'],
  ['MASTER KEY', 'non-extractable'],
  ['↓ AES-GCM 256', 'unique IV per file'],
  ['STORED', 'opaque encrypted blob'],
]

export const COMPARE_ROWS: [string, string, string, string][] = [
  ['Where audio is processed', 'Cloud', 'Cloud', 'On-device'],
  ['Works fully offline', '[ ]', '[ ]', '[✓]'],
  ['Transcribes lecture audio', '[✓]', '[✓]', '[✓]'],
  ['Measures professor emphasis', '[ ]', '[ ]', '[✓]'],
  ['Ranks terms by exam likelihood', '[ ]', '[ ]', '[✓]'],
  ['Links concepts across lectures', '[ ]', '[~]', '[✓]'],
  ['Infinite concept canvas', '[ ]', '[ ]', '[✓]'],
  ['Zero-knowledge encryption', '[ ]', '[ ]', 'AES-GCM 256'],
  ['Exports tagged Anki .apkg', '[ ]', '[ ]', '[✓]'],
]
