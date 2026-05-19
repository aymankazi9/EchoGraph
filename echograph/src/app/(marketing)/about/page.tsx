import type { Metadata } from 'next'
import Link from 'next/link'
import { Zap, Shield, BookOpen, Mail } from 'lucide-react'
import { PageFade } from '@/components/marketing/page-fade'

export const metadata: Metadata = {
  title: 'About — EchoGraph',
  description: 'Why we built EchoGraph — a study intelligence system for students in high-stakes fields.',
}

const features = [
  {
    icon: Zap,
    title: 'Red Zone Analysis',
    description:
      'EchoGraph scores every lecture moment against your study guide and what your professor actually dwelled on. The result: a ranked list of what matters most, not a summary of everything.',
  },
  {
    icon: Shield,
    title: 'Zero-Knowledge Encrypted',
    description:
      'Your lecture audio, slides, and transcripts are encrypted in your browser before they touch any server. We store opaque blobs. Your passphrase never leaves your device.',
  },
  {
    icon: BookOpen,
    title: 'Study Guide Integration',
    description:
      'Upload your study guide or import an Anki deck. EchoGraph uses it to calibrate emphasis scoring — your notes shape the analysis, not a generic model trained on someone else\'s curriculum.',
  },
]

export default function AboutPage() {
  return (
    <PageFade>
    <div className="px-6 py-16 md:py-24">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-14">
          <p className="text-caption uppercase tracking-[0.07em] text-teal-300 mb-3">
            About
          </p>
          <h1 className="text-heading font-medium text-text-primary mb-4">
            Built for students with too much to learn and not enough time
          </h1>
          <p className="text-body text-text-secondary leading-relaxed">
            EchoGraph started with a simple observation: generic AI study tools summarize content.
            They tell you what was said. They don&apos;t tell you what mattered.
          </p>
        </div>

        {/* Problem section */}
        <section className="mb-14 p-6 rounded-card border border-border-default bg-bg-elevated">
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-4">
            The problem
          </p>
          <div className="flex flex-col gap-4">
            <p className="text-body text-text-secondary leading-relaxed">
              In pre-med, engineering, and law programs, the gap between what a professor covers
              and what actually appears on the exam is everything. A three-hour pathophysiology
              lecture has 60 slides. A professor spends 40 minutes on one mechanism and 2 minutes
              on another. Generic AI treats both the same.
            </p>
            <p className="text-body text-text-secondary leading-relaxed">
              Study guides tell you what you need to know. Lecture recordings tell you what
              your professor emphasized. EchoGraph connects those two signals — and ranks everything
              by what crosses both thresholds.
            </p>
            <p className="text-body-sm font-medium text-text-primary">
              That&apos;s the Red Zone.
            </p>
          </div>
        </section>

        {/* Feature highlights */}
        <section className="mb-14">
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-6">
            How it works
          </p>
          <div className="flex flex-col gap-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4 p-5 rounded-card border border-border-default bg-bg-elevated">
                <div className="p-2 rounded-btn bg-bg-subtle shrink-0 h-fit">
                  <Icon size={18} strokeWidth={1.5} className="text-teal-300" />
                </div>
                <div>
                  <h2 className="text-subheading font-medium text-text-primary mb-1.5">{title}</h2>
                  <p className="text-body-sm text-text-secondary leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Positioning */}
        <section className="mb-14 p-6 rounded-card border border-border-default bg-bg-elevated">
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-4">
            Who it&apos;s for
          </p>
          <p className="text-body text-text-secondary leading-relaxed mb-3">
            EchoGraph is not for the student who wants to paste a YouTube link and get flashcards
            in 30 seconds. It&apos;s for the student whose lecture content is too dense, too technical,
            and too high-stakes for a generic AI summary to matter.
          </p>
          <p className="text-body-sm font-medium text-text-primary">
            Pre-med. Engineering. Law. Graduate STEM.
          </p>
        </section>

        {/* Contact */}
        <section className="pt-8 border-t border-border-subtle">
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-3">
            Get in touch
          </p>
          <h2 className="text-subheading font-medium text-text-primary mb-3">
            Questions or feedback?
          </h2>
          <p className="text-body-sm text-text-secondary mb-4">
            We&apos;re in beta and actively shaping the product. If you have thoughts, reach out.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:hello@echograph.app"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors"
            >
              <Mail size={14} strokeWidth={1.5} />
              hello@echograph.app
            </a>
            <Link
              href="/login"
              className="inline-flex h-9 px-4 items-center rounded-btn text-body font-medium bg-teal-300 text-text-inverse hover:bg-teal-400 transition-colors"
            >
              Start for free
            </Link>
          </div>
        </section>
      </div>
    </div>
    </PageFade>
  )
}
