'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    q: 'Is the free tier really free, forever?',
    a: 'Yes. The complete core pipeline — upload, transcribe, sync, score, flashcards — is permanently free. We do not paywall basics. Paid tiers add better ASR accuracy and more storage, not access to features that should be free.',
  },
  {
    q: 'What does zero-knowledge encryption mean for me?',
    a: 'Your files are encrypted in your browser before they ever leave your device. EchoGraph servers store only opaque encrypted blobs — we cannot read your lecture audio, slides, or transcripts even if we wanted to. Your vault passphrase never touches our servers.',
  },
  {
    q: 'What is the difference between Red Zone and Likely Zone?',
    a: 'Red Zone (red) is derived from your uploaded Study Guide — it reflects what your professor emphasized relative to what you actually need to know. Likely Zone (purple) is EchoGraph\'s synthetic estimate when no study guide is provided. It\'s useful, but it\'s inferred, not professor-verified.',
  },
  {
    q: 'Can I change my vault passphrase?',
    a: 'Not yet — passphrase change is on the roadmap for v1. Because the Master Key is derived from your passphrase, changing it requires re-wrapping the key. We\'ll add this before the paid tiers launch.',
  },
  {
    q: 'What happens if I forget my vault passphrase?',
    a: 'You can use your Recovery Kit — a file generated at signup that contains a backup of your Master Key. If you lose both your passphrase and your Recovery Kit, your data is permanently unrecoverable. We cannot reset your vault. This is a feature, not a bug.',
  },
  {
    q: 'When will Scholar and Pro tiers launch?',
    a: 'We\'re in private beta. Scholar and Pro are coming after the core free experience is stable. Join with a free account and you\'ll be first to hear when paid tiers open.',
  },
  {
    q: 'Does EchoGraph send my audio to any AI service?',
    a: 'No — not by default. Browser transcription (Whisper) runs entirely in your browser, including on the free tier. Scholar tier adds optional server-side ASR with explicit per-session consent. Pro tier adds optional GPT-4 summarization, also consent-gated. Nothing leaves your device without an explicit opt-in.',
  },
]

export function PricingFaq() {
  return (
    <section className="mt-16 pt-12 border-t border-border-subtle">
      <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-3">
        FAQ
      </p>
      <h2 className="text-heading font-medium text-text-primary mb-8">
        Common questions
      </h2>
      <Accordion type="multiple" className="max-w-2xl">
        {faqs.map((item, i) => (
          <AccordionItem key={i} value={`q${i}`}>
            <AccordionTrigger className="text-body text-text-primary hover:no-underline hover:text-text-primary">
              {item.q}
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-body-sm text-text-secondary leading-relaxed">{item.a}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
