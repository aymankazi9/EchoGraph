import type { Metadata } from 'next'
import Link from 'next/link'
import { PageFade } from '@/components/marketing/page-fade'

export const metadata: Metadata = {
  title: 'Nocturne for Engineering — AI Keyword Ranking for Formula-Heavy Exams',
  description:
    'Nocturne identifies which formulas, constants, and derivations your professor emphasized most — so you know what to drill before the circuits or thermodynamics exam.',
  alternates: { canonical: '/for/engineering' },
}

const WHY = [
  {
    label: 'Formula overload',
    body: "A single thermodynamics or circuits lecture can introduce a dozen derivable equations. Nocturne's AI identifies which ones the professor actually drilled.",
  },
  {
    label: 'Verbal vs. slide emphasis',
    body: "Professors who rush through a formula on a slide but verbally re-derive it three times are telling you something. Nocturne captures that signal.",
  },
  {
    label: 'Problem-set alignment',
    body: 'Upload your problem sets as study guide material. Nocturne cross-references them against lecture emphasis to surface the highest-yield concepts.',
  },
]

/* Static keyword snippet — ENGR 301 Thermodynamics & Circuits */
const KEYWORDS = [
  { rank: 1, term: 'Carnot efficiency', score: 97, zone: 'red' as const, mentions: 9, slides: 4 },
  { rank: 2, term: 'entropy', score: 91, zone: 'red' as const, mentions: 12, slides: 5 },
  { rank: 3, term: 'Kirchhoff current law', score: 87, zone: 'red' as const, mentions: 7, slides: 3 },
  { rank: 4, term: 'Thevenin equivalent', score: 82, zone: 'red' as const, mentions: 6, slides: 3 },
  { rank: 5, term: 'isothermal process', score: 76, zone: 'amber' as const, mentions: 5, slides: 2 },
  { rank: 6, term: 'adiabatic compression', score: 68, zone: 'amber' as const, mentions: 4, slides: 2 },
  { rank: 7, term: 'superposition theorem', score: 59, zone: 'amber' as const, mentions: 3, slides: 2 },
]

const ZONE = {
  red: { bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.25)', text: '#FB7185', dot: '#F43F5E' },
  amber: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', text: '#FCD34D', dot: '#FBBF24' },
}

const OTHER_DISCIPLINES = [
  { label: 'For Pre-Med', href: '/for/pre-med', desc: 'Dense terminology & USMLE recall' },
  { label: 'For Law', href: '/for/law', desc: 'Case and statute recall' },
]

export default function EngineeringPage() {
  return (
    <PageFade>
      <div className="px-6 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div data-reveal="" className="mb-14">
            <p className="text-caption uppercase tracking-[0.1em] text-indigo-400 mb-3">
              For Engineering
            </p>
            <h1 className="text-heading font-medium text-text-primary mb-4">
              Engineering exams test formulas. The ones your professor kept coming back to.
            </h1>
            <p className="text-body text-text-secondary leading-relaxed mb-6">
              Thermodynamics, circuits, structural analysis — your professor dwells longer on the
              slides that matter and repeats the derivations they&apos;ll test. Nocturne measures
              both signals and surfaces the{' '}
              <span className="text-rose-400 font-medium">Red Zone</span>: the formulas and concepts
              ranked by exam likelihood.
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

          {/* Why engineering */}
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
              Example — ENGR 301: Thermodynamics &amp; Circuits · Lecture 8
            </p>
            <div className="rounded-card border border-border-default bg-bg-elevated overflow-hidden">
              {/* Header bar */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-card bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-body-sm font-semibold text-indigo-400">
                    E
                  </div>
                  <div>
                    <p className="text-body-sm font-medium text-text-primary">ENGR 301</p>
                    <p className="text-caption text-text-tertiary">Thermodynamics &amp; Circuits · Lecture 8</p>
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
                  Score = weighted composite of verbal mentions, slide dwell time, and study-guide alignment
                </p>
              </div>
            </div>
          </section>

          {/* Testimonial */}
          <section className="mb-14">
            <p className="text-caption uppercase tracking-[0.1em] text-text-tertiary mb-4">
              From the beta
            </p>
            <div className="flex flex-col gap-3 p-5 rounded-card border border-border-default bg-bg-elevated">
              <p className="text-indigo-400 text-xs tracking-widest">★★★★★</p>
              <p className="text-body-sm text-text-primary-soft leading-relaxed">
                &ldquo;My thermo professor speeds through slides but always re-derives the same
                formulas verbally. Nocturne flagged exactly those — Carnot and entropy were on my
                midterm. I&apos;ve stopped treating every equation equally.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-caption font-semibold text-indigo-300 shrink-0">
                  DK
                </div>
                <div>
                  <p className="text-body-sm font-medium text-text-primary">Devin K.</p>
                  <p className="text-caption text-text-tertiary">Mechanical Engineering · Cal Poly SLO</p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="pt-8 border-t border-border-subtle mb-14">
            <h2 className="text-subheading font-medium text-text-primary mb-2">
              Know which formulas to drill the night before.
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
