'use client'

import { motion } from 'framer-motion'
import { Zap, Mic, BarChart2, BookOpen, Shield, Cpu } from 'lucide-react'

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } },
}

const features = [
  {
    icon: Zap,
    title: 'Red Zone Detection',
    body: 'Cross-references your study guide against slide density and verbal repetition to surface the highest-yield keywords — the ones most likely to appear on the exam.',
  },
  {
    icon: Mic,
    title: 'Professor Emphasis Detection',
    body: 'Measures how long the professor dwells on each slide and how many times they repeat each term. Not just what was said — what was emphasized.',
  },
  {
    icon: BarChart2,
    title: 'Lecture Confidence Score',
    body: 'Each Red Zone keyword gets a per-keyword confidence score derived from slide density, verbal mentions, and study guide alignment.',
  },
  {
    icon: BookOpen,
    title: 'Anki Integration',
    body: 'Import your existing deck — card fronts seed the study guide automatically. Export Red Zone flashcards as a valid .apkg file, tagged and ready for spaced repetition.',
  },
  {
    icon: Shield,
    title: 'Zero-Knowledge Encrypted',
    body: 'Your vault passphrase never touches the server. Files are AES-GCM encrypted in the browser before upload. The server stores opaque blobs it cannot read.',
  },
  {
    icon: Cpu,
    title: 'Runs Entirely in Your Browser',
    body: 'Whisper and BERT run as WASM Web Workers on your device. No audio ever leaves your machine on the free tier — unless you explicitly opt into Scholar-tier ASR.',
  },
]

export function FeatureHighlights() {
  return (
    <section className="px-6 py-20 md:py-28 border-t border-border-subtle">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="mb-12 text-center">
          <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-3">
            Feature highlights
          </p>
          <h2 className="text-heading font-medium text-text-primary">
            Everything the serious student needs
          </h2>
        </div>

        {/* 2×3 grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.map((feat) => {
            const Icon = feat.icon
            return (
              <motion.div
                key={feat.title}
                variants={staggerItem}
                className="flex flex-col gap-3 p-5 rounded-card border border-border-default bg-bg-elevated"
              >
                <Icon size={18} strokeWidth={1.5} className="text-teal-300" />
                <h3 className="text-subheading font-medium text-text-primary">
                  {feat.title}
                </h3>
                <p className="text-body text-text-secondary leading-relaxed">
                  {feat.body}
                </p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
