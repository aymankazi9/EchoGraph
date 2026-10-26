// Server component — renders JSON-LD <script> tags for the homepage.
// Three schemas: SoftwareApplication, Organization, FAQPage.
// Feature list and FAQ answers are kept in sync with product-facts.md and
// faq-section.tsx respectively. Update all three if the product changes.

const BASE_URL = 'https://appnocturne.com'

// ── SoftwareApplication ───────────────────────────────────────────────────────

const softwareApplication = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Nocturne',
  url: BASE_URL,
  applicationCategory: 'EducationApplication',
  applicationSubCategory: 'Study Tool',
  operatingSystem: 'Web',
  browserRequirements: 'Requires a modern browser with WebAssembly support',
  description:
    'Nocturne analyzes lecture slides, recordings, and study guides with AI to surface the Red Zone — terms your professor emphasized most, ranked by exam likelihood. Zero-knowledge encrypted.',
  featureList: [
    'Red Zone and Likely Zone scoring from audio dwell time and keyword emphasis',
    'PDF slide upload and viewer',
    'Audio upload with in-browser FFmpeg transcoding',
    'Live lecture recording (Midnight+)',
    'Handwritten notes OCR via Claude AI',
    'Anki .apkg import and export',
    'Spaced repetition with SM-2 algorithm (Again / Hard / Good / Easy ratings)',
    'Exam Urgency Mode with live countdown (Midnight+)',
    'AI-generated flashcards and flashcard enhancement',
    'AI-generated study notes with WYSIWYG editor (Midnight+)',
    'AI fact-check for notes (Midnight+)',
    'AI quiz with multiple-choice questions and lecture-grounded distractors (Eclipse)',
    'Per-session, per-course, and vault-wide AI Ask (Eclipse)',
    'YouTube Red Zone caption search (Beta)',
    'Study streak tracking and milestone badges (Midnight+)',
    'Course mastery and weak-spot detection (Midnight+)',
    'Community rooms with anonymized keyword pool (Midnight+)',
    'Zero-knowledge AES-256-GCM encryption; PBKDF2-SHA-256 key derivation',
    'Recovery kit for vault access without passphrase',
    '500 MB encrypted storage on free tier',
  ],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description:
      'Free tier (Dusk) — full core pipeline: Red Zone scoring, AI flashcards, spaced repetition, Anki import/export, 500 MB encrypted storage. No credit card required.',
    availability: 'https://schema.org/InStock',
  },
  screenshot: `${BASE_URL}/og.png`,
  softwareVersion: '0.1.0-beta',
  releaseNotes: `${BASE_URL}/changelog`,
}

// ── Organization ─────────────────────────────────────────────────────────────

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Nocturne',
  url: BASE_URL,
  logo: `${BASE_URL}/icons/icon-512.png`,
  description:
    'Nocturne builds AI-powered study tools that predict what matters most on your next exam — zero-knowledge encrypted by design.',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'hello@nocturne.app',
    contactType: 'customer support',
  },
  sameAs: [],
}

// ── FAQPage ───────────────────────────────────────────────────────────────────
// Keep in sync with src/components/landing/faq-section.tsx FAQ_ITEMS.

const faqPage = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Do I need a study guide to start?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Nocturne generates a Synthetic Study Guide from your slide text alone, so Likely Zone keywords appear before you upload anything else.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does my audio leave my computer?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'On the Free tier, never. Whisper runs as a WASM Web Worker directly in your browser — no audio is uploaded. Server-side ASR is opt-in on paid tiers.',
      },
    },
    {
      '@type': 'Question',
      name: 'What exactly is the Red Zone?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The handful of keywords your professor most emphasized — measured by slide dwell time and verbal repetition, then cross-referenced against your study guide and ranked by exam likelihood.',
      },
    },
    {
      '@type': 'Question',
      name: 'How is my data encrypted?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Your passphrase derives a key that wraps a non-extractable Master Key via PBKDF2-SHA-256 (310,000 iterations). Files are AES-GCM 256 encrypted in-browser before upload. The server only ever stores opaque blobs.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is the free tier actually usable?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'It is the full core product: transcription, Red Zone scoring, heatmaps, AI flashcards, spaced repetition, and Anki export — with 500 MB of encrypted storage. No trial limits.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I bring my existing Anki deck?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Import any .apkg and your card fronts seed the study guide automatically. Export Red Zone cards back out as a valid, tagged .apkg.',
      },
    },
  ],
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StructuredData() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplication) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />
    </>
  )
}
