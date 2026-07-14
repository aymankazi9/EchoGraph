export type Zone = 'red' | 'likely' | 'none'

export type ZoneEntry = { z: Zone; c: number }

export type Keyword = {
  name: string
  // per mode: [Slides only, +Recording, Full session]
  m: [ZoneEntry, ZoneEntry, ZoneEntry]
}

export type Token =
  | { t: string }   // plain text
  | { k: string }   // keyword (styled based on current zone)

export type Subject = {
  code: string
  topic: string
  time: string
  KW: Keyword[]
  src: Token[]
}

export const ZONE_COLORS = {
  red: {
    text: '#FB7185',
    bar: '#F43F5E',
    rgb: '244,63,94',
    label: 'Red Zone',
  },
  likely: {
    text: '#A78BFA',
    bar: '#8B5CF6',
    rgb: '139,92,246',
    label: 'Likely Zone',
  },
} as const

export const SUBJECTS: Subject[] = [
  {
    code: 'BIOL 201',
    topic: 'Cellular Respiration',
    time: '00:42:18',
    KW: [
      { name: 'electron transport chain',        m: [{ z: 'likely', c: 52 }, { z: 'likely', c: 69 }, { z: 'red', c: 94 }] },
      { name: 'net ATP yield',                   m: [{ z: 'likely', c: 46 }, { z: 'likely', c: 60 }, { z: 'red', c: 83 }] },
      { name: 'substrate-level phosphorylation', m: [{ z: 'none',   c: 0  }, { z: 'likely', c: 61 }, { z: 'red', c: 88 }] },
      { name: 'glycolysis',                      m: [{ z: 'likely', c: 50 }, { z: 'likely', c: 64 }, { z: 'likely', c: 72 }] },
      { name: 'pyruvate',                        m: [{ z: 'none',   c: 0  }, { z: 'none',   c: 0  }, { z: 'likely', c: 60 }] },
    ],
    src: [
      { t: '“This is absolutely fair game for the midterm. The ' },
      { k: 'electron transport chain' },
      { t: ' is where most of your ' },
      { k: 'net ATP yield' },
      { t: ' actually comes from — not ' },
      { k: 'glycolysis' },
      { t: '. Know ' },
      { k: 'substrate-level phosphorylation' },
      { t: ' cold, and remember ' },
      { k: 'pyruvate' },
      { t: ' is the hand-off into the Krebs cycle.”' },
    ],
  },
  {
    code: 'ORGO 250',
    topic: 'Reaction Mechanisms',
    time: '00:28:54',
    KW: [
      { name: 'SN2 mechanism',         m: [{ z: 'likely', c: 55 }, { z: 'likely', c: 71 }, { z: 'red', c: 93 }] },
      { name: 'carbocation stability', m: [{ z: 'likely', c: 47 }, { z: 'likely', c: 62 }, { z: 'red', c: 86 }] },
      { name: 'Markovnikov addition',  m: [{ z: 'none',   c: 0  }, { z: 'likely', c: 58 }, { z: 'red', c: 80 }] },
      { name: 'stereochemistry',       m: [{ z: 'likely', c: 51 }, { z: 'likely', c: 65 }, { z: 'likely', c: 73 }] },
      { name: 'leaving group',         m: [{ z: 'none',   c: 0  }, { z: 'none',   c: 0  }, { z: 'likely', c: 57 }] },
    ],
    src: [
      { t: '“This shows up on every exam, I promise you. The ' },
      { k: 'SN2 mechanism' },
      { t: ' is backside attack with a good ' },
      { k: 'leaving group' },
      { t: ' — don’t confuse it with ' },
      { k: 'carbocation stability' },
      { t: ', which is what drives ' },
      { k: 'Markovnikov addition' },
      { t: '. And watch your ' },
      { k: 'stereochemistry' },
      { t: ' on the inversion.”' },
    ],
  },
  {
    code: 'PSYC 240',
    topic: 'Memory & Cognition',
    time: '00:35:07',
    KW: [
      { name: 'long-term potentiation', m: [{ z: 'likely', c: 53 }, { z: 'likely', c: 68 }, { z: 'red', c: 91 }] },
      { name: 'working memory',         m: [{ z: 'likely', c: 49 }, { z: 'likely', c: 63 }, { z: 'red', c: 84 }] },
      { name: 'the hippocampus',        m: [{ z: 'none',   c: 0  }, { z: 'likely', c: 59 }, { z: 'red', c: 79 }] },
      { name: 'encoding specificity',   m: [{ z: 'likely', c: 50 }, { z: 'likely', c: 64 }, { z: 'likely', c: 72 }] },
      { name: 'retrieval cues',         m: [{ z: 'none',   c: 0  }, { z: 'none',   c: 0  }, { z: 'likely', c: 58 }] },
    ],
    src: [
      { t: '“Guaranteed exam question here. The cellular basis of learning is ' },
      { k: 'long-term potentiation' },
      { t: ', and it lives in ' },
      { k: 'the hippocampus' },
      { t: '. Don’t confuse ' },
      { k: 'working memory' },
      { t: ' with storage — and remember ' },
      { k: 'encoding specificity' },
      { t: ': ' },
      { k: 'retrieval cues' },
      { t: ' only work if they match.”' },
    ],
  },
]

export const MODE_LABELS = ['Slides only', '+ Recording', 'Full session'] as const
export const MODE_CAPTIONS = [
  'Synthetic guess from your slide text — no recording analyzed yet.',
  'Emphasis measured from your lecture audio: dwell time + verbal repetition.',
  'Cross-referenced against your study guide. These are exam-critical.',
] as const
