'use client'

import { motion } from 'framer-motion'

const fields = [
  'Pre-med',
  'Medical school',
  'Engineering',
  'Computer Science',
  'Law',
  'Graduate STEM',
  'PhD programs',
]

export function SocialProofBar() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] }}
      className="border-y border-border-subtle py-5 px-6"
    >
      <div className="max-w-3xl mx-auto flex flex-col items-center gap-4">
        <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary">
          Built for high-stakes fields
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {fields.map((field) => (
            <span
              key={field}
              className="inline-flex items-center px-3 py-1 rounded-full border border-border-default text-label text-text-secondary"
            >
              {field}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
