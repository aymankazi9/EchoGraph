'use client'

import { motion } from 'framer-motion'

// Matches the fadeUp variant used in hero.tsx — opacity+y on mount, not scroll-triggered.
export function PageFade({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] }}
    >
      {children}
    </motion.div>
  )
}
