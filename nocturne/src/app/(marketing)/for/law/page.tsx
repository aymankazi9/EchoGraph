import type { Metadata } from 'next'
import Link from 'next/link'
import { PageFade } from '@/components/marketing/page-fade'

export const metadata: Metadata = {
  title: 'Nocturne for Law — AI Ranking of Case Names, Statutes, and Holdings for Law School Exams',
  description:
    'Law school exams test the cases your professor kept returning to. Nocturne measures verbal repetition and slide dwell time to surface the holdings and statutes that will show up.',
  alternates: { canonical: '/for/law' },
}

const WHY = [
  {
    label: 'Thin slides, dense discussion',
    body: "Law school slides are often just case names and headings. The substance lives in the verbal discussion — and that's exactly where Nocturne focuses.",
  },
  {
    label: 'Verbal repetition is the exam signal',
    body: "When a professor comes back to Hadley v. Baxendale three times in one class, that's a signal. Nocturne quantifies repetition into an exam-likelihood score.",
  },
  {
    label: 'Works with your casebook outline',
    body: 'Upload your case briefs or course outline as the study guide. Nocturne cross-references it against lecture emphasis to confirm which cases crossed both thresholds.',
  },
]

/* Static keyword snippet — LAW 210 Contracts: Damages */
const KEYWORDS = [
  { rank: 1, term: 'Hadley v Baxendale', score: 96, zone: 'red' as const, mentions: 8, slides: 3 },
  { rank: 2, term: 'consequential damages', score: 91, zone: 'red' as const, mentions: 10, slides: 4 },
  { rank: 3, term: 'foreseeability rule', score: 88, zone: 'red' as const, mentions: 9, slides: 4 },
  { rank: 4, term: 'expectation damages', score: 83, zone: 'red' as const, mentions: 7, slides: 3 },
  { rank: 5, term: 'UCC § 2-715', score: 74, zone: 'amber' as const, mentions: 5, slides: 2 },
  { rank: 6, term: 'avoidable consequences', score: 66, zone: 'amber' as const, mentions: 4, slides: 2 },
  { rank: 7, term: 'reliance damages', score: 57, zone: 'amber' as const, mentions: 3, slides: 1 },
]

const ZONE = {
  red: { bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.25)', text: '#FB7185', dot: '#F43F5E' },
  amber: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', text: '#FCD34D', dot: '#FBBF24' },
}

const OTHER_DISCIPLINES = [
  { label: 'For Pre-Med', href: '/for/pre-med', desc: 'Dense terminology & USMLE recall' },
  { label: 'For Engineering', href: '/for/engineering', desc: 'Formula-heavy exams' },
]

export default function LawPage() {
  return (
    <PageFade>
      <div className="px-6 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div data-reveal="" className="mb-14">
            <p className="text-caption uppercase tracking-[0.1em] text-indigo-400 mb-3">
              For Law
            </p>
            <h1 className="text-heading font-medium text-text-primary mb-4">
              Law school slides are thin. The signal is in what your professor keeps saying.
            </h1>
            <p className="text-body text-text-secondary leading-relaxed mb-6">
              Contracts, torts, crim law — your professor knows which cases and statutes the bar
              examiners love. They signal it through verbal repetition during Socratic discussions
              where the slides don&apos;t change for twenty minutes. Nocturne reads that signal and
              surfaces the{' '}
              <span className="text-rose-400 font-medium">Red Zone</span>: the holdings and rules
              ranked by how hard your professor pushed them.
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

          {/* Why law */}
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

          {/* Static keyword snippet */}
          <section className="mb-14">
            <p className="text-caption uppercase tracking-[0.1em] text-text-tertiary mb-4">
              Example — LAW 210: Contracts · Lecture 11 — Damages
            </p>
            <div className="rounded-card border border-border-default bg-bg-elevated overflow-hidden">
              {/* Header bar */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-card bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-body-sm font-semibold text-indigo-400">
                    L
                  </div>
                  <div>
                    <p className="text-body-sm font-medium text-text-primary">LAW 210</p>
                    <p className="text-caption text-text-tertiary">Contracts · Lecture 11 — Damages</p>
                  </div>
                </div>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 9999,
                    background: 'rgba(244,63,94,0.1)',
                    border: '1px solid rgba(244,63,94,0.2)',
                    fontSize: 11,
                    color: '#FB7185',
                    fontWeight: 500,
                  }}
                >
                  Red Zone: 4 terms
                </span>
              </div>

              {/* Keyword rows */}
              <div>
                {KEYWORDS.map((kw) => {
                  const c = ZONE[kw.zone]
                  return (
                    <div
                      key={kw.term}
                      className="flex items-center gap-3.5 px-5 py-2.5 border-b border-border-subtle last:border-0"
                    >
                      <span className="text-caption text-text-tertiary w-4 text-center shrink-0">
                        {kw.rank}
                      </span>
                      <span
                        style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0, boxShadow: `0 0 6px ${c.dot}` }}
                      />
                      <span className="flex-1 text-body-sm font-medium text-text-primary-soft">
                        {kw.term}
                      </span>
                      <div className="flex gap-4 items-center">
                        <span className="text-caption text-text-tertiary">{kw.mentions}× verbal</span>
                        <span className="text-caption text-text-tertiary">{kw.slides} slides</span>
                        <span
                          style={{
                            padding: '2px 9px',
                            borderRadius: 9999,
                            background: c.bg,
                            border: `1px solid ${c.border}`,
                            fontSize: 11,
                            color: c.text,
                            fontWeight: 600,
                            minWidth: 36,
                            textAlign: 'center',
                          }}
                        >
                          {kw.score}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="px-5 py-3 border-t border-border-subtle">
                <p className="text-caption text-text-tertiary">
                  Score = weighted composite of verbal mentions, slide dwell time, and outline alignment
                </p>
              </div>
            </div>
          </section>

          {/* CTA — no testimonial yet */}
          <section className="pt-8 border-t border-border-subtle mb-14">
            <h2 className="text-subheading font-medium text-text-primary mb-2">
              Know which cases your professor will put on the final.
            </h2>
            <p className="text-body-sm text-text-secondary mb-4">
              No fabricated quotes. No guessing. Just the exam-likelihood scores your
              professor&apos;s own emphasis generated. Free forever.
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
