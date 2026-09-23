import type { Metadata } from 'next'
import Link from 'next/link'
import { PageFade } from '@/components/marketing/page-fade'
import { InteractiveDemo } from '@/components/marketing/interactive-demo'

export const metadata: Metadata = {
  title: 'Nocturne for Pre-Med — AI Exam-Likelihood Scoring for USMLE-Style Coursework',
  description:
    'Nocturne ranks lecture keywords by exam likelihood — built for the dense terminology and USMLE-style recall that defines pre-med coursework. Free, encrypted, runs in your browser.',
  alternates: { canonical: '/for/pre-med' },
}

const WHY = [
  {
    label: 'Dense terminology',
    body: "A single pathophysiology lecture can introduce 80 distinct terms. Nocturne's AI identifies which ones your professor actually emphasized.",
  },
  {
    label: 'USMLE-style recall',
    body: 'USMLE step exams and shelf exams test specific mechanisms and terminology — not synthesis. Knowing which term comes first in Red Zone is the study advantage.',
  },
  {
    label: 'Zero-knowledge encrypted',
    body: "Your lecture audio and slides are AES-GCM encrypted in your browser before upload. Your professor's content never leaves your control.",
  },
]

const TESTIMONIALS = [
  {
    initials: 'MR',
    name: 'Maya R.',
    sub: 'Biochemistry · UC San Diego',
    body: '"Nocturne flagged three terms my professor kept circling back to — all three were on the midterm. I stopped re-reading everything."',
  },
  {
    initials: 'PS',
    name: 'Priya S.',
    sub: 'Pre-Med · UCLA',
    body: '"The fact that my audio never leaves my laptop is what sold me. The exam-likelihood scores are what kept me through finals."',
  },
]

const OTHER_DISCIPLINES = [
  { label: 'For Engineering', href: '/for/engineering', desc: 'Formula-heavy exams' },
  { label: 'For Law', href: '/for/law', desc: 'Case and statute recall' },
]

export default function PreMedPage() {
  return (
    <PageFade>
      <div className="px-6 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div data-reveal="" className="mb-14">
            <p className="text-caption uppercase tracking-[0.1em] text-rose-400 mb-3">
              For Pre-Med
            </p>
            <h1 className="text-heading font-medium text-text-primary mb-4">
              Pre-med lectures are dense. Only a handful of terms actually show up on the exam.
            </h1>
            <p className="text-body text-text-secondary leading-relaxed mb-6">
              USMLE-style coursework tests specific recall — mechanisms, enzyme names, receptor
              subtypes. Your professor signals what matters through dwell time and verbal repetition.
              Nocturne reads those signals and surfaces the{' '}
              <span className="text-rose-400 font-medium">Red Zone</span>: the keywords that cross
              both thresholds.
            </p>
            <Link
              href="/setup"
              data-btn=""
              data-shine=""
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 46,
                padding: '0 26px',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                background: '#6366F1',
                color: '#09090F',
                textDecoration: 'none',
                boxShadow: '0 8px 28px rgba(99,102,241,0.35)',
              }}
            >
              Start for free
            </Link>
          </div>

          {/* Why pre-med */}
          <section data-reveal="" className="mb-14">
            <p className="text-caption uppercase tracking-[0.1em] text-text-tertiary mb-4">
              Why it fits
            </p>
            <div className="flex flex-col gap-3">
              {WHY.map((item) => (
                <div
                  key={item.label}
                  className="p-5 rounded-card border border-border-default bg-bg-elevated"
                >
                  <h2 className="text-subheading font-medium text-text-primary mb-1.5">
                    {item.label}
                  </h2>
                  <p className="text-body-sm text-text-secondary leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

      {/* Live demo — biochem/cellular respiration subject is already in the demo data */}
      <InteractiveDemo />

      <div className="px-6 pb-16 md:pb-24">
        <div className="max-w-3xl mx-auto">

          {/* Testimonials */}
          <section className="mt-14 mb-14">
            <p className="text-caption uppercase tracking-[0.1em] text-text-tertiary mb-4">
              From the beta
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TESTIMONIALS.map((r) => (
                <div
                  key={r.initials}
                  className="flex flex-col gap-3 p-5 rounded-card border border-border-default bg-bg-elevated"
                >
                  <p className="text-indigo-400 text-xs tracking-widest">★★★★★</p>
                  <p className="text-body-sm text-text-primary-soft leading-relaxed flex-1">
                    {r.body}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-caption font-semibold text-indigo-300 shrink-0">
                      {r.initials}
                    </div>
                    <div>
                      <p className="text-body-sm font-medium text-text-primary">{r.name}</p>
                      <p className="text-caption text-text-tertiary">{r.sub}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="pt-8 border-t border-border-subtle mb-14">
            <h2 className="text-subheading font-medium text-text-primary mb-2">
              Walk into the shelf exam knowing what&apos;s on it.
            </h2>
            <p className="text-body-sm text-text-secondary mb-4">
              No credit card. No trial limits. The full AI pipeline, free forever.
            </p>
            <Link
              href="/setup"
              data-btn=""
              data-shine=""
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 46,
                padding: '0 26px',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                background: '#6366F1',
                color: '#09090F',
                textDecoration: 'none',
                boxShadow: '0 8px 28px rgba(99,102,241,0.35)',
              }}
            >
              Start for free
            </Link>
          </section>

          {/* Cross-links */}
          <section>
            <p className="text-caption uppercase tracking-[0.1em] text-text-tertiary mb-4">
              Nocturne for other fields
            </p>
            <div className="flex flex-wrap gap-3">
              {OTHER_DISCIPLINES.map((d) => (
                <Link
                  key={d.href}
                  href={d.href}
                  className="flex flex-col px-4 py-3 rounded-card border border-border-default bg-bg-elevated hover:bg-bg-subtle transition-colors"
                >
                  <span className="text-body-sm font-medium text-text-primary">{d.label}</span>
                  <span className="text-caption text-text-tertiary">{d.desc}</span>
                </Link>
              ))}
            </div>
          </section>

        </div>
      </div>
    </PageFade>
  )
}
