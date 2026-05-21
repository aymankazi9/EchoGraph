'use client'

import { motion } from 'framer-motion'

interface Props {
  currentStep: number
  totalSteps: number
}

export function OnboardingProgress({ currentStep, totalSteps }: Props) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const done = step < currentStep
        const active = step === currentStep
        return (
          <motion.div
            key={step}
            initial={false}
            animate={
              active
                ? { scale: 1.3, opacity: 1 }
                : done
                  ? { scale: 1, opacity: 0.6 }
                  : { scale: 1, opacity: 0.2 }
            }
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{ width: 8, height: 8, borderRadius: 9999 }}
            className={active ? 'bg-indigo-400' : done ? 'bg-indigo-500' : 'bg-border-strong'}
          />
        )
      })}
    </div>
  )
}
