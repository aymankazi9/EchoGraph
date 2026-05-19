'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { FileProgress, StepStatus } from '@/lib/upload'

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } },
}

function barColor(label: string, status: StepStatus): string {
  if (status === 'error') return 'bg-red-200'
  if (label.toLowerCase().includes('transcod')) return 'bg-amber-200'
  if (label.toLowerCase().includes('encrypt')) return 'bg-purple-300'
  return 'bg-teal-300' // upload
}

function statusDot(status: StepStatus): string {
  if (status === 'done') return 'text-teal-300'
  if (status === 'error') return 'text-red-200'
  if (status === 'active') return 'text-amber-200'
  return 'text-text-tertiary'
}

function statusLabel(status: StepStatus, pct: number): string {
  if (status === 'error') return 'Error'
  if (status === 'done') return 'Done'
  if (status === 'active') return `${Math.round(pct)}%`
  return 'Waiting'
}

interface Props {
  progress: FileProgress[]
}

export function ProgressStack({ progress }: Props) {
  if (progress.length === 0) return null

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-4"
    >
      <AnimatePresence>
        {progress.map((fp) => (
          <motion.div
            key={fp.fileId}
            variants={staggerItem}
            className="flex flex-col gap-3 p-4 rounded-card bg-bg-elevated border border-border-default"
          >
            {/* File header */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-body-sm text-text-primary font-medium truncate max-w-[280px]">
                {fp.name}
              </span>
              <span className="text-caption uppercase tracking-[0.07em] text-text-secondary shrink-0">
                {fp.type === 'pdf' ? 'Slides' : fp.type === 'audio' ? 'Recording' : 'Guide'}
              </span>
            </div>

            {/* Step rows */}
            <div className="flex flex-col gap-2.5">
              {fp.steps.map((step, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-label text-text-secondary">{step.label}</span>
                    <span className={`text-label ${statusDot(step.status)}`}>
                      {statusLabel(step.status, step.pct)}
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-pill bg-bg-subtle overflow-hidden">
                    <div
                      className={`h-full rounded-pill transition-all duration-150 ${barColor(step.label, step.status)}`}
                      style={{ width: `${step.status === 'done' ? 100 : step.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
