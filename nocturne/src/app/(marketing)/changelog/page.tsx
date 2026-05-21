import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { PageFade } from '@/components/marketing/page-fade'

export const metadata: Metadata = {
  title: 'Changelog — Nocturne',
  description: 'What\'s new in Nocturne.',
}

const entries = [
  {
    date: 'May 2026',
    version: 'v0.1.0-beta',
    label: 'Private beta launch',
    items: [
      'Zero-knowledge vault setup with Google OAuth',
      'PDF viewer with slide text extraction via PDF.js',
      'Browser-based audio transcription (Whisper-base, WebAssembly)',
      'Synthetic Study Guide — Likely Zone scoring when no guide is uploaded',
      'Real Red Zone scoring with uploaded study guide',
      'Slide density heatmap overlay',
      'Bidirectional synchronized playback — transcript ↔ slides ↔ audio',
      'Anki .apkg import (card fronts seed Study Guide automatically)',
      'Anki .apkg export (Red Zone flashcards, tagged and spaced-rep compatible)',
      'Red Zone flashcard generation',
      'Recovery Kit generation and forced download at signup',
      '500 MB encrypted storage, 3 sessions/month on free tier',
      'PWA support — installable on any device',
      'Local-first write-ahead buffer (IndexedDB) for resumable uploads',
    ],
  },
]

export default function ChangelogPage() {
  return (
    <PageFade>
    <div className="px-6 py-16 md:py-24">
      <div className="max-w-2xl mx-auto">
        <div className="mb-12">
          <p className="text-caption uppercase tracking-[0.07em] text-indigo-400 mb-3">
            Changelog
          </p>
          <h1 className="text-heading font-medium text-text-primary mb-3">
            What&apos;s new
          </h1>
          <p className="text-body text-text-secondary">
            Every significant change, in reverse chronological order.
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {entries.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-body-sm font-medium text-text-primary">{entry.version}</span>
                <span className="text-caption uppercase tracking-[0.07em] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {entry.label}
                </span>
                <span className="text-caption text-text-tertiary ml-auto">{entry.date}</span>
              </div>
              <div className="pl-4 border-l border-border-default">
                <ul className="flex flex-col gap-2.5">
                  {entry.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check size={13} strokeWidth={2} className="text-indigo-400 mt-0.5 shrink-0" />
                      <span className="text-body-sm text-text-secondary">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </PageFade>
  )
}
