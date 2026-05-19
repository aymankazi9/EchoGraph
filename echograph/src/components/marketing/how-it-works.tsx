'use client'

import { motion } from 'framer-motion'
import { FileText, Mic, Zap } from 'lucide-react'

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } },
}

const steps = [
  {
    icon: FileText,
    step: '01',
    label: 'Slides only',
    title: 'Start with your deck',
    body: 'EchoGraph extracts text from every slide and generates a Synthetic Study Guide automatically. Likely Zone keywords appear immediately — no study guide required.',
    chips: ['PDF viewer', 'Synthetic guide', 'Basic flashcards'],
    highlight: false,
  },
  {
    icon: Mic,
    step: '02',
    label: 'Add a recording',
    title: 'Layer in the lecture',
    body: 'Whisper transcribes your audio entirely in the browser. The silence-gap engine syncs each word to its slide, measuring dwell time and verbal repetition per topic.',
    chips: ['Word-level sync', 'Emphasis detection', 'Confidence scores'],
    highlight: false,
  },
  {
    icon: Zap,
    step: '03',
    label: 'Full session',
    title: 'Surface the Red Zone',
    body: 'Cross-reference your study guide or Anki deck against what the professor emphasized. Red Zone keywords are flagged, scored, hot-linked in the transcript, and exported as flashcards.',
    chips: ['Red Zone scoring', 'Heatmap overlay', 'Anki export'],
    highlight: true,
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-20 md:py-28">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="mb-12 text-center">
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-3">
            How it works
          </p>
          <h2 className="text-heading font-medium text-text-primary">
            Works with whatever you have
          </h2>
        </div>

        {/* Cards */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.step}
                variants={staggerItem}
                className={[
                  'flex flex-col gap-4 p-5 rounded-card border',
                  step.highlight
                    ? 'bg-bg-elevated border-teal-400/40'
                    : 'bg-bg-elevated border-border-default',
                ].join(' ')}
              >
                {/* Step + icon */}
                <div className="flex items-center justify-between">
                  <span className="text-caption uppercase tracking-[0.07em] text-text-tertiary">
                    {step.label}
                  </span>
                  <Icon
                    size={16}
                    strokeWidth={1.5}
                    className={step.highlight ? 'text-teal-300' : 'text-text-tertiary'}
                  />
                </div>

                {/* Title + body */}
                <div>
                  <h3 className="text-subheading font-medium text-text-primary mb-2">
                    {step.title}
                  </h3>
                  <p className="text-body text-text-secondary leading-relaxed">
                    {step.body}
                  </p>
                </div>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                  {step.chips.map((chip) => (
                    <span
                      key={chip}
                      className={[
                        'inline-flex items-center px-2 py-0.5 rounded-full text-caption',
                        step.highlight
                          ? 'bg-teal-500/20 text-teal-200 border border-teal-500/30'
                          : 'bg-bg-subtle text-text-tertiary border border-border-subtle',
                      ].join(' ')}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
