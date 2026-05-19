'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } },
}

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'The full core product.',
    features: [
      'PDF viewer + slide text extraction',
      'Whisper browser transcription',
      'Synthetic Study Guide (Likely Zone)',
      'Red Zone scoring with real study guide',
      'Slide density heatmap',
      'Anki .apkg import + export',
      'Red Zone flashcard generation',
      '500 MB encrypted storage',
      '3 sessions per month',
    ],
    cta: 'Start for free',
    href: '/login',
    coming: false,
    highlighted: false,
  },
  {
    name: 'Scholar',
    price: '$8',
    period: 'per month',
    tagline: 'Sharper transcription. More storage.',
    features: [
      'Everything in Free',
      'VibeVoice-ASR server-side transcription',
      'Speaker diarization (professor vs. Q&A)',
      'Hotword injection from study guide',
      'YouTube Red Zone search',
      'YouTube URL → caption → flashcards',
      'Cross-session keyword convergence',
      'Exam Urgency Mode',
      '5 GB encrypted storage',
      'Unlimited sessions',
    ],
    cta: 'Coming soon',
    href: '/login',
    coming: true,
    highlighted: true,
  },
  {
    name: 'Pro',
    price: '$18',
    period: 'per month',
    tagline: 'Everything, with AI explanations.',
    features: [
      'Everything in Scholar',
      'GPT-4 summarization (explicit consent)',
      'Practice quiz mode',
      'Cross-session Anki deck merging',
      'Markdown notes export',
      'Silence threshold tuning',
      'Synthetic Study Guide refinement suggestions',
      '20 GB encrypted storage',
      'Priority processing queue',
    ],
    cta: 'Coming soon',
    href: '/login',
    coming: true,
    highlighted: false,
  },
]

export function Pricing() {
  return (
    <section className="px-6 py-20 md:py-28 border-t border-border-subtle">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="mb-12 text-center">
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-3">
            Pricing
          </p>
          <h2 className="text-heading font-medium text-text-primary">
            Free tier is the full product
          </h2>
          <p className="text-body text-text-secondary mt-3 max-w-md mx-auto">
            The complete core pipeline is free. Paid tiers add better ASR and more storage — not access to basics.
          </p>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={staggerItem}
              className={[
                'flex flex-col p-5 rounded-card border',
                plan.highlighted
                  ? 'bg-bg-elevated border-teal-400/40'
                  : 'bg-bg-elevated border-border-default',
              ].join(' ')}
            >
              {/* Name + price */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-subheading font-medium text-text-primary">
                    {plan.name}
                  </span>
                  {plan.highlighted && (
                    <span className="text-caption uppercase tracking-[0.07em] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-200 border border-teal-500/30">
                      Popular
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-display font-medium text-text-primary">{plan.price}</span>
                  <span className="text-body-sm text-text-tertiary">{plan.period}</span>
                </div>
                <p className="text-body-sm text-text-secondary mt-1">{plan.tagline}</p>
              </div>

              {/* CTA */}
              {plan.coming ? (
                <button
                  disabled
                  className="w-full h-9 rounded-btn text-body font-medium border border-border-default text-text-tertiary opacity-50 cursor-not-allowed mb-5"
                >
                  {plan.cta}
                </button>
              ) : (
                <Link
                  href={plan.href}
                  className="w-full h-9 rounded-btn text-body font-medium bg-teal-300 text-text-inverse hover:bg-teal-400 transition-colors inline-flex items-center justify-center mb-5"
                >
                  {plan.cta}
                </Link>
              )}

              {/* Features */}
              <ul className="flex flex-col gap-2.5">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5">
                    <Check
                      size={14}
                      strokeWidth={1.5}
                      className="text-teal-300 mt-0.5 shrink-0"
                    />
                    <span className="text-body-sm text-text-secondary">{feat}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
