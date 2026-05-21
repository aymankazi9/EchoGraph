'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Layers } from 'lucide-react'
import { useMotion } from '@/lib/motion'

export function EmptyState() {
  const [hasHovered, setHasHovered] = useState(false)
  const { reduced } = useMotion()

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6 text-center">
      <Layers size={48} strokeWidth={1.0} className="text-text-tertiary mb-5" />

      <h2 className="text-subheading font-medium text-text-primary mb-2">
        Your vault is empty
      </h2>
      <p className="text-body-sm text-text-secondary max-w-[360px] leading-relaxed mb-6">
        Start by uploading your lecture slides, recording, or study guide. Nocturne adapts
        to whatever you have.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <motion.div
          animate={hasHovered || reduced ? {} : {
            boxShadow: [
              '0 0 0 0px rgba(99,102,241,0)',
              '0 0 0 6px rgba(99,102,241,0.2)',
              '0 0 0 12px rgba(99,102,241,0)',
            ]
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
          onHoverStart={() => setHasHovered(true)}
          className="rounded-btn w-fit"
        >
          <Link
            href="/session/new"
            className="inline-flex h-9 px-5 items-center rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
          >
            New session
          </Link>
        </motion.div>
        <Link
          href="/session/new"
          className="inline-flex h-9 px-5 items-center rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors"
        >
          Import Anki deck
        </Link>
      </div>

      <p className="text-caption text-text-tertiary">
        Your files are encrypted before upload. We cannot read them.
      </p>
    </div>
  )
}
