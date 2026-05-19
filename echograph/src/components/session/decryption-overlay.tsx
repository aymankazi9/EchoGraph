'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'

export function DecryptionOverlay() {
  const isDecrypting = useSessionStore((s) => s.isDecrypting)

  return (
    <AnimatePresence>
      {isDecrypting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm pointer-events-none"
        >
          <div className="flex flex-col items-center gap-4">
            <Lock size={28} strokeWidth={1.25} className="text-purple-400" />
            <p className="text-body-sm text-text-secondary">Decrypting…</p>
            <div className="w-48 h-1 rounded-full bg-bg-subtle overflow-hidden">
              <motion.div
                className="h-full bg-purple-400 rounded-full"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
