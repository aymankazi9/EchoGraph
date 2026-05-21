'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { TopoBackground } from '@/components/marketing/topo-background'

// DESIGN_SYSTEM.md §7 — fadeUp variant with staggered delays
const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      delay,
      ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number],
    },
  }),
}

export function Hero() {
  const scrollToHowItWorks = useCallback(() => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <section className="relative flex flex-col items-center text-center px-6 pt-24 pb-20 md:pt-32 md:pb-28">
      <TopoBackground />
      <div className="relative z-10 flex flex-col items-center text-center w-full">
      {/* Eyebrow */}
      <motion.p
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="text-caption uppercase tracking-[0.07em] text-indigo-400 mb-5"
      >
        Built for STEM students
      </motion.p>

      {/* Headline */}
      <div className="flex flex-col items-center mb-6">
        <motion.h1
          custom={0.05}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="text-display font-medium text-text-primary leading-[1.25]"
        >
          Not a note-taker.
        </motion.h1>
        <motion.h1
          custom={0.15}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="text-display font-medium text-text-primary leading-[1.25]"
        >
          A study intelligence system.
        </motion.h1>
        <motion.p
          custom={0.20}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="text-caption uppercase tracking-[0.07em] text-indigo-400 mb-5"
        >
          BETA v1.1
        </motion.p>
      </div>

      {/* Sub-headline */}
      <motion.p
        custom={0.3}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="text-body text-text-secondary max-w-[480px] leading-relaxed mb-8"
      >
        Nocturne links your lecture audio, slides, and study guide — then tells you
        what your professor actually emphasized.
      </motion.p>

      {/* CTAs */}
      <motion.div
        custom={0.45}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="flex items-center gap-3 mb-6"
      >
        <Link
          href="/login"
          className="inline-flex h-10 px-6 items-center rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
        >
          Start for free
        </Link>
        <button
          type="button"
          onClick={scrollToHowItWorks}
          className="inline-flex h-10 px-6 items-center rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors"
        >
          See how it works
        </button>
      </motion.div>

      {/* Trust signals */}
      <motion.p
        custom={0.55}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="text-caption text-text-tertiary"
      >
        Zero-knowledge encrypted&nbsp; · &nbsp;Runs in your browser&nbsp; · &nbsp;Free tier is the full product
      </motion.p>
      </div>
    </section>
  )
}
