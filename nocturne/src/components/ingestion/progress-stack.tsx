'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, staggerItem, checkDraw, useMotion } from '@/lib/motion'
import type { FileProgress, StepStatus } from '@/lib/upload'

function barColor(label: string, status: StepStatus): string {
  if (status === 'error') return 'bg-rose-300'
  const l = label.toLowerCase()
  if (l.includes('transcod') || l.includes('compress') || l.includes('ffmpeg') || l.includes('infer') || l.includes('bert')) return 'bg-amber-300'
  if (l.includes('encrypt')) return 'bg-indigo-400'
  if (l.includes('model') || l.includes('download')) return 'bg-violet-500'
  return 'bg-indigo-500' // upload / default
}

function statusDot(status: StepStatus): string {
  if (status === 'done') return 'text-indigo-400'
  if (status === 'error') return 'text-rose-300'
  if (status === 'active') return 'text-amber-200'
  return 'text-text-tertiary'
}

function statusLabel(status: StepStatus, pct: number): string {
  if (status === 'error') return 'Error'
  if (status === 'done') return 'Done'
  if (status === 'active') return `${Math.round(pct)}%`
  return 'Waiting'
}

function CheckmarkIcon() {
  const { reduced } = useMotion()
  return (
    <motion.svg width="14" height="14" viewBox="0 0 14 14" className="text-indigo-400">
      <motion.path
        d="M2 7 L5.5 10.5 L12 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={checkDraw}
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
      />
    </motion.svg>
  )
}

interface Props {
  progress: FileProgress[]
}

export function ProgressStack({ progress }: Props) {
  const { reduced } = useMotion()

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
              {fp.steps.map((step, idx) => {
                const isComplete = step.status === 'done'
                return (
                  <motion.div
                    key={idx}
                    className="flex flex-col gap-1 rounded-sm"
                    animate={isComplete ? {
                      backgroundColor: ['rgba(99,102,241,0)', 'rgba(99,102,241,0.08)', 'rgba(99,102,241,0)'],
                      transition: { duration: reduced ? 0 : 0.6 }
                    } : {}}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-label text-text-secondary">{step.label}</span>
                      <span className={`text-label ${statusDot(step.status)} flex items-center gap-1`}>
                        {isComplete ? <CheckmarkIcon /> : statusLabel(step.status, step.pct)}
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-pill bg-bg-subtle overflow-hidden">
                      <div
                        className={`h-full rounded-pill transition-all duration-150 ${barColor(step.label, step.status)}`}
                        style={{ width: `${step.status === 'done' ? 100 : step.pct}%` }}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
