'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface QA { q: string; a: string }

interface Section {
  heading: string
  items: QA[]
}

const sections: Section[] = [
  {
    heading: 'Getting started',
    items: [
      {
        q: 'How do I create my first session?',
        a: 'After setting up your vault, go to your vault dashboard and click "New session". You\'ll be prompted to upload files — a PDF of your slides, your lecture audio, and optionally a study guide. You can upload any combination and add more files later.',
      },
      {
        q: 'What file types can I upload?',
        a: 'PDF files for lecture slides, MP3/WAV/M4A files for audio recordings, and PDF or plain text for study guides. Audio is transcoded to Opus 64kbps in your browser before encryption, which dramatically reduces file size.',
      },
      {
        q: 'Do I need to upload all three files at once?',
        a: 'No. EchoGraph works with whatever you have. Slides only gives you the PDF viewer and Synthetic Study Guide. Audio only gives you transcription and Likely Zone scoring. The more inputs you provide, the more features unlock — but you\'re never blocked from starting.',
      },
    ],
  },
  {
    heading: 'Encryption & security',
    items: [
      {
        q: 'What is the vault passphrase?',
        a: 'Your vault passphrase is separate from your Google login. It\'s used to derive an encryption key in your browser via PBKDF2. This key unlocks your Master Key, which encrypts all your files. The passphrase never leaves your device.',
      },
      {
        q: 'What if I forget my vault passphrase?',
        a: 'Use your Recovery Kit — a file you downloaded at signup. It contains a backup of your Master Key. If you lose both your passphrase and your Recovery Kit, your data is permanently unrecoverable. There is no password reset by design.',
      },
      {
        q: 'Where is my data stored?',
        a: 'Encrypted file blobs are stored in Supabase Storage. EchoGraph servers see only opaque encrypted data — they cannot decrypt it. Your passphrase and Master Key exist only in your browser memory while your vault is open.',
      },
    ],
  },
  {
    heading: 'Features',
    items: [
      {
        q: 'What is the Red Zone?',
        a: 'Red Zone (shown in red) marks content that appears in your study guide AND was emphasized in your lecture — measured by how long your professor dwelled on each slide and how often they repeated key terms. It\'s the intersection of "you need to know this" and "your professor stressed this".',
      },
      {
        q: 'What is the Likely Zone?',
        a: 'Likely Zone (shown in purple) is EchoGraph\'s synthetic estimate when you haven\'t uploaded a study guide. It uses TF-IDF and professor dwell time to infer what\'s likely important. It upgrades automatically to Red Zone when you add a real study guide.',
      },
      {
        q: 'How does the Anki import work?',
        a: 'EchoGraph parses the SQLite database inside an .apkg file and extracts card fronts as your keyword list. This seeds the Study Guide automatically — all Red Zone scoring and heatmaps activate immediately based on your existing Anki deck.',
      },
      {
        q: 'How accurate is browser transcription?',
        a: 'EchoGraph uses Whisper-base running in WebAssembly in your browser. It handles STEM vocabulary reasonably well but can struggle with dense notation, equations spoken aloud, or heavy accents. Scholar tier adds VibeVoice-ASR (9B param) with hotword injection from your study guide for significantly higher accuracy.',
      },
    ],
  },
  {
    heading: 'Troubleshooting',
    items: [
      {
        q: 'Transcription is very slow — is that normal?',
        a: 'Yes, on the first session. Whisper runs locally in your browser as a WebAssembly model (~140 MB download). After the first download it\'s cached and subsequent sessions are faster. A 60-minute lecture typically takes 5–15 minutes to transcribe in the browser, depending on your hardware.',
      },
      {
        q: 'My upload failed partway through — do I need to start over?',
        a: 'No. EchoGraph uses a local write-ahead buffer (IndexedDB) so partial uploads can resume. If your upload fails, reopen the session and the upload panel will show the failed files — you can retry without re-selecting them.',
      },
      {
        q: 'The PDF viewer shows blank slides — why?',
        a: 'PDF.js needs the file to be decrypted first. Make sure your vault is unlocked (you\'ve entered your passphrase). If slides are still blank, the PDF may use fonts or rendering features that PDF.js doesn\'t support — try exporting a flattened PDF from your slide software.',
      },
    ],
  },
]

export function HelpAccordion() {
  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <div key={section.heading}>
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-3">
            {section.heading}
          </p>
          <Accordion type="multiple">
            {section.items.map((item, i) => (
              <AccordionItem key={i} value={`${section.heading}-${i}`}>
                <AccordionTrigger className="text-body text-text-primary hover:no-underline hover:text-text-primary text-left">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-body-sm text-text-secondary leading-relaxed">{item.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  )
}
