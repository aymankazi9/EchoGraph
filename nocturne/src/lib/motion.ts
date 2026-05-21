import { useReducedMotion } from 'framer-motion'

// Duration and easing tokens — DESIGN_SYSTEM.md §7
export const duration = {
  instant:   0.08,
  fast:      0.15,
  standard:  0.25,
  deliberate: 0.4,
  slow:      0.6,
}

export const ease = {
  out:    [0.0, 0.0, 0.2, 1.0] as const,
  in:     [0.4, 0.0, 1.0, 1.0] as const,
  inOut:  [0.4, 0.0, 0.2, 1.0] as const,
  spring: { type: 'spring' as const, stiffness: 400, damping: 30 },
  snappy: { type: 'spring' as const, stiffness: 600, damping: 35 },
}

// Reduced-motion hook — always returns zero durations when prefers-reduced-motion is active
export function useMotion() {
  const reduced = useReducedMotion()
  return {
    duration: reduced
      ? { instant: 0, fast: 0, standard: 0, deliberate: 0, slow: 0 }
      : duration,
    ease,
    reduced: !!reduced,
  }
}

// Staggered list mount — canonical shared variant
export const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.04 } },
}

export const staggerItem = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.standard, ease: ease.out } },
}

// Standard card / panel mount
export const fadeUp = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.standard, ease: ease.out } },
  exit:    { opacity: 0, y: -4, transition: { duration: duration.fast, ease: ease.in } },
}

// Slide jump confirmation flash — applied via whileHover/whileTap on PDF nav
export const slideFlash = {
  flash: {
    opacity: [1, 1.0, 0.7, 1],
    scale: [1, 1.03, 1],
    transition: { duration: 0.18, ease: 'easeOut' as const },
  },
}

// Red Zone chip reveal stagger — used on keyword chip row when keywords first load
export const chipReveal = {
  hidden: { opacity: 0, scale: 0.85, y: 4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] },
  },
}

// Checkmark SVG draw — used on progress step completion
export const checkDraw = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.4, ease: 'easeOut' as const },
      opacity: { duration: 0.1 },
    },
  },
}

// Card lift on hover — applied via whileHover on session cards
export const cardLift = {
  rest: { y: 0, boxShadow: '0 0 0 rgba(0,0,0,0)' },
  hover: {
    y: -2,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    transition: { duration: 0.12, ease: 'easeOut' as const },
  },
}

// Drop zone glow pulse on file accepted
export const dropAccepted = {
  animate: {
    boxShadow: [
      '0 0 0 0px rgba(99,102,241,0)',
      '0 0 0 3px rgba(99,102,241,0.4)',
      '0 0 0 6px rgba(99,102,241,0)',
    ],
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
}

// Sync complete ripple on status badge
export const syncRipple = {
  animate: {
    boxShadow: [
      '0 0 0 0px rgba(99,102,241,0.4)',
      '0 0 0 6px rgba(99,102,241,0)',
    ],
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
}

// Notification / toast entry
export const notifEntry = {
  hidden: { opacity: 0, y: 8, height: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: 'auto',
    transition: { duration: 0.2, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.15 },
  },
}
