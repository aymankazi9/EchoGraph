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
            style={{
              width: 6,
              height: 6,
              background: active ? '#FF3B30' : done ? '#EDEDED' : 'rgba(255,255,255,0.14)',
            }}
          />
        )
      })}
    </div>
  )
}
