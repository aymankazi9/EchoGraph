'use client'

import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center w-7 h-7 cursor-default">
              <motion.span
                variants={localPulse}
                animate="animate"
                className="inline-block w-1.5 h-1.5"
                style={{ background: 'var(--color-accent)' }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">Local Mode — processing on your device</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
      <motion.span
        variants={localPulse}
        animate="animate"
        className="inline-block w-1.5 h-1.5 shrink-0"
        style={{ background: 'var(--color-accent)' }}
      />
      <Shield size={12} strokeWidth={1.5} className="shrink-0" style={{ color: '#9A9A9F' }} />
      <span className="text-caption" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: '#9A9A9F' }}>Local Mode</span>
    </div>
  )
}
