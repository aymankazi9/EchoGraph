'use client'

import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'

interface Props {
  collapsed: boolean
}

const localPulse = {
  animate: {
    scale: [1, 1.3, 1],
    opacity: [1, 0.6, 1],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' as const },
  },
}

export function PrivacyBadge({ collapsed }: Props) {
  if (collapsed) {
    return (
      <div className="flex items-center justify-center w-8 h-8">
        <motion.span
          variants={localPulse}
          animate="animate"
          className="inline-block w-2 h-2 rounded-full bg-teal-300"
        />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-btn border border-local-border bg-local-bg">
      <motion.span
        variants={localPulse}
        animate="animate"
        className="inline-block w-2 h-2 rounded-full bg-teal-300 shrink-0"
      />
      <Shield size={12} strokeWidth={1.5} className="text-local-text shrink-0" />
      <span className="text-caption text-local-text">Local Mode</span>
    </div>
  )
}
